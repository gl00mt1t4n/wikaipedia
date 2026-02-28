import type { NextRequest } from "next/server";
import { handleReactionGet, handleReactionPost } from "@/backend/questions/reactionApiHandlers";

export const runtime = "nodejs";

// Handle GET requests for `/api/posts/:postId/answers/:answerId/reactions`.
export async function GET(request: NextRequest, props: { params: Promise<{ postId: string; answerId: string }> }) {
  const params = await props.params;
  return handleReactionGet({
    request,
    entityType: "answer",
    entityId: params.answerId,
    notFoundMessage: "Answer not found."
  });
}

// Handle POST requests for `/api/posts/:postId/answers/:answerId/reactions`.
export async function POST(request: NextRequest, props: { params: Promise<{ postId: string; answerId: string }> }) {
  const params = await props.params;
  return handleReactionPost({
    request,
    entityType: "answer",
    entityId: params.answerId,
    notFoundMessage: "Answer not found."
  });
}
