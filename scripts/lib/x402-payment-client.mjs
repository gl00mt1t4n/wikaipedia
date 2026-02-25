import { randomBytes } from "node:crypto";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

function parseJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeAddress(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.toLowerCase();
}

function parseHeadersJson(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return {};
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("KITE_PASSPORT_MCP_HEADERS_JSON must be a JSON object.");
  }
  const headers = {};
  for (const [key, headerValue] of Object.entries(parsed)) {
    if (!key || headerValue == null) continue;
    headers[String(key)] = String(headerValue);
  }
  return headers;
}

function getKitePassportMcpHeaders() {
  const fromJson = parseHeadersJson(process.env.KITE_PASSPORT_MCP_HEADERS_JSON);
  const apiKey = String(process.env.KITE_PASSPORT_MCP_API_KEY ?? "").trim();
  if (apiKey && !Object.keys(fromJson).some((name) => name.toLowerCase() === "authorization")) {
    fromJson.Authorization = `Bearer ${apiKey}`;
  }
  return fromJson;
}

function extractFromToolContent(contentEntry) {
  if (!contentEntry || typeof contentEntry !== "object") {
    return null;
  }

  if (contentEntry.type === "text") {
    const text = String(contentEntry.text ?? "").trim();
    if (!text) return null;
    return parseJson(text) ?? { text };
  }

  if (contentEntry.type === "json") {
    return contentEntry.json && typeof contentEntry.json === "object" ? contentEntry.json : null;
  }

  if (contentEntry.structuredContent && typeof contentEntry.structuredContent === "object") {
    return contentEntry.structuredContent;
  }

  return null;
}

function extractToolResultObject(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidates = [];
  if (payload.result && typeof payload.result === "object") {
    candidates.push(payload.result);
  }
  candidates.push(payload);

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    if (candidate.structuredContent && typeof candidate.structuredContent === "object") {
      return candidate.structuredContent;
    }

    const direct =
      candidate.output ??
      candidate.data ??
      candidate.value ??
      candidate.toolResult ??
      candidate.result;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct;
    }

    if (Array.isArray(candidate.content)) {
      for (const entry of candidate.content) {
        const extracted = extractFromToolContent(entry);
        if (extracted && typeof extracted === "object") {
          return extracted;
        }
      }
    }
  }

  return null;
}

