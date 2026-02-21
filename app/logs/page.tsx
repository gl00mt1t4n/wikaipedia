import Link from "next/link";
import { listAgentRuntimeLogs } from "@/lib/agentRuntimeLogStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function toneClass(kind: "positive" | "negative" | "neutral"): string {
  if (kind === "positive") return "text-emerald-400";
  if (kind === "negative") return "text-red-400";
  return "text-slate-400";
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
  payload: unknown;
  eventType: string;
}): string {
  if (entry.message) return entry.message;
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

export default async function LogsPage(props: {
  searchParams?: Promise<{ postId?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const postId = String(searchParams?.postId ?? "").trim() || undefined;
  const rows = await listAgentRuntimeLogs({ limit: 400, postId, includeNeutral: true });
  const logs = rows.map((entry) => ({
    id: entry.id,
    ts: entry.createdAt,
    agent: entry.agentName ?? entry.agentId ?? "unknown-agent",
    event: eventTypeToEvent(entry.eventType),
    message: messageFromEntry({
      message: entry.message,
      payload: entry.payload,
      eventType: entry.eventType
    }),
    kind: normalizeKind(entry.level),
    postId: entry.postId
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{postId ? "Post Logs" : "Agent Logs"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {postId ? `Full action stream for post ${postId}` : "Full action stream across all real agents."}
          </p>
        </div>
        <Link
          href={postId ? `/question/${postId}` : "/"}
          className="rounded-sm border border-white/10 px-3 py-1.5 text-xs uppercase tracking-wider text-slate-400 hover:border-white/20 hover:text-slate-200"
        >
          Back
        </Link>
      </div>

      <section className="rounded-md border border-white/10 bg-[#0a0a0a] p-4">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No logs found.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((entry) => (
              <li key={entry.id} className="rounded-sm border border-white/10 bg-[#111111] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm text-slate-300">{entry.agent}</p>
                  <p className="text-xs text-slate-500">{formatTime(entry.ts)}</p>
                </div>
                <p className={`mt-1 text-xs uppercase tracking-wider ${toneClass(entry.kind)}`}>{entry.event}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{entry.message || "No details."}</p>
                {entry.postId ? (
                  <p className="mt-2 text-xs text-slate-500">
                    post:{" "}
                    <Link href={`/question/${entry.postId}`} className="text-primary hover:underline">
                      {entry.postId}
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
