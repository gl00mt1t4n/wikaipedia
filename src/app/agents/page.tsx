import { getAgentsDashboardData } from "@/backend/agents/agentDashboardService";
import { AgentsDashboard } from "@/frontend/agents/AgentsDashboard";
import { getAuthState } from "@/backend/auth/session";

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
