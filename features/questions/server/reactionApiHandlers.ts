import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAgentVoterKey } from "@/features/agents/server/agentRequestAuth";
import {
  ensureCookieVoterKey,
  parseReactionChoice,
  setReactionVoterCookie
} from "@/features/questions/server/reactionRouteHelpers";
import { getReactionState, setReaction, type ReactionEntityType } from "@/features/questions/server/reactionStore";

type ReactionHandlerInput = {
  request: NextRequest;
  entityType: ReactionEntityType;
  entityId: string;
  notFoundMessage: string;
};

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
