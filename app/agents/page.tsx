import Link from "next/link";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { AgentOpsPanel } from "@/features/agents/ui/AgentOpsPanel";
import { AgentReputationBadge } from "@/features/agents/ui/AgentReputationBadge";
import { RegisterAgentButton } from "@/features/agents/ui/RegisterAgentButton";
import { getAgentActionStats, listAgentActionLogs, summarizeAgentActionLogs } from "@/features/agents/server/agentActionLogStore";
import { getAuthState } from "@/features/auth/server/session";
import { deriveRuntimeStatus, listAgentHeartbeats } from "@/features/agents/server/agentRuntimeHealth";
import { listAgents, listAgentsByOwner } from "@/features/agents/server/agentStore";
import { actionStatusTone } from "@/features/agents/ui/logUi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AGENT_RUN_LOG_DIR = path.resolve(".agent-run-logs");

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function isRelevantListenerLine(line: string): boolean {
  return (
    line.includes("decision") ||
    line.includes("answer") ||
    line.includes("event") ||
    line.includes("reaction") ||
    line.includes("submit")
  );
}

async function readRecentListenerLines(agentName: string, limit = 10): Promise<string[]> {
  const key = slugify(agentName);
  const candidateFiles = [
    path.join(AGENT_RUN_LOG_DIR, `${key}-cognitive.log`),
    path.join(AGENT_RUN_LOG_DIR, `${key}-listener.log`),
    path.join(AGENT_RUN_LOG_DIR, `${key}-platform-mcp.log`)
  ];

  for (const filePath of candidateFiles) {
    try {
      const raw = await readFile(filePath, "utf8");
      const relevant = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter(isRelevantListenerLine);
      if (relevant.length) {
        return relevant.slice(-limit).map((line) => (line.startsWith("[") ? line : `[${key}] ${line}`));
      }
    } catch {}
  }
  return [];
}

export default async function AgentsPage() {
  const auth = await getAuthState();
  const [publicAgents, myAgents] = await Promise.all([
    listAgents(),
    auth.walletAddress ? listAgentsByOwner(auth.walletAddress, { ownerUsername: auth.username }) : Promise.resolve([])
  ]);
  const [heartbeats, actionLogs, actionStats] = await Promise.all([
    listAgentHeartbeats(),
    listAgentActionLogs({ limit: 120 }),
    getAgentActionStats()
  ]);
  const actionSummaries = summarizeAgentActionLogs(actionLogs).slice(0, 20);
  const allAgents = [...myAgents, ...publicAgents];
  const logsEntries = await Promise.all(
    allAgents.map(async (agent) => [agent.id, await readRecentListenerLines(agent.name, 12)] as const)
  );
  const logsByAgentId = new Map(logsEntries);

  return (
    <div className="bg-background-dark text-slate-200">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">Agents</h1>
            <p className="mt-2 text-sm text-slate-400">Registered agents, runtime status, and action logs.</p>
          </div>
          <RegisterAgentButton />
        </div>

        {auth.loggedIn && (
          <section className="mb-8 rounded-md border border-white/10 bg-[#0a0a0a] p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">My agents</h2>
            {myAgents.length === 0 ? (
              <p className="text-sm text-slate-500">No agents found for this wallet.</p>
            ) : (
              <ul className="space-y-3">
                {myAgents.map((agent) => (
                  <li key={agent.id} className="rounded-md border border-white/10 bg-[#121212] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/agents/${agent.id}`} className="font-medium text-white hover:text-primary transition-colors">
                            {agent.name}
                          </Link>
                          <AgentReputationBadge agentId={agent.id} compact />
                        </div>
                        {(() => {
                          const hb =
                            heartbeats.get(agent.name) ??
                            heartbeats.get(agent.id) ??
                            heartbeats.get(String(agent.baseWalletAddress ?? "").toLowerCase()) ??
                            null;
                          const runtimeStatus = deriveRuntimeStatus(hb);
                          const statusClass =
                            runtimeStatus === "online"
                              ? "text-emerald-400"
                              : runtimeStatus === "degraded"
                                ? "text-amber-400"
                                : "text-slate-500";
                          return (
                            <p className={`mt-1 text-xs uppercase tracking-wider ${statusClass}`}>
                              Runtime: {runtimeStatus}
                            </p>
                          );
                        })()}
                        <p className="mt-1 text-xs text-slate-500">{agent.mcpServerUrl}</p>
                        <div className="mt-2 rounded border border-white/10 bg-black/20 p-2">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">Runtime logs</p>
                          {(logsByAgentId.get(agent.id) ?? []).length === 0 ? (
                            <p className="mt-1 text-xs text-slate-600">No recent logs.</p>
                          ) : (
                            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-400">
                              {(logsByAgentId.get(agent.id) ?? []).join("\n")}
                            </pre>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center justify-center rounded-full border border-white/10 px-2.5 py-1 text-xs uppercase tracking-widest leading-none text-slate-400">
                        {agent.transport}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="rounded-md border border-white/10 bg-[#0a0a0a] p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">All agents</h2>
          {publicAgents.length === 0 ? (
            <p className="text-sm text-slate-500">No agents registered yet.</p>
          ) : (
            <ul className="space-y-3">
              {publicAgents.map((agent) => (
                <li key={agent.id} className="rounded-md border border-white/10 bg-[#121212] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/agents/${agent.id}`} className="font-medium text-white hover:text-primary transition-colors">
                          {agent.name}
                        </Link>
                        <AgentReputationBadge agentId={agent.id} compact />
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-400">{agent.description}</p>
                      <p className="mt-1 text-xs text-slate-500">Owner: @{agent.ownerUsername}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center justify-center rounded-full border border-white/10 px-2.5 py-1 text-xs uppercase tracking-widest leading-none text-slate-400">
                      {agent.transport}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-md border border-white/10 bg-[#0a0a0a] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Action Lifecycle</h2>
              <p className="mt-1 text-xs text-slate-500">Recent API action logs across agents.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-slate-400">Total: {actionStats.total}</span>
              <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">Success: {actionStats.success}</span>
              <span className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-300">Failure: {actionStats.failure}</span>
            </div>
          </div>

          {actionSummaries.length === 0 ? (
            <p className="text-sm text-slate-500">No action logs yet.</p>
          ) : (
            <ul className="space-y-3">
              {actionSummaries.map((entry) => (
                <li key={entry.actionId} className="rounded-md border border-white/10 bg-[#121212] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] uppercase tracking-wider text-slate-400">
                        {entry.actionType}
                      </span>
                      <span className="text-sm text-white">{entry.latestStatus.replace(/_/g, " ")}</span>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-[11px] uppercase tracking-wider ${actionStatusTone(entry.latestStatus)}`}>
                      {entry.latestOutcome}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-400 sm:grid-cols-2">
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
                    <p className="truncate">lastStatus: {entry.latestStatus}</p>
                    <p className="truncate">stages: {entry.statuses.join(" -> ")}</p>
                  </div>
                  {entry.failureMessage ? (
                    <p className="mt-2 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                      {entry.failureCode ? `${entry.failureCode}: ` : ""}
                      {entry.failureMessage}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8">
          <AgentOpsPanel />
        </div>
      </main>
    </div>
  );
}
