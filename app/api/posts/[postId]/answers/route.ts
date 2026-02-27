import { NextResponse } from "next/server";
import { appendAgentActionLog, generateAgentActionId } from "@/features/agents/server/agentActionLogStore";
import { resolveAgentFromRequest } from "@/features/agents/server/agentRequestAuth";
import { addAnswer, listAnswersByPost } from "@/features/questions/server/answerStore";
import { getPostById } from "@/features/questions/server/postStore";
import { MAX_PARTICIPANTS_PER_POST } from "@/shared/market/marketRules";

export const runtime = "nodejs";

function getAgentActionId(request: Request): string {
  const raw = String(request.headers.get("x-agent-action-id") ?? "").trim();
  return raw ? raw.slice(0, 96) : generateAgentActionId();
}

async function safeLog(input: Parameters<typeof appendAgentActionLog>[0]): Promise<void> {
  try {
    await appendAgentActionLog(input);
  } catch {}
}

export async function GET(_request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const answers = await listAnswersByPost(params.postId);
  return NextResponse.json({ answers });
}

export async function POST(request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const actionId = getAgentActionId(request);
  const route = `/api/posts/${params.postId}/answers`;

  const auth = await resolveAgentFromRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { agent } = auth;
  await safeLog({
    actionId,
    actionType: "answer_submission",
    route,
    method: "POST",
    stage: "ACTION_REQUESTED",
    status: "ACTION_REQUESTED",
    outcome: "info",
    postId: params.postId,
    agentId: agent.id,
    agentName: agent.name
  });

  const post = await getPostById(params.postId);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.settlementStatus !== "open") {
    return NextResponse.json({ error: "This post is closed for new answers." }, { status: 400 });
  }

  if (new Date() > new Date(post.answersCloseAt)) {
    return NextResponse.json({ error: "Answer window has ended for this post." }, { status: 400 });
  }

  const answers = await listAnswersByPost(params.postId);
  if (answers.some((answer) => answer.agentId === agent.id)) {
    return NextResponse.json({ error: "Agent already answered this question." }, { status: 400 });
  }

  if (answers.length >= MAX_PARTICIPANTS_PER_POST) {
    return NextResponse.json({ error: `Participant cap reached for this post (${MAX_PARTICIPANTS_PER_POST}).` }, { status: 400 });
  }

  let body: { content?: string };
  try {
    body = (await request.clone().json()) as { content?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await addAnswer({
    postId: params.postId,
    agentId: agent.id,
    agentName: agent.name,
    content: String(body.content ?? ""),
    bidAmountCents: 0,
    paymentNetwork: "internal",
    paymentTxHash: null
  });

  if (!result.ok) {
    await safeLog({
      actionId,
      actionType: "answer_submission",
      route,
      method: "POST",
      stage: "ACTION_FAILED",
      status: "ACTION_FAILED",
      outcome: "failure",
      postId: params.postId,
      agentId: agent.id,
      agentName: agent.name,
      errorMessage: result.error,
      failureCode: "answer_write_failed",
      failureMessage: result.error,
      httpStatus: 400
    });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await safeLog({
    actionId,
    actionType: "answer_submission",
    route,
    method: "POST",
    stage: "ACTION_COMPLETED",
    status: "ACTION_COMPLETED",
    outcome: "success",
    postId: params.postId,
    agentId: agent.id,
    agentName: agent.name,
    httpStatus: 201
  });

  const response = NextResponse.json({ ok: true, answer: result.answer }, { status: 201 });
  response.headers.set("x-agent-action-id", actionId);
  return response;
}
