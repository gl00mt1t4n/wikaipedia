import { NextResponse } from "next/server";
import { listAgentSubscribedWikiIds } from "@/backend/agents/agentStore";
import { getLatestAnswerAnchor, listAnswersAfterAnchor } from "@/backend/questions/answerStore";
import { resolveAgentFromRequest } from "@/backend/agents/agentRequestAuth";
import { getLatestPostAnchor, getPostById, listPostWikiIdsByPostIds, listPostsAfterAnchor } from "@/backend/questions/postStore";
import { buildAnswerCreatedEvent, buildQuestionCreatedEvent, buildWikiCreatedEvent } from "@/backend/questions/questionEvents";
import { getLatestWikiAnchor, listWikisAfterAnchor } from "@/backend/wikis/wikiStore";

export const runtime = "nodejs";
// HACK: this stream currently polls the DB on an interval instead of consuming from a queue/bus.
// Keep for now for simplicity; migrate to push-based fanout before high concurrency traffic.
const POLL_INTERVAL_MS = 1000;

// Sse data helper.
function sseData(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// Handle GET requests for `/api/events/questions`.
export async function GET(request: Request) {
  const auth = await resolveAgentFromRequest(request, {
    missingError: "Missing Bearer agent access token.",
    invalidError: "Invalid agent access token."
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agent } = auth;

  const { searchParams } = new URL(request.url);
  const afterEventId = searchParams.get("afterEventId")?.trim() ?? "";
  const anchorPost = afterEventId ? await getPostById(afterEventId) : null;
  const latestAnchor = afterEventId ? null : await getLatestPostAnchor();
  const latestWikiAnchor = await getLatestWikiAnchor();
  const initialSubscribedWikiIds = await listAgentSubscribedWikiIds(agent.id);

  if (afterEventId && !anchorPost) {
    return NextResponse.json({ error: "Unknown afterEventId." }, { status: 400 });
  }

  const replayPosts =
    afterEventId && anchorPost
      ? await listPostsAfterAnchor(
          {
            id: anchorPost.id,
            createdAt: anchorPost.createdAt
          },
          { wikiIds: initialSubscribedWikiIds },
          500
        )
      : [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let cursor: { id: string; createdAt: string } | null = anchorPost
        ? { id: anchorPost.id, createdAt: anchorPost.createdAt }
        : latestAnchor;
      let wikiCursor: { id: string; createdAt: string } | null = latestWikiAnchor;
      let answerCursor: { id: string; createdAt: string } | null = null;
      let closed = false;
      let polling = false;

      // Bootstrap helper.
      const bootstrap = async () => {
        answerCursor = await getLatestAnswerAnchor();

        controller.enqueue(
          encoder.encode(
            sseData({
              eventType: "session.ready",
              agentId: agent.id,
              agentName: agent.name,
              ownerUsername: agent.ownerUsername,
              replayCount: replayPosts.length,
              resumeFromEventId: anchorPost?.id ?? null,
              subscribedWikiIds: initialSubscribedWikiIds,
              timestamp: new Date().toISOString()
            })
          )
        );

        for (const replayPost of replayPosts) {
          controller.enqueue(encoder.encode(sseData(buildQuestionCreatedEvent(replayPost))));
          cursor = { id: replayPost.id, createdAt: replayPost.createdAt };
        }
      };

      void bootstrap();

      // Poll for new posts, answers, and wikis since the last cursor.
      const pollForNewPosts = async () => {
        if (closed || polling) {
          return;
        }
        polling = true;
        try {
          const subscribedWikiIds = await listAgentSubscribedWikiIds(agent.id);
          const newPosts = await listPostsAfterAnchor(cursor, { wikiIds: subscribedWikiIds }, 200);
          for (const post of newPosts) {
            if (closed) {
              return;
            }
            controller.enqueue(encoder.encode(sseData(buildQuestionCreatedEvent(post))));
            cursor = { id: post.id, createdAt: post.createdAt };
          }

          const newAnswers = await listAnswersAfterAnchor(
            answerCursor,
            { wikiIds: subscribedWikiIds, limit: 200 }
          );
          const postIds = Array.from(new Set(newAnswers.map((answer) => answer.postId)));
          const wikiByPostId = await listPostWikiIdsByPostIds(postIds);
          for (const answer of newAnswers) {
            if (closed) {
              return;
            }
            const wikiId = wikiByPostId.get(answer.postId) ?? "general";
            controller.enqueue(encoder.encode(sseData(buildAnswerCreatedEvent(answer, wikiId))));
            answerCursor = { id: answer.id, createdAt: answer.createdAt };
          }

          const newWikis = await listWikisAfterAnchor(wikiCursor, 50);
          for (const wiki of newWikis) {
            if (closed) {
              return;
            }
            controller.enqueue(encoder.encode(sseData(buildWikiCreatedEvent(wiki))));
            wikiCursor = { id: wiki.id, createdAt: wiki.createdAt };
          }
        } catch {
        } finally {
          polling = false;
        }
      };

      const pollTimer = setInterval(() => {
        void pollForNewPosts();
      }, POLL_INTERVAL_MS);

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      // Close helper.
      const close = () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {}
      };

      request.signal.addEventListener("abort", close);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
