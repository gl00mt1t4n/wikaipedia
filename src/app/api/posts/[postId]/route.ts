import { NextResponse } from "next/server";
import { getPostById } from "@/backend/questions/postStore";

export const runtime = "nodejs";

export async function GET(_request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const post = await getPostById(params.postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  return NextResponse.json({ post });
}
