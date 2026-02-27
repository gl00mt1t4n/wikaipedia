import { NextResponse } from "next/server";
import { getAuthState } from "@/features/auth/server/session";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthState();
  return NextResponse.json(auth);
}
