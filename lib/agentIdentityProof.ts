import crypto from "node:crypto";
import { recoverMessageAddress } from "viem";

const MAX_IDENTITY_AGE_MS = Number(process.env.AGENT_IDENTITY_MAX_AGE_MS ?? 10 * 60 * 1000);

export type AgentIdentityEnvelopeV1 = {
  version: 1;
  actionId: string;
  agentId: string;
  postId: string;
  bidAmountCents: number;
  issuedAt: string;
};

export function buildAgentIdentityMessage(envelope: AgentIdentityEnvelopeV1): string {
  return [
    "agent-action-v1",
    `actionId:${envelope.actionId}`,
    `agentId:${envelope.agentId}`,
    `postId:${envelope.postId}`,
    `bidAmountCents:${envelope.bidAmountCents}`,
    `issuedAt:${envelope.issuedAt}`
  ].join("\n");
}

function parseEnvelope(headerValue: string): AgentIdentityEnvelopeV1 | null {
  try {
    const decoded = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8")) as Record<string, unknown>;
    const versionRaw = decoded.version ?? decoded.v;
    const version = Number(versionRaw);
    const actionId = String(decoded.actionId ?? "").trim();
    const agentId = String(decoded.agentId ?? "").trim();
    const postId = String(decoded.postId ?? "").trim();
    const bidAmountCents = Number(decoded.bidAmountCents ?? Number.NaN);
    const issuedAt = String(decoded.issuedAt ?? "").trim();

    if (version !== 1) {
      return null;
    }
    if (!actionId || !agentId || !postId || !Number.isFinite(bidAmountCents) || !issuedAt) {
      return null;
    }

    return {
      version: 1,
      actionId,
      agentId,
      postId,
      bidAmountCents: Math.floor(bidAmountCents),
      issuedAt
    };
  } catch {
    return null;
  }
}

function hashIdentityProof(envelopeHeader: string, signature: string): string {
  return crypto.createHash("sha256").update(`${envelopeHeader}.${signature}`).digest("hex");
}

export type AgentIdentityVerificationResult =
  | {
      ok: true;
      envelope: AgentIdentityEnvelopeV1;
      identityScheme: "wallet_sig";
      identitySubject: string;
      identityProofRef: string;
    }
  | {
      ok: false;
      httpStatus: number;
      failureCode: string;
      failureMessage: string;
    };

export async function verifyAgentIdentityFromHeaders(input: {
  headers: Headers;
  expectedActionId: string;
  expectedAgentId: string;
  expectedPostId: string;
  expectedBidAmountCents: number;
  expectedWalletAddress: string | null;
}): Promise<AgentIdentityVerificationResult> {
  const encodedEnvelope = String(input.headers.get("x-agent-identity-v1") ?? "").trim();
  const signature = String(input.headers.get("x-agent-signature") ?? "").trim();

  if (!encodedEnvelope || !signature) {
    return {
      ok: false,
      httpStatus: 401,
      failureCode: "missing_identity_headers",
      failureMessage: "Missing x-agent-identity-v1 or x-agent-signature header."
    };
  }

  const envelope = parseEnvelope(encodedEnvelope);
  if (!envelope) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "invalid_identity_envelope",
      failureMessage: "Invalid x-agent-identity-v1 payload."
    };
  }

  if (envelope.actionId !== input.expectedActionId) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "identity_action_mismatch",
      failureMessage: "Identity proof actionId does not match request."
    };
  }
  if (envelope.agentId !== input.expectedAgentId) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "identity_agent_mismatch",
      failureMessage: "Identity proof agentId does not match authenticated agent."
    };
  }
  if (envelope.postId !== input.expectedPostId) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "identity_post_mismatch",
      failureMessage: "Identity proof postId does not match request."
    };
  }
  if (envelope.bidAmountCents !== input.expectedBidAmountCents) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "identity_bid_mismatch",
      failureMessage: "Identity proof bidAmountCents does not match request."
    };
  }

  const issuedAtTs = new Date(envelope.issuedAt).getTime();
  if (!Number.isFinite(issuedAtTs)) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "identity_invalid_issued_at",
      failureMessage: "Identity proof issuedAt is invalid."
    };
  }

  const nowTs = Date.now();
  if (Math.abs(nowTs - issuedAtTs) > MAX_IDENTITY_AGE_MS) {
    return {
      ok: false,
      httpStatus: 401,
      failureCode: "identity_expired",
      failureMessage: "Identity proof is expired or too far from current time."
    };
  }

  const expectedWallet = String(input.expectedWalletAddress ?? "").trim().toLowerCase();
  if (!expectedWallet) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "agent_wallet_missing",
      failureMessage: "Agent wallet address is not configured for identity verification."
    };
  }

  try {
    const message = buildAgentIdentityMessage(envelope);
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`
    });

    if (recovered.toLowerCase() !== expectedWallet) {
      return {
        ok: false,
        httpStatus: 401,
        failureCode: "identity_signature_mismatch",
        failureMessage: "Identity signature does not match registered agent wallet."
      };
    }

    return {
      ok: true,
      envelope,
      identityScheme: "wallet_sig",
      identitySubject: recovered.toLowerCase(),
      identityProofRef: hashIdentityProof(encodedEnvelope, signature)
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: 400,
      failureCode: "identity_signature_invalid",
      failureMessage: error instanceof Error ? error.message : "Invalid identity signature."
    };
  }
}
