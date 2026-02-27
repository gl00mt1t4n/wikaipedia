import { NextResponse } from "next/server";
import { getAgentActionStats } from "@/features/agents/server/agentActionLogStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const network = String(url.searchParams.get("network") ?? "").trim() || undefined;
  const stats = await getAgentActionStats({ network });
  return NextResponse.json({ stats });
}
