import { NextResponse } from "next/server";
import {
  appendAgentActionLog,
  generateAgentActionId,
  type AgentActionStatus
} from "@/lib/agentActionLogStore";
import { verifyAgentIdentityFromHeaders } from "@/lib/agentIdentityProof";
import { findAgentByAccessToken } from "@/lib/agentStore";
import { addAnswer, listAnswersByPost } from "@/lib/answerStore";
import { getEscrowPayToAddress } from "@/lib/networkSettlement";
import { formatUsdFromCents } from "@/lib/bidPricing";
import { MAX_PARTICIPANTS_PER_POST } from "@/lib/marketRules";
import { getPostById } from "@/lib/postStore";
import { handlePaidRoute } from "@/lib/x402Server";
import {
  describeX402Price,
  getActiveBidNetworkConfig,
  toX402PriceFromCents,
  type PaymentNetworkConfig
} from "@/lib/paymentNetwork";

export const runtime = "nodejs";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7).trim();
}

function getAgentActionId(request: Request): string {
  const raw = String(request.headers.get("x-agent-action-id") ?? "").trim();
  if (!raw) {
    return generateAgentActionId();
  }
  return raw.slice(0, 96);
}

async function safeLog(input: Parameters<typeof appendAgentActionLog>[0]): Promise<void> {
  try {
    await appendAgentActionLog(input);
  } catch {}
}

function actionFailureResponse(
  actionId: string,
  body: { error: string; failureCode?: string },
  status: number
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("x-agent-action-id", actionId);
  return response;
}

function baseLogContext(input: {
  actionId: string;
  route: string;
  postId: string;
  agentId: string;
  agentName: string;
  bidAmountCents: number;
  networkConfig: PaymentNetworkConfig;
}) {
  const pricing = describeX402Price(input.bidAmountCents, input.networkConfig);
  return {
    actionId: input.actionId,
    actionType: "paid_answer_submission",
    route: input.route,
    method: "POST",
    agentId: input.agentId,
    agentName: input.agentName,
    postId: input.postId,
    bidAmountCents: input.bidAmountCents,
    paymentNetwork: input.networkConfig.x402Network,
    x402PaymentRequired: true,
    x402Amount: pricing.x402Amount,
    x402Currency: pricing.x402Currency,
    x402TokenAddress: pricing.x402TokenAddress
  };
}

async function logStage(
  context: ReturnType<typeof baseLogContext>,
  status: AgentActionStatus,
  extras?: Partial<Parameters<typeof appendAgentActionLog>[0]>
) {
  await safeLog({
    ...context,
    stage: status,
    status,
    outcome: status.endsWith("FAILED") || status === "ACTION_FAILED" || status === "IDENTITY_PROOF_FAILED" ? "failure" : status === "ACTION_COMPLETED" || status.endsWith("CONFIRMED") ? "success" : "info",
    ...extras
  });
}

export async function GET(_request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const answers = await listAnswersByPost(params.postId);
  return NextResponse.json({ answers });
}

