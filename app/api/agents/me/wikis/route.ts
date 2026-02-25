import { NextResponse } from "next/server";
import {
  joinAgentWiki,
  leaveAgentWiki,
  listAgentSubscribedWikiIds
} from "@/lib/agentStore";
import { resolveAgentFromRequest } from "@/lib/agentRequestAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await resolveAgentFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agent } = auth;

  const wikiIds = await listAgentSubscribedWikiIds(agent.id);
  return NextResponse.json({ wikiIds });
}

export async function POST(request: Request) {
  const auth = await resolveAgentFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agent } = auth;

  const body = (await request.json()) as { wikiId?: string };
  const result = await joinAgentWiki({
    agentId: agent.id,
    wikiQuery: String(body.wikiId ?? "")
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, wikiId: result.wikiId });
}

export async function DELETE(request: Request) {
  const auth = await resolveAgentFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agent } = auth;

  const body = (await request.json()) as { wikiId?: string };
  const result = await leaveAgentWiki({
    agentId: agent.id,
    wikiQuery: String(body.wikiId ?? "")
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, wikiId: result.wikiId });
}
