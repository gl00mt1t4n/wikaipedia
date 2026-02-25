"use client";

import { useCallback, useEffect, useState } from "react";

type ReputationData = {
  onChain: boolean;
  tokenId?: number;
  chainId?: number;
  localScore: number;
  score: number | null;
  feedbackCount: number | null;
  explorerUrl: string | null;
};

type AgentReputationBadgeProps = {
  agentId: string;
  compact?: boolean;
  showLocal?: boolean;
};

export function AgentReputationBadge({
  agentId,
  compact = false,
  showLocal = false
}: AgentReputationBadgeProps) {
  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReputation = useCallback(async () => {
    const fallback = { onChain: false, localScore: 0, score: null, feedbackCount: null, explorerUrl: null };
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/reputation`);
      const result = await response.json();
      setData(response.ok ? result : fallback);
    } catch {
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchReputation();
  }, [fetchReputation]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ agentIds?: string[] }>) => {
      const ids = e.detail?.agentIds;
      if (!ids || ids.includes(agentId)) fetchReputation();
    };
    window.addEventListener("reputation-refresh", handler as EventListener);
    return () => window.removeEventListener("reputation-refresh", handler as EventListener);
  }, [agentId, fetchReputation]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 text-slate-500">
        <span className="material-symbols-outlined text-[14px] animate-pulse">hourglass_empty</span>
      </div>
    );
  }

  if (!data) {
    return (
      <span className="text-xs text-slate-500" title="Reputation">
        —
      </span>
    );
  }

  // Show local score if no on-chain data or showLocal is true
  const displayScore = data.onChain && data.score != null ? data.score : data.localScore;
  const isOnChain = data.onChain && data.score != null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5">
        {isOnChain && (
          <span className="material-symbols-outlined text-[12px] text-primary" title="On-chain reputation (ERC-8004)">
            verified
          </span>
        )}
        <span
          className={`text-xs font-medium ${displayScore > 0 ? "text-emerald-400" : displayScore < 0 ? "text-red-400" : "text-slate-400"}`}
          title={isOnChain ? "On-chain reputation" : "Local reputation"}
        >
          {displayScore > 0 ? `+${displayScore}` : displayScore} rep
        </span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex items-center gap-1">
        {isOnChain ? (
          <span className="material-symbols-outlined text-[16px] text-primary" title="On-chain reputation (ERC-8004)">
            verified
          </span>
        ) : (
          <span className="material-symbols-outlined text-[16px] text-slate-500" title="Local reputation">
            thumb_up
          </span>
        )}
        <span
          className={`text-sm font-semibold ${displayScore > 0 ? "text-emerald-400" : displayScore < 0 ? "text-red-400" : "text-slate-400"}`}
        >
          {displayScore > 0 ? `+${displayScore}` : displayScore}
        </span>
      </div>
      {isOnChain && data.explorerUrl && (
        <a
          href={data.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-500 hover:text-primary transition-colors"
          title="View on-chain reputation"
        >
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
      )}
      {showLocal && isOnChain && data.localScore !== displayScore && (
        <span className="text-[10px] text-slate-600" title="Local score">
          (local: {data.localScore > 0 ? `+${data.localScore}` : data.localScore})
        </span>
      )}
    </div>
  );
}

export function AgentReputationCard({ agentId }: { agentId: string }) {
  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReputation = useCallback(async () => {
    const fallback = { onChain: false, localScore: 0, score: null, feedbackCount: null, explorerUrl: null };
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/reputation`);
      const result = await response.json();
      setData(response.ok ? result : fallback);
    } catch {
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchReputation();
  }, [fetchReputation]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ agentIds?: string[] }>) => {
      const ids = e.detail?.agentIds;
      if (!ids || ids.includes(agentId)) fetchReputation();
    };
    window.addEventListener("reputation-refresh", handler as EventListener);
    return () => window.removeEventListener("reputation-refresh", handler as EventListener);
  }, [agentId, fetchReputation]);

  if (loading) {
    return (
      <div className="rounded-md border border-white/10 bg-[#121212] p-3 animate-pulse">
        <p className="text-xs uppercase tracking-wider text-slate-500">Reputation</p>
        <p className="text-xl font-semibold text-slate-600">...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const displayScore = data.onChain && data.score != null ? data.score : data.localScore;
  const isOnChain = data.onChain && data.score != null;

  return (
    <div className="rounded-md border border-white/10 bg-[#121212] p-3">
      <div className="flex items-center gap-1">
        <p className="text-xs uppercase tracking-wider text-slate-500">Reputation</p>
        {isOnChain && (
          <span className="material-symbols-outlined text-[12px] text-primary" title="On-chain (ERC-8004)">
            verified
          </span>
        )}
      </div>
      <p
        className={`text-xl font-semibold ${displayScore > 0 ? "text-emerald-400" : displayScore < 0 ? "text-red-400" : "text-white"}`}
      >
        {displayScore > 0 ? `+${displayScore}` : displayScore}
      </p>
      {isOnChain && data.explorerUrl && (
        <a
          href={data.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-primary transition-colors"
        >
          View on-chain
          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
        </a>
      )}
    </div>
  );
}
