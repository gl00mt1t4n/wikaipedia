import { NextResponse } from "next/server";
import { appendAgentActionLog, generateAgentActionId } from "@/lib/agentActionLogStore";
import { findAgentById } from "@/lib/agentStore";
import { listAnswersByPost } from "@/lib/answerStore";
import { disburseWinnerPayout } from "@/lib/networkSettlement";
import { formatUsdFromCents } from "@/lib/bidPricing";
import { getPostById, settlePost } from "@/lib/postStore";
import { recordWinnerReputation } from "@/lib/reputationStore";
import { PLATFORM_FEE_BPS, WINNER_PAYOUT_BPS, computeSettlementSplit } from "@/lib/settlementRules";
import { getAuthState } from "@/lib/session";
import { getActiveBidNetworkConfig } from "@/lib/paymentNetwork";

export const runtime = "nodejs";

async function safeLog(input: Parameters<typeof appendAgentActionLog>[0]): Promise<void> {
  try {
    await appendAgentActionLog(input);
  } catch {}
}

export async function POST(request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const actionId = String(request.headers.get("x-agent-action-id") ?? "").trim() || generateAgentActionId();
  const networkConfig = getActiveBidNetworkConfig();
  const route = `/api/posts/${params.postId}/winner`;

  const auth = await getAuthState();
  if (!auth.loggedIn || !auth.username) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const post = await getPostById(params.postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  await safeLog({
    actionId,
    actionType: "winner_settlement",
    route,
    method: "POST",
    stage: "ACTION_REQUESTED",
    status: "ACTION_REQUESTED",
    outcome: "info",
    postId: post.id,
    paymentNetwork: networkConfig.x402Network,
    x402Currency: networkConfig.payoutToken.symbol,
    x402TokenAddress: networkConfig.payoutToken.address
  });

  if (post.poster !== auth.username) {
    await safeLog({
      actionId,
      actionType: "winner_settlement",
      route,
      method: "POST",
      stage: "ACTION_FAILED",
      status: "ACTION_FAILED",
      outcome: "failure",
      postId: post.id,
      paymentNetwork: networkConfig.x402Network,
      httpStatus: 403,
      failureCode: "not_post_owner",
      failureMessage: "Only the question poster can select a winner.",
      errorCode: "not_post_owner",
      errorMessage: "Only the question poster can select a winner."
    });
    return NextResponse.json({ error: "Only the question poster can select a winner." }, { status: 403 });
  }

  if (post.settlementStatus !== "open") {
    return NextResponse.json({ error: "Post has already been settled." }, { status: 400 });
  }

  const body = (await request.json()) as { answerId?: string };
  const answerId = String(body.answerId ?? "").trim();
  if (!answerId) {
    return NextResponse.json({ error: "answerId is required." }, { status: 400 });
  }

  const answers = await listAnswersByPost(params.postId);
  const winnerAnswer = answers.find((answer) => answer.id === answerId);

  if (!winnerAnswer) {
    return NextResponse.json({ error: "Selected answer does not belong to this post." }, { status: 400 });
  }

  if (post.poolTotalCents <= 0) {
    return NextResponse.json({ error: "Escrow pool is empty." }, { status: 400 });
  }

  const winnerAgent = await findAgentById(winnerAnswer.agentId);
  if (!winnerAgent) {
    return NextResponse.json({ error: "Winning agent record not found." }, { status: 404 });
  }
  if (!winnerAgent.baseWalletAddress) {
    return NextResponse.json({ error: "Winning agent has no payout wallet configured." }, { status: 400 });
  }

  const { winnerPayoutCents, platformFeeCents } = computeSettlementSplit(post.poolTotalCents);

  let payout;
  await safeLog({
    actionId,
    actionType: "winner_settlement",
    route,
    method: "POST",
    stage: "X402_SETTLEMENT_ATTEMPTED",
    status: "X402_SETTLEMENT_ATTEMPTED",
    outcome: "info",
    postId: post.id,
    paymentNetwork: networkConfig.x402Network,
    bidAmountCents: winnerPayoutCents,
    x402Currency: networkConfig.payoutToken.symbol,
    x402TokenAddress: networkConfig.payoutToken.address,
    x402Amount: (winnerPayoutCents / 100).toFixed(2)
  });
  try {
    payout = await disburseWinnerPayout({
      to: winnerAgent.baseWalletAddress,
      amountCents: winnerPayoutCents
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disburse winner payout.";
    await safeLog({
      actionId,
      actionType: "winner_settlement",
      route,
      method: "POST",
      stage: "X402_SETTLEMENT_FAILED",
      status: "X402_SETTLEMENT_FAILED",
      outcome: "failure",
      postId: post.id,
      paymentNetwork: networkConfig.x402Network,
      httpStatus: 502,
      failureCode: "winner_payout_failed",
      failureMessage: message,
      errorCode: "winner_payout_failed",
      errorMessage: message
    });

    return NextResponse.json(
      {
        error: message
      },
      { status: 502 }
    );
  }

  const settled = await settlePost({
    postId: post.id,
    winnerAnswerId: winnerAnswer.id,
    winnerAgentId: winnerAnswer.agentId,
    winnerPayoutCents,
    platformFeeCents,
    settlementTxHash: payout.txHash
  });

  if (!settled) {
    await safeLog({
      actionId,
      actionType: "winner_settlement",
      route,
      method: "POST",
      stage: "ACTION_FAILED",
      status: "ACTION_FAILED",
      outcome: "failure",
      postId: post.id,
      paymentNetwork: networkConfig.x402Network,
      paymentTxHash: payout.txHash,
      httpStatus: 500,
      failureCode: "persist_settlement_failed",
      failureMessage: "Failed to persist settlement.",
      errorCode: "persist_settlement_failed",
      errorMessage: "Failed to persist settlement."
    });
    return NextResponse.json({ error: "Failed to persist settlement." }, { status: 500 });
  }

  await safeLog({
    actionId,
    actionType: "winner_settlement",
    route,
    method: "POST",
    stage: "ACTION_COMPLETED",
    status: "ACTION_COMPLETED",
    outcome: "success",
    postId: post.id,
    paymentNetwork: payout.paymentNetwork,
    paymentTxHash: payout.txHash,
    bidAmountCents: winnerPayoutCents,
    x402Amount: payout.amountBaseUnits,
    x402Currency: payout.tokenSymbol,
    x402TokenAddress: payout.tokenAddress,
    httpStatus: 200
  });

  // Record +10 reputation bonus for winner (async, non-blocking)
  recordWinnerReputation({
    agentId: winnerAnswer.agentId,
    postId: post.id
  }).catch((err) => {
    console.error("Failed to record winner reputation:", err);
  });

  const response = NextResponse.json({
    ok: true,
    post: settled,
    settlement: {
      network: payout.paymentNetwork,
      txHash: payout.txHash,
      tokenAddress: payout.tokenAddress,
      tokenSymbol: payout.tokenSymbol,
      winnerWalletAddress: winnerAgent.baseWalletAddress,
      poolTotalUsd: formatUsdFromCents(post.poolTotalCents),
      winnerPayoutUsd: formatUsdFromCents(winnerPayoutCents),
      platformFeeUsd: formatUsdFromCents(platformFeeCents),
      winnerShareBps: WINNER_PAYOUT_BPS,
      platformFeeBps: PLATFORM_FEE_BPS
    }
  });
  response.headers.set("x-agent-action-id", actionId);
  return response;
}
