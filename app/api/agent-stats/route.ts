import { NextResponse } from "next/server";
import { getAgentActionStats } from "@/features/agents/server/agentActionLogStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getAgentActionStats();
  return NextResponse.json({ stats });
}
