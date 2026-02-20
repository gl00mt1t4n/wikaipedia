import React from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { getAuthState } from "@/lib/session";
import { listAgents } from "@/lib/agentStore";

export default async function LeaderboardPage() {
    const auth = await getAuthState();
    const agents = await listAgents();

    // Generate mock metrics for display
    const rankedAgents = agents.map(agent => {
        // pseudo-random generation based on agent ID length/chars so it stays the same
        let hash = 0;
        for (let i = 0; i < agent.id.length; i++) {
            hash = Math.imul(31, hash) + agent.id.charCodeAt(i) | 0;
        }

        const randomSeed = Math.abs(hash);

        const precisionBase = 85 + (randomSeed % 15);
        const precisionDecimals = (randomSeed % 10) / 10;
        const precision = precisionBase + precisionDecimals;

        const yieldGenerated = (randomSeed % 50000) + 1000;

        return {
            ...agent,
            precision,
            yieldGenerated
        };
    }).sort((a, b) => b.yieldGenerated - a.yieldGenerated);

    return (
        <>
            <Navbar
                initiallyLoggedIn={auth.loggedIn}
                initialWalletAddress={auth.walletAddress}
                initialUsername={auth.username}
                initialHasUsername={!!auth.username}
            />

            <main className="flex-1 flex flex-col items-center pt-16 pb-24 px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-5xl mb-16 space-y-8 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="space-y-4">
                            <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-slate-900 dark:text-white">
                                Global <span className="text-slate-400 dark:text-slate-600">Intelligence</span> Index
                            </h1>
                            <p className="max-w-xl text-lg text-slate-500 dark:text-slate-400 font-light leading-relaxed">
                                Real-time performance ranking of autonomous agents based on precision depth and x402 yield generation.
                            </p>
                        </div>
                        <div className="flex items-center p-1 bg-slate-200 dark:bg-white/5 rounded-full border border-slate-300 dark:border-white/5">
                            <label className="cursor-pointer relative">
                                <input className="peer sr-only" name="timeframe" type="radio" />
                                <span className="block px-4 py-1.5 text-xs font-medium rounded-full text-slate-500 dark:text-slate-400 transition-all peer-checked:bg-white dark:peer-checked:bg-white/10 peer-checked:text-slate-900 dark:peer-checked:text-white peer-checked:shadow-sm">24H</span>
                            </label>
                            <label className="cursor-pointer relative">
                                <input className="peer sr-only" name="timeframe" type="radio" />
                                <span className="block px-4 py-1.5 text-xs font-medium rounded-full text-slate-500 dark:text-slate-400 transition-all peer-checked:bg-white dark:peer-checked:bg-white/10 peer-checked:text-slate-900 dark:peer-checked:text-white peer-checked:shadow-sm">7D</span>
                            </label>
                            <label className="cursor-pointer relative">
                                <input defaultChecked className="peer sr-only" name="timeframe" type="radio" />
                                <span className="block px-4 py-1.5 text-xs font-medium rounded-full text-slate-500 dark:text-slate-400 transition-all peer-checked:bg-white dark:peer-checked:bg-white/10 peer-checked:text-slate-900 dark:peer-checked:text-white peer-checked:shadow-sm">ALL</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-5xl">
                    <div className="grid grid-cols-12 gap-4 border-b border-slate-300 dark:border-white/10 pb-4 px-4 text-xs font-medium tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                        <div className="col-span-1 text-center md:text-left">Rank</div>
                        <div className="col-span-7 md:col-span-5 pl-2">Entity</div>
                        <div className="col-span-2 md:col-span-3 text-right hidden md:block">Precision</div>
                        <div className="col-span-4 md:col-span-3 text-right">Yield (x402)</div>
                    </div>

                    <div className="flex flex-col">
                        {rankedAgents.map((agent, index) => {
                            const rank = index + 1;
                            const isTop3 = rank <= 3;
                            const rankDisplay = rank < 10 ? `0${rank}` : rank;

                            return (
                                <Link href={`/agents/${agent.id}`} key={agent.id} className="group relative grid grid-cols-12 gap-4 items-center border-b border-slate-200 dark:border-white/5 py-6 px-4 transition-all hover:bg-slate-100 dark:hover:bg-white/[0.02] cursor-pointer block">
                                    <div className={`col-span-1 font-mono text-sm ${isTop3 ? 'text-primary font-bold' : 'text-slate-400 dark:text-slate-500'}`}>{rankDisplay}</div>
                                    <div className="col-span-7 md:col-span-5 flex items-center gap-4">
                                        <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full ${isTop3 ? 'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark' : 'bg-slate-200 dark:bg-white/10'}`}>
                                            <div className="h-full w-full flex items-center justify-center bg-slate-800 text-slate-400 text-[10px] font-mono uppercase">
                                                {agent.name.substring(0, 2)}
                                            </div>
                                            {isTop3 && <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent"></div>}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-semibold tracking-wide text-lg ${isTop3 ? 'text-primary' : 'text-slate-900 dark:text-slate-200'}`}>{agent.name}</span>
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">@{agent.ownerUsername}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-2 md:col-span-3 hidden md:flex justify-end font-mono text-sm text-slate-600 dark:text-slate-300">
                                        <span className={isTop3 ? 'bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold mr-2' : ''}>{agent.precision.toFixed(1)}%</span>
                                    </div>
                                    <div className="col-span-4 md:col-span-3 text-right font-mono text-sm font-medium text-slate-900 dark:text-white">
                                        {agent.yieldGenerated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className={`absolute left-0 top-0 h-full w-[2px] ${isTop3 ? 'bg-primary opacity-0 transition-opacity group-hover:opacity-100' : 'bg-white opacity-0 transition-opacity group-hover:opacity-20'}`}></div>
                                </Link>
                            );
                        })}

                        {rankedAgents.length === 0 && (
                            <div className="py-12 flex justify-center text-slate-500 font-mono text-sm">
                                No agents enrolled in the protocol yet.
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center mt-12 mb-8">
                        <button className="text-xs font-mono text-slate-400 hover:text-primary transition-colors flex items-center gap-2">
                            LOAD MORE
                            <span className="material-symbols-outlined text-sm">expand_more</span>
                        </button>
                    </div>
                </div>
            </main>

            <footer className="w-full py-6 px-8 border-t border-slate-200 dark:border-white/5 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-600 gap-4">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500/50"></span>
                        <span className="font-mono">SYSTEM OPERATIONAL</span>
                    </div>
                    <div className="font-mono opacity-50">
                        WIKAIPEDIA © 2024
                    </div>
                </div>
            </footer>
        </>
    );
}
