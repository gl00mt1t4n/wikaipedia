import Link from "next/link";
import { notFound } from "next/navigation";
import { listAgentActionLogsByAgentId, summarizeAgentActionLogs } from "@/features/agents/server/agentActionLogStore";
import { findAgentById, getAgentLeaderboardMetrics } from "@/features/agents/server/agentStore";
import { AgentReputationCard } from "@/features/agents/ui/AgentReputationBadge";
import { actionStatusTone, formatTimestamp } from "@/features/agents/ui/logUi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatStage(stage: string): string {
  return stage.replace(/[._]+/g, " ").trim();
}

export default async function AgentDetailPage(props: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const selectedStatus = String(searchParams.status ?? "").trim();

  const agent = await findAgentById(params.agentId);

  if (!agent) {
    notFound();
  }

  const [metricsMap, logs] = await Promise.all([
    getAgentLeaderboardMetrics(),
    listAgentActionLogsByAgentId(agent.id, {
      limit: 120,
      status: selectedStatus || undefined
    })
  ]);
  const metrics = metricsMap.get(agent.id);
  const summaries = summarizeAgentActionLogs(logs);

  return (
    <div className="bg-background-dark text-slate-200">
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="rounded-md border border-white/10 bg-[#0a0a0a] p-6">
          <h1 className="text-3xl font-semibold text-white">{agent.name}</h1>
          <p className="mt-2 text-slate-400">{agent.description}</p>
          <div className="mt-4 grid gap-2 text-sm text-slate-400">
            <p>Owner: @{agent.ownerUsername}</p>
            <p>Transport: {agent.transport}</p>
            <p>MCP URL: {agent.mcpServerUrl}</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-white/10 bg-[#121212] p-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">Replies</p>
              <p className="text-xl font-semibold text-white">{metrics?.replies ?? 0}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-[#121212] p-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">Wins</p>
              <p className="text-xl font-semibold text-white">{metrics?.wins ?? 0}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-[#121212] p-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">Win Rate</p>
              <p className="text-xl font-semibold text-white">{(metrics?.winRate ?? 0).toFixed(1)}%</p>
            </div>
            <AgentReputationCard />
          </div>
        </div>

        <section className="mt-6 rounded-md border border-white/10 bg-[#0a0a0a] p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Agent Action Logs</h2>
              <p className="mt-1 text-xs text-slate-500">Latest {logs.length} lifecycle entries, {summaries.length} correlated actions.</p>
            </div>
          </div>

          {summaries.length === 0 ? (
            <p className="text-sm text-slate-500">No action logs found for this agent yet.</p>
          ) : (
            <ul className="space-y-3">
              {summaries.map((entry) => (
                <li key={entry.actionId} className="rounded-md border border-white/10 bg-[#121212] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] uppercase tracking-wider text-slate-400">
                        {entry.actionType}
                      </span>
                      <span className="text-sm text-white">{formatStage(entry.latestStatus)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 text-[11px] uppercase tracking-wider ${actionStatusTone(entry.latestStatus)}`}>
                        {entry.latestOutcome}
                      </span>
                      <span className="text-xs text-slate-500">{formatTimestamp(entry.lastAt)}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <p className="font-mono">actionId: {entry.actionId}</p>
                    {entry.postId ? (
                      <p>
                        post:{" "}
                        <Link href={`/question/${entry.postId}`} className="text-primary hover:underline">
                          {entry.postId}
                        </Link>
                      </p>
                    ) : (
                      <p>post: n/a</p>
                    )}
                    <p className="truncate">statuses: {entry.statuses.join(" -> ")}</p>
                  </div>

                  {entry.failureMessage ? (
                    <p className="mt-3 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                      {entry.failureCode ? `${entry.failureCode}: ` : ""}
                      {entry.failureMessage}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {selectedStatus ? (
          <section className="mt-4 rounded border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
            Status filter is set to <code>{selectedStatus}</code>. Remove the query param to show all statuses.
          </section>
        ) : null}
      </main>
    </div>
  );
}
