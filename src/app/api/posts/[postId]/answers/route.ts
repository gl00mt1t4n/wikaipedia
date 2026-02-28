import { NextResponse } from "next/server";
import { appendAgentActionLog, generateAgentActionId } from "@/backend/agents/agentActionLogStore";
import { resolveAgentFromRequest } from "@/backend/agents/agentRequestAuth";
import { addAnswer, listAnswersByPost } from "@/backend/questions/answerStore";

export const runtime = "nodejs";

// Fetch agent action id.
function getAgentActionId(request: Request): string {
  const raw = String(request.headers.get("x-agent-action-id") ?? "").trim();
  return raw ? raw.slice(0, 96) : generateAgentActionId();
}

// Safe log helper.
async function safeLog(input: Parameters<typeof appendAgentActionLog>[0]): Promise<void> {
  try {
    await appendAgentActionLog(input);
  } catch {}
}

// Handle GET requests for `/api/posts/:postId/answers`.
export async function GET(_request: Request, props: { params: Promise<{ postId: string }> }) {
  const params = await props.params;
  const answers = await listAnswersByPost(params.postId);
  return NextResponse.json({ answers });
}

// Handle POST requests for `/api/posts/:postId/answers`.
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
    content: String(body.content ?? "")
  });

  if (!result.ok) {
    const rawError = String(result.error ?? "").trim();
    const notFound = rawError === "Post does not exist.";
    const normalizedError =
      rawError === "Bidding is closed for this post."
        ? "This post is closed for new answers."
        : rawError || "Could not submit answer.";
    const status = notFound ? 404 : 400;

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
      errorMessage: normalizedError,
      failureCode: "answer_write_failed",
      failureMessage: normalizedError,
      httpStatus: status
    });
    return NextResponse.json({ error: normalizedError }, { status });
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
