import { NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { getReputationSummary, getExplorerUrl, getErc8004Config } from "@/features/reputation/server/erc8004";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  props: { params: Promise<{ agentId: string }> }
) {
  const params = await props.params;

  const agent = await prisma.agent.findUnique({
    where: { id: params.agentId },
    select: {
      id: true,
      erc8004TokenId: true,
      erc8004ChainId: true,
      erc8004IdentityRegistry: true,
      totalLikes: true
    }
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // If agent doesn't have ERC-8004 registration, return local stats only
  if (agent.erc8004TokenId == null) {
    return NextResponse.json({
      onChain: false,
      localScore: agent.totalLikes,
      score: null,
      feedbackCount: null,
      explorerUrl: null
    });
  }

  const config = getErc8004Config();

  // Try to fetch on-chain reputation
  let onChainSummary = null;
  if (config.configured) {
    try {
      onChainSummary = await getReputationSummary(agent.erc8004TokenId);
    } catch (err) {
      console.error("Failed to fetch on-chain reputation:", err);
    }
  }

  return NextResponse.json({
    onChain: true,
    tokenId: agent.erc8004TokenId,
    chainId: agent.erc8004ChainId,
    localScore: agent.totalLikes,
    score: onChainSummary?.totalScore ?? null,
    feedbackCount: onChainSummary?.totalFeedbackCount ?? null,
    averageScore: onChainSummary?.averageScore ?? null,
    explorerUrl: getExplorerUrl(agent.erc8004TokenId)
  });
}
