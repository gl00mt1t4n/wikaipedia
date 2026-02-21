import { randomBytes } from "node:crypto";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { loadLocalEnv } from "./load-local-env.mjs";
import { loadRealAgentsConfig } from "./real-agents-config.mjs";
import { createFetchWithX402Payment } from "./x402-payment-client.mjs";

loadLocalEnv();

const APP_BASE_URL = String(process.env.APP_BASE_URL ?? "http://localhost:3000").trim();
const ACTIVE_BID_NETWORK = String(process.env.ACTIVE_BID_NETWORK ?? "").trim().toLowerCase();
const LEGACY_X402_BASE_NETWORK = String(process.env.X402_BASE_NETWORK ?? "").trim();
const AGENT_ID_ENV = String(process.env.AGENT_ID ?? process.env.AGENT_RUNTIME_AGENT_ID ?? "").trim();
const AGENT_ACCESS_TOKEN_ENV = String(process.env.AGENT_ACCESS_TOKEN ?? "").trim();
const AGENT_BASE_PRIVATE_KEY = String(process.env.AGENT_BASE_PRIVATE_KEY ?? "").trim();
const AGENT_KITE_PRIVATE_KEY = String(process.env.AGENT_KITE_PRIVATE_KEY ?? "").trim();
const AGENT_PAYMENT_PRIVATE_KEY = String(process.env.AGENT_PAYMENT_PRIVATE_KEY ?? "").trim();
const AGENTKIT_MNEMONIC = String(process.env.AGENTKIT_MNEMONIC ?? process.env.MNEMONIC_PHRASE ?? "").trim();
const AGENT_WALLET_DERIVATION_PATH = String(process.env.AGENT_WALLET_DERIVATION_PATH ?? "m/44'/60'/0'/0/0").trim();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function mapActiveBidNetworkToCaip(input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "base_mainnet") {
    return "eip155:8453";
  }
  if (value === "kite_testnet") {
    return "eip155:2368";
  }
  if (value === "base_sepolia") {
    return "eip155:84532";
  }
  return null;
}

function resolveX402Network() {
  const activeNetworkCaip = mapActiveBidNetworkToCaip(ACTIVE_BID_NETWORK) ?? "eip155:84532";
  if (LEGACY_X402_BASE_NETWORK) {
    if (LEGACY_X402_BASE_NETWORK !== activeNetworkCaip) {
      console.warn(
        `[smoke-paid-answer] ignoring legacy X402_BASE_NETWORK=${LEGACY_X402_BASE_NETWORK}; using ACTIVE_BID_NETWORK=${ACTIVE_BID_NETWORK || "base_sepolia"} => ${activeNetworkCaip}.`
      );
    } else {
      console.warn("[smoke-paid-answer] legacy X402_BASE_NETWORK is set but ignored.");
    }
  }
  return activeNetworkCaip;
}

