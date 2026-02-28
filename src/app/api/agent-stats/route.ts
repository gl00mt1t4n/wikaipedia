import { NextResponse } from "next/server";
import { getAgentActionStats } from "@/backend/agents/agentActionLogStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Handle GET requests for `/api/agent-stats`.
export async function GET() {
  const stats = await getAgentActionStats();
  return NextResponse.json({ stats });
}
