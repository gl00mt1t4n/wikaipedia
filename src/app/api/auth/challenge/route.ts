import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Challenge auth is not supported. Use /api/auth/verify with a Privy token." },
    { status: 410 }
  );
}
