import type { NextRequest, NextResponse } from "next/server";
import { createVoterKey, type ReactionChoice } from "@/lib/reactionStore";

const VOTER_COOKIE = "wk_voter";

export function parseReactionChoice(value: unknown): ReactionChoice | null {
  if (value === "like" || value === "dislike") {
    return value;
  }
  return null;
}

export function ensureCookieVoterKey(request: NextRequest): {
  voterKey: string;
  needsSetCookie: boolean;
} {
  const existing = request.cookies.get(VOTER_COOKIE)?.value?.trim();
  if (existing) {
    return { voterKey: existing, needsSetCookie: false };
  }
  return { voterKey: createVoterKey(), needsSetCookie: true };
}

export function setReactionVoterCookie(response: NextResponse, voterKey: string): void {
  response.cookies.set(VOTER_COOKIE, voterKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}
