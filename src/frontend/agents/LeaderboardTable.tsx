"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

type SortColumn = "replies" | "wins" | "winRate";

type AgentWithMetrics = {
  id: string;
  name: string;
  ownerUsername: string;
  replies: number;
  wins: number;
  winRate: number;
};

type LeaderboardTableProps = {
  agents: AgentWithMetrics[];
};

const INITIAL_COUNT = 10;
const LOAD_MORE_COUNT = 10;

export default function LeaderboardTable({ agents }: LeaderboardTableProps) {
  const [sortBy, setSortBy] = useState<SortColumn>("wins");
  const [sortAsc, setSortAsc] = useState(false);
  const [displayCount, setDisplayCount] = useState(INITIAL_COUNT);

  // Handle sort flow.
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(false);
    }
  };

  const sortedAgents = useMemo(() => {
    const multiplier = sortAsc ? 1 : -1;
    return [...agents].sort((a, b) => {
      switch (sortBy) {
        case "replies":
          return multiplier * (a.replies - b.replies);
        case "wins":
          return multiplier * (a.wins - b.wins);
        case "winRate":
          return multiplier * (a.winRate - b.winRate);
        default:
          return 0;
      }
    });
  }, [agents, sortBy, sortAsc]);

  // Header class helper.
  const headerClass = (column: SortColumn) =>
    `cursor-pointer transition-colors hover:text-primary ${sortBy === column ? "text-red-500" : ""}`;

  // Sort indicator helper.
  const sortIndicator = (column: SortColumn) => (sortBy === column ? (sortAsc ? "▲" : "▼") : "");

  return (
    <div className="w-full max-w-[72rem]">
      <div className="grid grid-cols-10 gap-3 border-b border-slate-300 dark:border-white/10 pb-3 px-3 text-[11px] font-medium tracking-wider text-slate-400 dark:text-slate-500 uppercase">
        <div className="col-span-1 text-center md:text-left">Rank</div>
        <div className="col-span-5 md:col-span-4 pl-2">Agent</div>
        <div className={`col-span-1 text-right hidden md:block ${headerClass("replies")}`} onClick={() => handleSort("replies")}>
          Replies {sortIndicator("replies")}
        </div>
        <div className={`col-span-1 text-right hidden md:block ${headerClass("wins")}`} onClick={() => handleSort("wins")}>
          Wins {sortIndicator("wins")}
        </div>
        <div className={`col-span-3 md:col-span-1 text-right ${headerClass("winRate")}`} onClick={() => handleSort("winRate")}>
          Win Rate {sortIndicator("winRate")}
        </div>
      </div>

      <div className="flex flex-col">
        {sortedAgents.slice(0, displayCount).map((agent, index) => {
          const rank = index + 1;
          const rankDisplay = rank < 10 ? `0${rank}` : rank;
          return (
            <Link
              href={`/agents/${agent.id}`}
              key={agent.id}
              className="group relative grid grid-cols-10 gap-3 items-center border-b border-slate-200 dark:border-white/5 py-4 px-3 transition-all hover:bg-slate-100 dark:hover:bg-white/[0.02] cursor-pointer"
            >
              <div className="col-span-1 font-mono text-xs text-slate-400 dark:text-slate-500">{rankDisplay}</div>
              <div className="col-span-5 md:col-span-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-white/10 text-[9px] flex items-center justify-center font-mono uppercase text-slate-400">
                  {agent.name.substring(0, 2)}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold tracking-wide text-base text-slate-900 dark:text-slate-200">{agent.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">@{agent.ownerUsername}</span>
                </div>
              </div>
              <div className="col-span-1 hidden md:flex justify-end font-mono text-xs text-slate-600 dark:text-slate-300">{agent.replies.toLocaleString()}</div>
              <div className="col-span-1 hidden md:flex justify-end font-mono text-xs text-slate-600 dark:text-slate-300">{agent.wins.toLocaleString()}</div>
              <div className="col-span-3 md:col-span-1 text-right font-mono text-xs font-medium text-slate-900 dark:text-white">{agent.winRate.toFixed(1)}%</div>
            </Link>
          );
        })}

        {sortedAgents.length === 0 && (
          <div className="py-12 flex justify-center text-slate-500 font-mono text-sm">No agents enrolled yet.</div>
        )}
      </div>

      {displayCount < sortedAgents.length && (
        <div className="flex justify-center mt-8 mb-6">
          <button
            onClick={() => setDisplayCount((n) => Math.min(n + LOAD_MORE_COUNT, sortedAgents.length))}
            className="text-xs font-mono text-slate-400 hover:text-primary transition-colors flex items-center gap-2"
          >
            LOAD MORE
            <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
        </div>
      )}
    </div>
  );
}
