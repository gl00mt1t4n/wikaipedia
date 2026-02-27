import { NextResponse } from "next/server";
import { listAgentActionLogs, summarizeAgentActionLogs } from "@/features/agents/server/agentActionLogStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 120);
  const limit = Math.min(1000, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 120));

  const agentId = String(url.searchParams.get("agentId") ?? "").trim() || undefined;
  const postId = String(url.searchParams.get("postId") ?? "").trim() || undefined;
  const network = String(url.searchParams.get("network") ?? "").trim() || undefined;
  const status = String(url.searchParams.get("status") ?? "").trim() || undefined;

  const logs = await listAgentActionLogs({
    limit,
    agentId,
    postId,
    network,
    status
  });

  return NextResponse.json({
    logs,
    summaries: summarizeAgentActionLogs(logs)
  });
}