async function callKitePassportTool(name, args, onLog) {
  const mcpUrl = String(process.env.KITE_PASSPORT_MCP_URL ?? "").trim();
  if (!mcpUrl) {
    throw new Error("KITE_PASSPORT_MCP_URL is required for Kite Passport x402 mode.");
  }

  const requestId = `kite_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const headers = {
    "content-type": "application/json",
    ...getKitePassportMcpHeaders()
  };

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: {
        name,
        arguments: args ?? {}
      }
    })
  });

  const text = await response.text().catch(() => "");
  const payload = parseJson(text);
  if (!response.ok) {
    throw new Error(`Kite Passport MCP ${name} failed (${response.status}): ${text.slice(0, 300) || "empty response"}`);
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`Kite Passport MCP ${name} returned non-JSON response.`);
  }
  if (payload.error) {
    const errorMessage =
      String(payload.error?.message ?? "").trim() ||
      String(payload.error?.code ?? "").trim() ||
      `MCP tool ${name} returned error`;
    throw new Error(errorMessage);
  }

  const result = extractToolResultObject(payload);
  if (!result) {
    throw new Error(`Kite Passport MCP ${name} returned no structured result.`);
  }
  onLog?.(`[kite-passport] tool=${name} ok`);
  return result;
}

function decodePaymentRequiredFromResponse(response, bodyText) {
  const header =
    response.headers.get("payment-required") ??
    response.headers.get("Payment-Required") ??
    response.headers.get("PAYMENT-REQUIRED");

  if (header) {
    try {
      const decodedText = Buffer.from(header, "base64").toString("utf8");
      const decoded = parseJson(decodedText);
      if (decoded && typeof decoded === "object") {
        return decoded;
      }
    } catch {}
  }

  const fromBody = parseJson(bodyText);
  if (fromBody && typeof fromBody === "object") {
    return fromBody;
  }
  return null;
}

function extractKitePassportPaymentArgs(paymentRequired) {
  const accepts = Array.isArray(paymentRequired?.accepts) ? paymentRequired.accepts : [];
  const selected = accepts.find((entry) => entry && typeof entry === "object") ?? null;
  if (!selected) {
    return null;
  }

  const amount = String(selected.amount ?? selected.maxAmountRequired ?? "").trim();
  const payeeAddr = normalizeAddress(selected.payTo ?? selected.payee_addr);
  const tokenType = String(
    selected?.extra?.currency ?? selected?.extra?.token_type ?? process.env.KITE_PASSPORT_TOKEN_TYPE ?? "USDC"
  ).trim();
  const merchantName = String(process.env.KITE_PASSPORT_MERCHANT_NAME ?? "OpenClaw Agent").trim();

  if (!amount || !payeeAddr || !tokenType) {
    return null;
  }

  return {
    amount,
    payee_addr: payeeAddr,
    token_type: tokenType,
    merchant_name: merchantName
  };
}

function extractPaymentHeader(approvalResult) {
  if (!approvalResult || typeof approvalResult !== "object") {
    return null;
  }

  const directPairs = [
    ["x-payment", approvalResult.x_payment],
    ["x-payment", approvalResult["x-payment"]],
    ["x-payment", approvalResult.xPayment],
    ["x-payment", approvalResult.paymentHeader],
    ["x-payment", approvalResult.payment_header],
    ["PAYMENT-SIGNATURE", approvalResult.payment_signature],
    ["PAYMENT-SIGNATURE", approvalResult.paymentSignature]
  ];

  for (const [name, value] of directPairs) {
    if (typeof value === "string" && value.trim()) {
      return { name, value: value.trim() };
    }
  }

  if (approvalResult.headers && typeof approvalResult.headers === "object") {
    const headerCandidates = [
      ["x-payment", approvalResult.headers["x-payment"]],
      ["X-PAYMENT", approvalResult.headers["X-PAYMENT"]],
      ["payment-signature", approvalResult.headers["payment-signature"]],
      ["PAYMENT-SIGNATURE", approvalResult.headers["PAYMENT-SIGNATURE"]]
    ];
    for (const [name, value] of headerCandidates) {
      if (typeof value === "string" && value.trim()) {
        return { name, value: value.trim() };
      }
    }
  }

  return null;
}

function boolFromEnv(name, fallback) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return fallback;
}

function resolveKiteX402ClientMode(network) {
  if (network !== "eip155:2368") {
    return "exact";
  }

  const configured = String(process.env.KITE_X402_CLIENT_MODE ?? "auto").trim().toLowerCase();
  if (configured === "passport" || configured === "exact") {
    return configured;
  }

  if (String(process.env.KITE_PASSPORT_MCP_URL ?? "").trim()) {
    return "passport";
  }
  return "exact";
}

function createExactFetch(fetchImpl, network, paymentAccount) {
  if (!paymentAccount) {
    return fetchImpl;
  }
  return wrapFetchWithPaymentFromConfig(fetchImpl, {
    schemes: [
      {
        network,
        client: new ExactEvmScheme(paymentAccount)
      }
    ]
  });
}

export function createFetchWithX402Payment(input) {
  const fetchImpl = input?.fetchImpl ?? fetch;
  const network = String(input?.network ?? "").trim();
  const paymentAccount = input?.paymentAccount ?? null;
  const onLog = typeof input?.onLog === "function" ? input.onLog : null;

  const mode = resolveKiteX402ClientMode(network);
  if (mode === "exact" || network !== "eip155:2368") {
    onLog?.(`[x402-client] mode=exact network=${network || "unknown"}`);
    return createExactFetch(fetchImpl, network, paymentAccount);
  }

  const useExactFallback = boolFromEnv("KITE_PASSPORT_EXACT_FALLBACK", false);
  const exactFallbackFetch = useExactFallback ? createExactFetch(fetchImpl, network, paymentAccount) : null;
  onLog?.(`[x402-client] mode=passport network=${network}${useExactFallback ? " fallback=exact" : ""}`);

  let cachedPayerAddr = normalizeAddress(process.env.KITE_PASSPORT_PAYER_ADDR ?? "");

  return async (inputUrl, init) => {
    const request = new Request(inputUrl, init);
    const retryBaseRequest = request.clone();
    const firstResponse = await fetchImpl(request);
    if (firstResponse.status !== 402) {
      return firstResponse;
    }

    const firstText = await firstResponse.clone().text().catch(() => "");
    const paymentRequired = decodePaymentRequiredFromResponse(firstResponse, firstText);
    const paymentArgs = extractKitePassportPaymentArgs(paymentRequired);

    if (!paymentArgs) {
      if (exactFallbackFetch) {
        onLog?.("[kite-passport] 402 received but no compatible payment requirements; falling back to exact client");
        return exactFallbackFetch(inputUrl, init);
      }
      return firstResponse;
    }

    if (!cachedPayerAddr) {
      const payerResult = await callKitePassportTool("get_payer_addr", {}, onLog);
      const payerAddr = normalizeAddress(
        payerResult.payer_addr ?? payerResult.address ?? payerResult.wallet_address ?? payerResult.walletAddress
      );
      if (!payerAddr) {
        throw new Error("Kite Passport get_payer_addr returned no payer address.");
      }
      cachedPayerAddr = payerAddr;
    }

    const approvePayload = {
      payer_addr: cachedPayerAddr,
      ...paymentArgs
    };
    const approval = await callKitePassportTool("approve_payment", approvePayload, onLog);

    if (approval.session_creation_required === true || approval.oauth_required === true) {
      throw new Error("kite_passport_session_required");
    }

    const paymentHeader = extractPaymentHeader(approval);
    if (!paymentHeader) {
      const fallbackError = String(approval.error ?? approval.message ?? "").trim();
      if (fallbackError) {
        throw new Error(fallbackError);
      }
      throw new Error("Kite Passport approve_payment returned no x_payment header value.");
    }

    const retryRequest = retryBaseRequest;
    retryRequest.headers.set(paymentHeader.name, paymentHeader.value);
    if (paymentHeader.name.toLowerCase() === "x-payment") {
      retryRequest.headers.set("x-payment", paymentHeader.value);
      retryRequest.headers.set("X-PAYMENT", paymentHeader.value);
    }
    if (paymentHeader.name.toLowerCase() === "payment-signature") {
      retryRequest.headers.set("payment-signature", paymentHeader.value);
      retryRequest.headers.set("PAYMENT-SIGNATURE", paymentHeader.value);
    }

    const retryResponse = await fetchImpl(retryRequest);
    if (retryResponse.status !== 402 || !exactFallbackFetch) {
      return retryResponse;
    }

    const retryText = await retryResponse.clone().text().catch(() => "");
    const retryRequired = decodePaymentRequiredFromResponse(retryResponse, retryText);
    const retryAccepts = Array.isArray(retryRequired?.accepts) ? retryRequired.accepts : [];
    const stillPassportCompatible = retryAccepts.some((entry) =>
      normalizeAddress(entry?.payTo ?? entry?.payee_addr) && String(entry?.amount ?? entry?.maxAmountRequired ?? "").trim()
    );

    if (stillPassportCompatible) {
      return retryResponse;
    }

    onLog?.("[kite-passport] retry with x-payment still returned 402; falling back to exact client");
    return exactFallbackFetch(inputUrl, init);
  };
}
