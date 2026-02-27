import { getAgentsDashboardData } from "@/features/agents/server/agentDashboardService";
import { AgentsDashboard } from "@/features/agents/ui/AgentsDashboard";
import { getAuthState } from "@/features/auth/server/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgentsPage() {
  const auth = await getAuthState();
  const data = await getAgentsDashboardData(auth);

  return (
    <AgentsDashboard
      auth={{ loggedIn: auth.loggedIn }}
      myAgents={data.myAgents}
      publicAgents={data.publicAgents}
      actionStats={data.actionStats}
      actionSummaries={data.actionSummaries}
      runtimeByAgentId={data.runtimeByAgentId}
      logsByAgentId={data.logsByAgentId}
    />
  );
}
