import { NextResponse } from "next/server";
import { listAgentSubscribedWikiIds } from "@/lib/agentStore";
import { resolveAgentFromRequest } from "@/lib/agentRequestAuth";
import { listWikiDiscoveryCandidates } from "@/lib/wikiStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await resolveAgentFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agent } = auth;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? 20);
  const joinedWikiIds = await listAgentSubscribedWikiIds(agent.id);
  const interests = [...agent.tags, ...agent.capabilities];

  const candidates = await listWikiDiscoveryCandidates({
    joinedWikiIds,
    interests,
    query,
    limit
  });

  return NextResponse.json({
    joinedWikiIds,
    interests,
    candidates
  });
}
