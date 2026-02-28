import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAgentVoterKey } from "@/backend/agents/agentRequestAuth";
import { createVoterKey, getReactionState, setReaction, type ReactionChoice, type ReactionEntityType } from "@/backend/questions/reactionStore";

const VOTER_COOKIE = "wk_voter";

// Parse reaction choice into a typed value.
function parseReactionChoice(value: unknown): ReactionChoice | null {
  if (value === "like" || value === "dislike") {
    return value;
  }
  return null;
}

// Ensure cookie voter key exists before continuing.
function ensureCookieVoterKey(request: NextRequest): {
  voterKey: string;
  needsSetCookie: boolean;
} {
  const existing = request.cookies.get(VOTER_COOKIE)?.value?.trim();
  if (existing) {
    return { voterKey: existing, needsSetCookie: false };
  }
  return { voterKey: createVoterKey(), needsSetCookie: true };
}

// Update reaction voter cookie with validated input.
function setReactionVoterCookie(response: NextResponse, voterKey: string): void {
  response.cookies.set(VOTER_COOKIE, voterKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

type ReactionHandlerInput = {
  request: NextRequest;
  entityType: ReactionEntityType;
  entityId: string;
  notFoundMessage: string;
};

// Handle reaction get flow.
export async function handleReactionGet(input: ReactionHandlerInput) {
  const agentAuth = await resolveAgentVoterKey(input.request);
  if (agentAuth && !agentAuth.ok) {
    return NextResponse.json({ error: agentAuth.error }, { status: agentAuth.status });
  }

  const cookieVoter = ensureCookieVoterKey(input.request);
  const voterKey = agentAuth?.ok ? agentAuth.voterKey : cookieVoter.voterKey;

  try {
    const state = await getReactionState({
      entityType: input.entityType,
      entityId: input.entityId,
      voterKey
    });
    const response = NextResponse.json({ ok: true, ...state });

    if (!agentAuth && cookieVoter.needsSetCookie) {
      setReactionVoterCookie(response, cookieVoter.voterKey);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Entity not found.") {
      return NextResponse.json({ error: input.notFoundMessage }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to load reactions.";
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "development" ? message : "Failed to load reactions."
      },
      { status: 500 }
    );
  }
}

// Handle reaction post flow.
export async function handleReactionPost(input: ReactionHandlerInput) {
  const agentAuth = await resolveAgentVoterKey(input.request);
  if (agentAuth && !agentAuth.ok) {
    return NextResponse.json({ error: agentAuth.error }, { status: agentAuth.status });
  }

  const body = (await input.request.json().catch(() => null)) as { reaction?: unknown } | null;
  const reaction = parseReactionChoice(body?.reaction);
  if (!reaction) {
    return NextResponse.json({ error: "Reaction must be 'like' or 'dislike'." }, { status: 400 });
  }

  const cookieVoter = ensureCookieVoterKey(input.request);
  const voterKey = agentAuth?.ok ? agentAuth.voterKey : cookieVoter.voterKey;

  try {
    const state = await setReaction({
      entityType: input.entityType,
      entityId: input.entityId,
      voterKey,
      reaction
    });

    const response = NextResponse.json({ ok: true, ...state });

    if (!agentAuth && cookieVoter.needsSetCookie) {
      setReactionVoterCookie(response, cookieVoter.voterKey);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Entity not found.") {
      return NextResponse.json({ error: input.notFoundMessage }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update reaction.";
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "development" ? message : "Failed to update reaction."
      },
      { status: 500 }
    );
  }
}
