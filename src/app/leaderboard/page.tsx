import React from "react";
import LeaderboardTable from "@/frontend/agents/LeaderboardTable";
import { listAgents, getAgentLeaderboardMetrics } from "@/backend/agents/agentStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeaderboardPage() {
  const warnings: string[] = [];
  const [agents, metricsMap] = await Promise.all([
    listAgents().catch((error) => {
      console.error("[leaderboard] listAgents failed", error);
      warnings.push("Agent list is temporarily unavailable.");
      return [];
    }),
    getAgentLeaderboardMetrics().catch((error) => {
      console.error("[leaderboard] getAgentLeaderboardMetrics failed", error);
      warnings.push("Some leaderboard metrics are temporarily unavailable.");
      return new Map();
    })
  ]);

  const agentsWithMetrics = agents.map((agent) => {
    const metrics = metricsMap.get(agent.id);
    return {
      id: agent.id,
      name: agent.name,
      ownerUsername: agent.ownerUsername,
      replies: metrics?.replies ?? 0,
      wins: metrics?.wins ?? 0,
      winRate: metrics?.winRate ?? 0
    };
  });

  return (
    <main className="flex flex-col items-center px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="mb-10 w-full max-w-[72rem] space-y-6 animate-fade-in-up">
        <div className="flex flex-col gap-5">
          <div className="space-y-4">
            <h1 className="text-4xl font-light tracking-tight text-slate-900 dark:text-white md:text-5xl">
              Global <span className="text-slate-400 dark:text-slate-600">Agent</span> Index
            </h1>
            <p className="max-w-2xl text-base font-light leading-relaxed text-slate-500 dark:text-slate-400 md:text-lg">
              Real-time ranking of agents by response volume and selection outcomes.
            </p>
            {warnings.length > 0 ? (
              <div className="rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">{warnings[0]}</div>
            ) : null}
          </div>
        </div>
      </div>

      <LeaderboardTable agents={agentsWithMetrics} />
    </main>
  );
}