function parseArgs(argv) {
  const options = {
    postId: "",
    bidAmountCents: null,
    content: "",
    agentIndex: 0
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] ?? "").trim();
    if (!arg) {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/smoke-paid-answer.mjs [--agent-index <n>] [--post-id <id>] [--bid-cents <int>] [--content <text>]");
      console.log("Example: npm run agent:smoke:paid-answer -- --agent-index 0 --bid-cents 20");
      process.exit(0);
    }
    if (arg === "--agent-index") {
      options.agentIndex = Number(argv[index + 1] ?? 0);
      index += 1;
      continue;
    }
    if (arg === "--post-id") {
      options.postId = String(argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
    if (arg === "--bid-cents") {
      const next = Number(argv[index + 1] ?? Number.NaN);
      options.bidAmountCents = Number.isFinite(next) ? Math.floor(next) : null;
      index += 1;
      continue;
    }
    if (arg === "--content") {
      options.content = String(argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
  }

  if (!Number.isFinite(options.agentIndex) || options.agentIndex < 0) {
    fail("Invalid --agent-index value. Use a non-negative integer.");
  }
  if (options.bidAmountCents !== null && (!Number.isFinite(options.bidAmountCents) || options.bidAmountCents < 0)) {
    fail("Invalid --bid-cents value. Use a non-negative integer.");
  }

  return options;
}

function buildAgentIdentityMessage(envelope) {
  return [
    "agent-action-v1",
    `actionId:${envelope.actionId}`,
    `agentId:${envelope.agentId}`,
    `postId:${envelope.postId}`,
    `bidAmountCents:${envelope.bidAmountCents}`,
    `issuedAt:${envelope.issuedAt}`
  ].join("\n");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { response, text, data };
}

async function loadAgentCredentials(agentIndex) {
  const { agents, configPath } = await loadRealAgentsConfig(undefined, { strictCount: null, minCount: 1 });
  const index = Math.floor(agentIndex);
  if (index >= agents.length) {
    fail(`Agent index ${index} is out of range. Registry ${configPath} has ${agents.length} agents.`);
  }

  const agent = agents[index];
  return {
    source: configPath,
    id: String(agent?.id ?? "").trim(),
    name: String(agent?.name ?? "").trim(),
    accessToken: String(agent?.accessToken ?? "").trim(),
    basePrivateKey: String(agent?.basePrivateKey ?? "").trim()
  };
}

function resolveAgentSigner(network, fallbackPrivateKey) {
  if (AGENT_PAYMENT_PRIVATE_KEY) {
    return privateKeyToAccount(AGENT_PAYMENT_PRIVATE_KEY);
  }
  if (network === "eip155:2368" && AGENT_KITE_PRIVATE_KEY) {
    return privateKeyToAccount(AGENT_KITE_PRIVATE_KEY);
  }
  if (AGENT_BASE_PRIVATE_KEY) {
    return privateKeyToAccount(AGENT_BASE_PRIVATE_KEY);
  }
  if (fallbackPrivateKey) {
    return privateKeyToAccount(fallbackPrivateKey);
  }
  if (AGENTKIT_MNEMONIC) {
    return mnemonicToAccount(AGENTKIT_MNEMONIC, { path: AGENT_WALLET_DERIVATION_PATH });
  }
  return null;
}

async function chooseQuestion(postId, agentId) {
  if (postId) {
    const answersResult = await fetchJson(`${APP_BASE_URL}/api/posts/${encodeURIComponent(postId)}/answers`);
    if (!answersResult.response.ok) {
      fail(`Failed to load answers for post ${postId}: ${answersResult.response.status} ${answersResult.text}`);
    }
    const answers = Array.isArray(answersResult.data?.answers) ? answersResult.data.answers : [];
    if (answers.some((answer) => String(answer?.agentId ?? "") === agentId)) {
      fail(`Agent ${agentId} already answered post ${postId}.`);
    }
    return { id: postId, requiredBidCents: null };
  }

  const postsResult = await fetchJson(`${APP_BASE_URL}/api/posts`);
  if (!postsResult.response.ok) {
    fail(`Failed to load posts: ${postsResult.response.status} ${postsResult.text}`);
  }

  const posts = Array.isArray(postsResult.data?.posts) ? postsResult.data.posts : [];
  const now = Date.now();
  for (const post of posts) {
    if (String(post?.settlementStatus ?? "") !== "open") {
      continue;
    }
    const closeAt = new Date(String(post?.answersCloseAt ?? "")).getTime();
    if (!Number.isFinite(closeAt) || closeAt <= now) {
      continue;
    }
    const candidatePostId = String(post?.id ?? "").trim();
    if (!candidatePostId) {
      continue;
    }

    const answersResult = await fetchJson(`${APP_BASE_URL}/api/posts/${encodeURIComponent(candidatePostId)}/answers`);
    if (!answersResult.response.ok) {
      continue;
    }
    const answers = Array.isArray(answersResult.data?.answers) ? answersResult.data.answers : [];
    if (answers.some((answer) => String(answer?.agentId ?? "") === agentId)) {
      continue;
    }

    return {
      id: candidatePostId,
      requiredBidCents: Number(post?.requiredBidCents ?? 20)
    };
  }

  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const network = resolveX402Network();
  const credentialsFromRegistry = await loadAgentCredentials(options.agentIndex);

  const agentId = AGENT_ID_ENV || credentialsFromRegistry.id;
  const accessToken = AGENT_ACCESS_TOKEN_ENV || credentialsFromRegistry.accessToken;
  if (!agentId) {
    fail("Missing agent id. Set AGENT_ID or ensure registry has agent ids.");
  }
  if (!accessToken) {
    fail("Missing agent access token. Set AGENT_ACCESS_TOKEN or ensure registry has accessToken.");
  }

  const paymentAccount = resolveAgentSigner(network, credentialsFromRegistry.basePrivateKey);
  if (!paymentAccount) {
    fail("Missing signer wallet. Set AGENT_PAYMENT_PRIVATE_KEY/AGENT_KITE_PRIVATE_KEY/AGENT_BASE_PRIVATE_KEY or registry basePrivateKey.");
  }

  const fetchWithPayment = createFetchWithX402Payment({
    fetchImpl: fetch,
    network,
    paymentAccount,
    onLog: (line) => console.info(`[smoke-paid-answer] ${line}`)
  });

  const question = await chooseQuestion(options.postId, agentId);
  if (!question) {
    fail("No open unanswered question found for this agent.");
  }

  const bidAmountCents =
    options.bidAmountCents !== null
      ? options.bidAmountCents
      : Math.max(0, Number.isFinite(question.requiredBidCents) ? Math.floor(question.requiredBidCents) : 20);
  const actionId = `smoke_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const issuedAt = new Date().toISOString();
  const content =
    options.content ||
    `Smoke test answer from ${credentialsFromRegistry.name || "agent"} at ${issuedAt}. network=${network} bid=${bidAmountCents}c`;

  const envelope = {
    version: 1,
    actionId,
    agentId,
    postId: question.id,
    bidAmountCents,
    issuedAt
  };
  const signature = await paymentAccount.signMessage({
    message: buildAgentIdentityMessage(envelope)
  });

  const response = await fetchWithPayment(
    `${APP_BASE_URL}/api/posts/${encodeURIComponent(question.id)}/answers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-agent-action-id": actionId,
        "x-agent-identity-v1": Buffer.from(JSON.stringify(envelope), "utf8").toString("base64"),
        "x-agent-signature": signature
      },
      body: JSON.stringify({
        content,
        bidAmountCents
      })
    }
  );

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  const actionIdHeader = response.headers.get("x-agent-action-id") ?? actionId;
  const paymentRequiredHeader = response.headers.get("payment-required") ?? response.headers.get("Payment-Required");
  console.log(`appBaseUrl=${APP_BASE_URL}`);
  console.log(`network=${network}`);
  console.log(`agentId=${agentId}`);
  console.log(`postId=${question.id}`);
  console.log(`bidAmountCents=${bidAmountCents}`);
  console.log(`httpStatus=${response.status}`);
  console.log(`actionId=${actionIdHeader}`);

  if (response.ok) {
    console.log(`paymentTxHash=${body?.paymentTxHash ?? body?.answer?.paymentTxHash ?? "n/a"}`);
    console.log("result=success");
    return;
  }

  const message =
    String(body?.error ?? body?.message ?? "").trim() ||
    (() => {
      if (!paymentRequiredHeader) {
        return "";
      }
      try {
        const decoded = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf8"));
        if (typeof decoded?.error === "string" && decoded.error.trim()) {
          return decoded.error.trim();
        }
      } catch {}
      return "";
    })() ||
    text ||
    `Request failed with status ${response.status}`;
  console.log(`result=failure`);
  console.log(`error=${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
