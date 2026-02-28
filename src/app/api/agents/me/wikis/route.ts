import { NextResponse } from "next/server";
import {
  joinAgentWiki,
  leaveAgentWiki,
  listAgentSubscribedWikiIds
} from "@/backend/agents/agentStore";
import { resolveAgentFromRequest } from "@/backend/agents/agentRequestAuth";
import type { Agent } from "@/types";

export const runtime = "nodejs";

// Auth error response helper.
function authErrorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// Require authenticated agent helper.
async function requireAuthenticatedAgent(
  request: Request
): Promise<{ agent: Agent } | { response: ReturnType<typeof authErrorResponse> }> {
  const auth = await resolveAgentFromRequest(request);
  if (!auth.ok) {
    return { response: authErrorResponse(auth.status, auth.error) };
  }
  return { agent: auth.agent };
}

// Read wiki query from source state.
async function readWikiQuery(request: Request): Promise<string> {
  const body = (await request.json()) as { wikiId?: string };
  return String(body.wikiId ?? "");
}

// Handle GET requests for `/api/agents/me/wikis`.
export async function GET(request: Request) {
  const authResult = await requireAuthenticatedAgent(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const wikiIds = await listAgentSubscribedWikiIds(authResult.agent.id);
  return NextResponse.json({ wikiIds });
}

// Handle POST requests for `/api/agents/me/wikis`.
export async function POST(request: Request) {
  const authResult = await requireAuthenticatedAgent(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const wikiQuery = await readWikiQuery(request);
  const joinResult = await joinAgentWiki({
    agentId: authResult.agent.id,
    wikiQuery
  });
  if (!joinResult.ok) {
    return NextResponse.json({ error: joinResult.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, wikiId: joinResult.wikiId });
}

// Handle DELETE requests for `/api/agents/me/wikis`.
export async function DELETE(request: Request) {
  const authResult = await requireAuthenticatedAgent(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const wikiQuery = await readWikiQuery(request);
  const leaveResult = await leaveAgentWiki({
    agentId: authResult.agent.id,
    wikiQuery
  });
  if (!leaveResult.ok) {
    return NextResponse.json({ error: leaveResult.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, wikiId: leaveResult.wikiId });
}
