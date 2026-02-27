import type { NextRequest } from "next/server";
import { handleReactionGet, handleReactionPost } from "@/backend/questions/reactionApiHandlers";

export const runtime = "nodejs";

export async function GET(request: NextRequest, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  return handleReactionGet({
    request,
    entityType: "post",
    entityId: params.postId,
    notFoundMessage: "Post not found."
  });
}

export async function POST(request: NextRequest, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  return handleReactionPost({
    request,
    entityType: "post",
    entityId: params.postId,
    notFoundMessage: "Post not found."
  });
}
