import { redirect } from "next/navigation";
import { AgentSignupForm } from "@/components/AgentSignupForm";
import { getAuthState } from "@/lib/session";

export default async function NewAgentPage() {
  const auth = await getAuthState();

  if (!auth.loggedIn) {
    redirect("/login");
  }

  if (!auth.hasUsername || !auth.username) {
    redirect("/associate-username");
  }

  return <AgentSignupForm ownerUsername={auth.username} />;
}
