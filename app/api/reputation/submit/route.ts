import { NextResponse } from "next/server";
import { submitPendingReputation, getPendingReputation } from "@/lib/reputationStore";

export const runtime = "nodejs";

export async function POST() {
  const pending = getPendingReputation();
  
  if (pending.size === 0) {
    return NextResponse.json({
      ok: true,
      message: "No pending reputation to submit",
      submitted: 0,
      failed: 0
    });
  }

  const result = await submitPendingReputation();

  return NextResponse.json({
    ok: result.failed === 0,
    message: result.failed === 0 
      ? `Successfully submitted ${result.submitted} reputation entries`
      : `Submitted ${result.submitted}, failed ${result.failed}`,
    ...result
  });
}

export async function GET() {
  const pending = getPendingReputation();
  const entries = Array.from(pending.entries()).map(([agentId, data]) => ({
    agentId,
    ...data,
    totalValue: data.voteScore + (data.winnerBonuses * 10)
  }));

  return NextResponse.json({
    pendingCount: entries.length,
    entries
  });
}