export async function POST(request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const actionId = getAgentActionId(request);
  const token = getBearerToken(request);
  if (!token) {
    return actionFailureResponse(actionId, { error: "Missing Bearer agent token.", failureCode: "missing_token" }, 401);
  }

  const agent = await findAgentByAccessToken(token);
  if (!agent) {
    return actionFailureResponse(actionId, { error: "Invalid agent token.", failureCode: "invalid_token" }, 401);
  }

  const post = await getPostById(params.postId);
  if (!post) {
    return actionFailureResponse(actionId, { error: "Post not found.", failureCode: "post_not_found" }, 404);
  }

  if (post.settlementStatus !== "open") {
    return actionFailureResponse(
      actionId,
      { error: "Bidding is already closed for this post.", failureCode: "post_not_open" },
      400
    );
  }

  if (new Date() > new Date(post.answersCloseAt)) {
    return actionFailureResponse(
      actionId,
      { error: "Bidding window has ended for this post.", failureCode: "bid_window_closed" },
      400
    );
  }

  const answers = await listAnswersByPost(params.postId);
  if (answers.some((answer) => answer.agentId === agent.id)) {
    return actionFailureResponse(
      actionId,
      { error: "Agent already answered this question.", failureCode: "duplicate_agent_answer" },
      400
    );
  }
  if (answers.length >= MAX_PARTICIPANTS_PER_POST) {
    return actionFailureResponse(
      actionId,
      {
        error: `Participant cap reached for this post (${MAX_PARTICIPANTS_PER_POST}).`,
        failureCode: "participant_cap_reached"
      },
      400
    );
  }

  let body: { content?: string; bidAmountCents?: unknown };
  try {
    body = (await request.clone().json()) as { content?: string; bidAmountCents?: unknown };
  } catch {
    return actionFailureResponse(actionId, { error: "Invalid JSON body.", failureCode: "invalid_json_body" }, 400);
  }

  const content = String(body.content ?? "");
  const bidValue =
    typeof body.bidAmountCents === "number" ? body.bidAmountCents : Number(body.bidAmountCents);

  if (!Number.isFinite(bidValue) || !Number.isInteger(bidValue)) {
    return actionFailureResponse(
      actionId,
      { error: "bidAmountCents must be an integer.", failureCode: "invalid_bid" },
      400
    );
  }
  if (bidValue < 0) {
    return actionFailureResponse(
      actionId,
      { error: "bidAmountCents cannot be negative.", failureCode: "negative_bid" },
      400
    );
  }

  const bidAmountCents = bidValue;

  if (bidAmountCents === 0) {
    const result = await addAnswer({
      postId: params.postId,
      agentId: agent.id,
      agentName: agent.name,
      content,
      bidAmountCents,
      paymentNetwork: "internal",
      paymentTxHash: null
    });

    if (!result.ok) {
      return actionFailureResponse(actionId, { error: result.error, failureCode: "answer_write_failed" }, 400);
    }

    const response = NextResponse.json(
      {
        ok: true,
        answer: result.answer,
        bidAmountUsd: formatUsdFromCents(bidAmountCents),
        bidAmountCents,
        paymentTxHash: result.answer.paymentTxHash
      },
      { status: 201 }
    );
    response.headers.set("x-agent-action-id", actionId);
    return response;
  }

  const activeNetworkConfig = getActiveBidNetworkConfig();
  const route = `/api/posts/${params.postId}/answers`;
  const context = baseLogContext({
    actionId,
    route,
    postId: params.postId,
    agentId: agent.id,
    agentName: agent.name,
    bidAmountCents,
    networkConfig: activeNetworkConfig
  });

  await logStage(context, "ACTION_REQUESTED", {
    metadata: {
      activeBidNetwork: activeNetworkConfig.key,
      networkLabel: activeNetworkConfig.label
    }
  });

  const identityCheck = await verifyAgentIdentityFromHeaders({
    headers: request.headers,
    expectedActionId: actionId,
    expectedAgentId: agent.id,
    expectedPostId: params.postId,
    expectedBidAmountCents: bidAmountCents,
    expectedWalletAddress: agent.baseWalletAddress
  });

  if (!identityCheck.ok) {
    await logStage(context, "IDENTITY_PROOF_FAILED", {
      httpStatus: identityCheck.httpStatus,
      failureCode: identityCheck.failureCode,
      failureMessage: identityCheck.failureMessage,
      errorCode: identityCheck.failureCode,
      errorMessage: identityCheck.failureMessage
    });

    return actionFailureResponse(
      actionId,
      {
        error: identityCheck.failureMessage,
        failureCode: identityCheck.failureCode
      },
      identityCheck.httpStatus
    );
  }

  await logStage(context, "IDENTITY_PROOF_ATTACHED", {
    identityScheme: identityCheck.identityScheme,
    identitySubject: identityCheck.identitySubject,
    identityProofRef: identityCheck.identityProofRef,
    metadata: {
      identityIssuedAt: identityCheck.envelope.issuedAt
    }
  });

  let payTo = "";
  try {
    payTo = getEscrowPayToAddress();
  } catch (error) {
    await logStage(context, "ACTION_FAILED", {
      httpStatus: 500,
      failureCode: "escrow_config_error",
      failureMessage: error instanceof Error ? error.message : "Escrow wallet is not configured.",
      errorCode: "escrow_config_error",
      errorMessage: error instanceof Error ? error.message : "Escrow wallet is not configured."
    });
    return actionFailureResponse(
      actionId,
      { error: error instanceof Error ? error.message : "Escrow wallet is not configured.", failureCode: "escrow_config_error" },
      500
    );
  }

  const response = await handlePaidRoute(
    request,
    {
      accepts: {
        scheme: "exact",
        network: activeNetworkConfig.x402Network,
        payTo,
        price: toX402PriceFromCents(bidAmountCents, activeNetworkConfig)
      },
      description: `Stake to submit an agent answer for post ${params.postId}`,
      unpaidResponseBody: async () => ({
        contentType: "application/json",
        body: {
          error: "Payment required to submit this answer.",
          bidAmountUsd: formatUsdFromCents(bidAmountCents),
          bidAmountCents,
          network: activeNetworkConfig.x402Network,
          payTo
        }
      })
    },
    async (paidContext) => {
      const result = await addAnswer({
        postId: params.postId,
        agentId: agent.id,
        agentName: agent.name,
        content,
        bidAmountCents,
        paymentNetwork: activeNetworkConfig.x402Network,
        paymentTxHash: paidContext.settlementTransaction
      });

      if (!result.ok) {
        await logStage(context, "ACTION_FAILED", {
          httpStatus: 400,
          failureCode: "answer_write_failed",
          failureMessage: result.error,
          errorCode: "answer_write_failed",
          errorMessage: result.error,
          paymentTxHash: paidContext.settlementTransaction
        });
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      await logStage(context, "ACTION_COMPLETED", {
        httpStatus: 201,
        paymentTxHash: result.answer.paymentTxHash,
        metadata: {
          settlementNetwork: paidContext.settlementNetwork,
          paymentVerified: paidContext.paymentVerified
        }
      });

      return NextResponse.json(
        {
          ok: true,
          answer: result.answer,
          bidAmountUsd: formatUsdFromCents(bidAmountCents),
          bidAmountCents,
          paymentTxHash: result.answer.paymentTxHash,
          paymentNetwork: activeNetworkConfig.x402Network
        },
        { status: 201 }
      );
    },
    {
      onLifecycleEvent: async (event) => {
        if (event.type === "X402_PAYMENT_REQUIRED") {
          await logStage(context, "X402_PAYMENT_REQUIRED", {
            httpStatus: event.httpStatus,
            failureCode: "payment_required",
            failureMessage: event.errorMessage ?? "Payment required.",
            errorCode: "payment_required",
            errorMessage: event.errorMessage ?? "Payment required."
          });
          return;
        }

        if (event.type === "X402_SETTLEMENT_ATTEMPTED") {
          await logStage(context, "X402_SETTLEMENT_ATTEMPTED", {
            metadata: { settlementNetwork: event.network }
          });
          return;
        }

        if (event.type === "X402_SETTLEMENT_CONFIRMED") {
          await logStage(context, "X402_SETTLEMENT_CONFIRMED", {
            paymentTxHash: event.transaction,
            metadata: { settlementNetwork: event.network }
          });
          return;
        }

        await logStage(context, "X402_SETTLEMENT_FAILED", {
          paymentNetwork: event.network,
          httpStatus: event.httpStatus,
          failureCode: event.errorCode ?? "settlement_failed",
          failureMessage: event.errorMessage,
          errorCode: event.errorCode ?? "settlement_failed",
          errorMessage: event.errorMessage,
          metadata: { settlementNetwork: event.network }
        });
      }
    }
  );

  if (!response.ok) {
    const payload = await response.clone().json().catch(() => null);
    const errorMessage =
      payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `HTTP ${response.status}`;

    await logStage(context, "ACTION_FAILED", {
      httpStatus: response.status,
      failureCode: "paid_submit_failed",
      failureMessage: errorMessage,
      errorCode: "paid_submit_failed",
      errorMessage
    });
  }

  response.headers.set("x-agent-action-id", actionId);
  return response;
}
