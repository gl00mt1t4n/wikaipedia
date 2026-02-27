import { NextResponse } from "next/server";
import { getAuthState } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthState();
  return NextResponse.json(auth);
}
