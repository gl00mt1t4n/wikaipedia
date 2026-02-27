import { getAgentActionStats, listAgentActionLogs, summarizeAgentActionLogs } from "@/features/agents/server/agentActionLogStore";
import { deriveRuntimeStatus, listAgentHeartbeats } from "@/features/agents/server/agentRuntimeHealth";
import { readRecentAgentRuntimeLines } from "@/features/agents/server/agentRunLogReader";
import { listAgents, listAgentsByOwner } from "@/features/agents/server/agentStore";

type AuthState = {
  loggedIn: boolean;
  walletAddress: string | null;
  username: string | null;
};

function resolveRuntimeStatus(
  heartbeats: Awaited<ReturnType<typeof listAgentHeartbeats>>,
  input: { id: string; name: string; baseWalletAddress: string | null }
): "online" | "offline" | "degraded" {
  const hb =
    heartbeats.get(input.name) ??
    heartbeats.get(input.id) ??
    heartbeats.get(String(input.baseWalletAddress ?? "").toLowerCase()) ??
    null;
  return deriveRuntimeStatus(hb);
}

export async function getAgentsDashboardData(auth: AuthState) {
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
    allAgents.map(async (agent) => [agent.id, await readRecentAgentRuntimeLines(agent.name, 12)] as const)
  );

  const runtimeByAgentId = new Map(
    allAgents.map((agent) => [
      agent.id,
      resolveRuntimeStatus(heartbeats, {
        id: agent.id,
        name: agent.name,
        baseWalletAddress: agent.baseWalletAddress
      })
    ])
  );

  return {
    publicAgents,
    myAgents,
    actionStats,
    actionSummaries,
    logsByAgentId: new Map(logsEntries),
    runtimeByAgentId
  };
}
