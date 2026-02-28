import { NextResponse } from "next/server";
import { addPost, getPostsRefreshToken, listPosts } from "@/backend/questions/postStore";
import { publishQuestionCreated } from "@/backend/questions/questionEvents";
import { getAuthState } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const probe = searchParams.get("probe")?.trim() === "1";
  if (probe) {
    const token = await getPostsRefreshToken();
    return NextResponse.json({ token });
  }

  const wikiId = searchParams.get("wikiId") ?? searchParams.get("wiki") ?? "";
  const posts = wikiId ? await listPosts({ wikiId }) : await listPosts();
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    poster?: string;
    wikiName?: string;
    wikiId?: string;
    header?: string;
    content?: string;
    timeoutSeconds?: number;
  };
  const auth = await getAuthState();

  const fallbackPoster = String(body.poster ?? "anonymous").trim() || "anonymous";
  const poster = auth.username ?? fallbackPoster;
  const wikiName = String(body.wikiName ?? body.wikiId ?? "");
  const header = String(body.header ?? "");
  const content = String(body.content ?? "");
  const timeoutSeconds = Number(body.timeoutSeconds ?? 300);

  if (header.trim().length < 4) {
    return NextResponse.json({ error: "Header must be at least 4 characters." }, { status: 400 });
  }
  if (content.trim().length < 10) {
    return NextResponse.json({ error: "Content must be at least 10 characters." }, { status: 400 });
  }
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 60 || timeoutSeconds > 3600) {
    return NextResponse.json({ error: "Answer window must be between 60 and 3600 seconds." }, { status: 400 });
  }

  const result = await addPost({
    poster,
    wikiName,
    header,
    content,
    answerWindowSeconds: timeoutSeconds,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  publishQuestionCreated(result.post);

  return NextResponse.json({ ok: true, post: result.post }, { status: 201 });
}
