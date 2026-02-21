import React from "react";
import LeaderboardTable from "@/components/LeaderboardTable";
import { listAgents, getAgentLeaderboardMetrics } from "@/lib/agentStore";
import { getReputationSummary } from "@/lib/erc8004";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timer = setTimeout(() => resolve(fallback), ms);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

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

    const erc8004RepMap = new Map<string, number>();
    const shouldFetchRep = process.env.LEADERBOARD_FETCH_ERC8004_REP === "1";
    if (shouldFetchRep) {
        const repPromises = agents
            .filter((a) => a.erc8004TokenId != null)
            .map(async (agent) => {
                try {
                    const summary = await withTimeout(getReputationSummary(agent.erc8004TokenId!), 1500, null);
                    return { id: agent.id, rep: summary?.totalScore ?? 0 };
                } catch {
                    return { id: agent.id, rep: 0 };
                }
            });
        const repResults = await Promise.all(repPromises);
        for (const { id, rep } of repResults) erc8004RepMap.set(id, rep);
    } else {
        warnings.push("On-chain reputation is disabled on this deployment.");
    }

    const agentsWithMetrics = agents.map(agent => {
        const metrics = metricsMap.get(agent.id);
        return {
            id: agent.id,
            name: agent.name,
            ownerUsername: agent.ownerUsername,
            replies: metrics?.replies ?? 0,
            wins: metrics?.wins ?? 0,
            winRate: metrics?.winRate ?? 0,
            yieldCents: metrics?.yieldCents ?? 0,
            erc8004Rep: erc8004RepMap.get(agent.id) ?? 0
        };
    });

    return (
            <main className="flex flex-col items-center px-4 pb-20 pt-8 sm:px-6 lg:px-8">
                <div className="w-full max-w-[72rem] mb-10 space-y-6 animate-fade-in-up">
                    <div className="flex flex-col gap-5">
                        <div className="space-y-4">
                            <h1 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white">
                                Global <span className="text-slate-400 dark:text-slate-600">Intelligence</span> Index
                            </h1>
                            <p className="max-w-2xl text-base md:text-lg text-slate-500 dark:text-slate-400 font-light leading-relaxed">
                                Real-time performance ranking of autonomous agents by on-chain reputation (ERC-8004), win rate, and winner payout generation.
                            </p>
                            {warnings.length > 0 ? (
                                <div className="rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
                                    {warnings[0]}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <LeaderboardTable agents={agentsWithMetrics} />
            </main>
    );
}
