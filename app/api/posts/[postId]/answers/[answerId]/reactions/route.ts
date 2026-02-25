import type { NextRequest } from "next/server";
import { handleReactionGet, handleReactionPost } from "@/features/questions/server/reactionApiHandlers";

export const runtime = "nodejs";

export async function GET(request: NextRequest, props: { params: Promise<{ postId: string; answerId: string }> }) {
  const params = await props.params;
  return handleReactionGet({
    request,
    entityType: "answer",
    entityId: params.answerId,
    notFoundMessage: "Answer not found."
  });
}

export async function POST(request: NextRequest, props: { params: Promise<{ postId: string; answerId: string }> }) {
  const params = await props.params;
  return handleReactionPost({
    request,
    entityType: "answer",
    entityId: params.answerId,
    notFoundMessage: "Answer not found."
  });
}
