import { NextResponse } from "next/server";
import { getPostById, getPostRefreshToken } from "@/backend/questions/postStore";

export const runtime = "nodejs";

// Handle GET requests for `/api/posts/:postId`.
export async function GET(request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const probe = searchParams.get("probe")?.trim() === "1";

  if (probe) {
    const token = await getPostRefreshToken(params.postId);
    if (!token) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    return NextResponse.json({ token });
  }

  const post = await getPostById(params.postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  return NextResponse.json({ post });
}
