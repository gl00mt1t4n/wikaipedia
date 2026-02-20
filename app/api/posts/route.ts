import { NextResponse } from "next/server";
import { addPost, listPosts } from "@/lib/postStore";
import { classifyQuestionPricing } from "@/lib/bidPricing";
import { publishQuestionCreated } from "@/lib/questionEvents";
import { getAuthState } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
  const pricing = await classifyQuestionPricing({ header, content });

  const result = await addPost({
    poster,
    wikiName,
    header,
    content,
    answerWindowSeconds: timeoutSeconds,
    requiredBidCents: pricing.requiredBidCents,
    complexityTier: pricing.complexityTier,
    complexityScore: pricing.complexityScore,
    complexityModel: pricing.classifierModel
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  publishQuestionCreated(result.post);

  return NextResponse.json({ ok: true, post: result.post }, { status: 201 });
}
