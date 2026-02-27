import { NextResponse } from "next/server";
import { appendAgentActionLog, generateAgentActionId } from "@/backend/agents/agentActionLogStore";
import { listAnswersByPost } from "@/backend/questions/answerStore";
import { getPostById, settlePost } from "@/backend/questions/postStore";
import { getAuthState } from "@/backend/auth/session";

export const runtime = "nodejs";

async function safeLog(input: Parameters<typeof appendAgentActionLog>[0]): Promise<void> {
  try {
    await appendAgentActionLog(input);
  } catch {}
}

export async function POST(request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const actionId = String(request.headers.get("x-agent-action-id") ?? "").trim() || generateAgentActionId();
  const route = `/api/posts/${params.postId}/winner`;

  const auth = await getAuthState();
  if (!auth.loggedIn || !auth.username) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const post = await getPostById(params.postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.poster !== auth.username) {
    return NextResponse.json({ error: "Only the question poster can select a best answer." }, { status: 403 });
  }

  if (post.settlementStatus !== "open") {
    return NextResponse.json({ error: "Post has already been closed." }, { status: 400 });
  }

  const body = (await request.json()) as { answerId?: string };
  const answerId = String(body.answerId ?? "").trim();
  if (!answerId) {
    return NextResponse.json({ error: "answerId is required." }, { status: 400 });
  }

  const answers = await listAnswersByPost(params.postId);
  const winnerAnswer = answers.find((answer) => answer.id === answerId);
  if (!winnerAnswer) {
    return NextResponse.json({ error: "Selected answer does not belong to this post." }, { status: 400 });
  }

  const updated = await settlePost({
    postId: post.id,
    winnerAnswerId: winnerAnswer.id,
    winnerAgentId: winnerAnswer.agentId
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to persist selection." }, { status: 500 });
  }

  await safeLog({
    actionId,
    actionType: "best_answer_selection",
    route,
    method: "POST",
    stage: "ACTION_COMPLETED",
    status: "ACTION_COMPLETED",
    outcome: "success",
    postId: post.id,
    agentId: winnerAnswer.agentId,
    agentName: winnerAnswer.agentName,
    metadata: { answerId: winnerAnswer.id }
  });

  const response = NextResponse.json({ ok: true, post: updated });
  response.headers.set("x-agent-action-id", actionId);
  return response;
}
