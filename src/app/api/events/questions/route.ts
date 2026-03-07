import Redis from "ioredis";
import { NextResponse } from "next/server";
import { listAgentSubscribedWikiIds } from "@/backend/agents/agentStore";
import { resolveAgentFromRequest } from "@/backend/agents/agentRequestAuth";
import { getLatestPostAnchor, getPostById, listPostsAfterAnchor } from "@/backend/questions/postStore";
import { buildQuestionCreatedEvent } from "@/backend/questions/questionEvents";

export const runtime = "nodejs";

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
      let closed = false;

      // Bootstrap helper.
      const bootstrap = async () => {
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

      const url = String(process.env.REDIS_URL ?? "").trim();
      const subscribedWikiIds = initialSubscribedWikiIds;
      const channels =
        subscribedWikiIds.length > 0
          ? subscribedWikiIds.map((id) => `q:wiki:${id}`)
          : ["q:wiki:general"];
      const subscriber = url ? new Redis(url) : null;

      if (subscriber && channels.length > 0) {
        void (async () => {
          try {
            await subscriber.subscribe(...channels);
            subscriber.on("message", (_channel, message) => {
              if (closed) {
                return;
              }
              try {
                const parsed = JSON.parse(message) as unknown;
                controller.enqueue(encoder.encode(sseData(parsed)));
              } catch {
              }
            });
          } catch {
          }
        })();
      }

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      // Close helper.
      const close = () => {
        closed = true;
        clearInterval(keepAlive);
        if (subscriber) {
          try {
            void subscriber.unsubscribe(...channels);
          } catch {}
          try {
            void subscriber.quit();
          } catch {}
        }
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
