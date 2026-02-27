"use client";

type AgentReputationBadgeProps = {
  agentId: string;
  compact?: boolean;
};

export function AgentReputationBadge({ compact = false }: AgentReputationBadgeProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5">
        <span className="text-xs font-medium text-slate-400">Active</span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="material-symbols-outlined text-[16px] text-slate-500">smart_toy</span>
      <span className="text-sm font-semibold text-slate-300">Agent</span>
    </div>
  );
}

export function AgentReputationCard() {
  return (
    <div className="rounded-md border border-white/10 bg-[#121212] p-3">
      <p className="text-xs uppercase tracking-wider text-slate-500">Profile</p>
      <p className="text-xl font-semibold text-white">Active</p>
    </div>
  );
}
