import { NextResponse } from "next/server";
import {
  generateAgentActionId,
} from "@/lib/agentActionLogStore";
import { findAgentByAccessToken } from "@/lib/agentStore";
import { appendAgentRuntimeLog, listAgentRuntimeLogs } from "@/lib/agentRuntimeLogStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7).trim();
}

function normalizeKind(level: "info" | "success" | "failure"): "positive" | "negative" | "neutral" {
  if (level === "success") return "positive";
  if (level === "failure") return "negative";
  return "neutral";
}

function eventTypeToEvent(eventType: string): string {
  return eventType.replace(/_/g, "-");
}

function messageFromEntry(entry: {
  message: string | null;
  errorMessage: string | null;
  payload: unknown;
  eventType: string;
}): string {
  if (entry.message) return entry.message;
  if (entry.errorMessage) return entry.errorMessage;
  const payload = entry.payload && typeof entry.payload === "object" ? (entry.payload as Record<string, unknown>) : {};
  const reason = typeof payload.reason === "string" ? payload.reason : "";
  if (reason) return reason;
  const gated = payload.gated && typeof payload.gated === "object" ? (payload.gated as Record<string, unknown>) : null;
  const gatedReason = gated && typeof gated.reason === "string" ? gated.reason : "";
  if (gatedReason) return gatedReason;
  const msg = typeof payload.message === "string" ? payload.message : "";
  if (msg) return msg;
  return eventTypeToEvent(entry.eventType);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 60);
  const expand = url.searchParams.get("expand") === "1";
  const postId = String(url.searchParams.get("postId") ?? "").trim() || undefined;
  const logsRaw = await listAgentRuntimeLogs({
    limit: expand ? Math.max(120, limit) : limit,
    postId,
    includeNeutral: expand || Boolean(postId)
  });

  const mapped = logsRaw.map((entry) => ({
    id: entry.id,
    ts: entry.createdAt,
    agent: entry.agentName ?? entry.agentId ?? "unknown-agent",
    event: eventTypeToEvent(entry.eventType),
    message: messageFromEntry({
      message: entry.message,
      errorMessage: null,
      payload: entry.payload,
      eventType: entry.eventType
    }),
    kind: normalizeKind(entry.level),
    postId: entry.postId
  }));

  const filtered = mapped.filter((entry) => {
    if (expand) return true;
    if (postId) {
      if (entry.event === "cognitive-decision") return true;
      if (entry.kind !== "neutral") return true;
      return false;
    }
    return entry.kind !== "neutral";
  });

  return NextResponse.json({ logs: filtered.slice(0, limit) });
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing Bearer agent token." }, { status: 401 });
  }
  const agent = await findAgentByAccessToken(token);
  if (!agent) {
    return NextResponse.json({ error: "Invalid agent token." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { type?: string; payload?: unknown; actionId?: string; postId?: string }
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const type = String(body.type ?? "event").trim() || "event";
  const payload = body.payload ?? {};
  const actionId = String(body.actionId ?? "").trim() || generateAgentActionId();
  const payloadObj =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : ({} as Record<string, unknown>);
  const postId = String(
    body.postId ??
      payloadObj.questionId ??
      payloadObj.postId ??
      (payloadObj.gated && typeof payloadObj.gated === "object"
        ? (payloadObj.gated as Record<string, unknown>).questionId
        : "") ??
      ""
  ).trim();

  const loweredType = type.toLowerCase();
  const inferredOutcome: "info" | "success" | "failure" = loweredType.includes("fail") || loweredType.includes("error")
    ? "failure"
    : loweredType.includes("success") || loweredType.includes("answered")
      ? "success"
      : "info";

  const errorMessage = typeof payloadObj.error === "string" ? payloadObj.error : null;
  const message = typeof payloadObj.reason === "string"
    ? payloadObj.reason
    : typeof payloadObj.message === "string"
      ? payloadObj.message
      : errorMessage;

  await appendAgentRuntimeLog({
    actionId,
    agentId: agent.id,
    agentName: agent.name,
    postId: postId || null,
    eventType: type.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64),
    level: inferredOutcome,
    message: message ? String(message).slice(0, 2000) : null,
    payload: payloadObj,
    source: "agent-runtime"
  });

  return NextResponse.json({ ok: true });
}
