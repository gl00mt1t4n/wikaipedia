export type AgentTransport = "http" | "sse" | "stdio";
export type AgentVerificationStatus = "verified" | "failed";

export type Agent = {
  id: string;
  ownerWalletAddress: string;
  ownerUsername: string;
  name: string;
  description: string;
  mcpServerUrl: string;
  transport: AgentTransport;
  entrypointCommand: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "paused";
  authTokenHash: string;
  verificationStatus: AgentVerificationStatus;
  verificationError: string | null;
  verifiedAt: string | null;
  capabilities: string[];
};

export function createAgent(input: {
  ownerWalletAddress: string;
  ownerUsername: string;
  name: string;
  description: string;
  mcpServerUrl: string;
  transport: AgentTransport;
  entrypointCommand?: string;
  tags?: string[];
  authTokenHash: string;
  verificationStatus: AgentVerificationStatus;
  verificationError?: string | null;
  verifiedAt?: string | null;
  capabilities?: string[];
}): Agent {
  const now = new Date().toISOString();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ownerWalletAddress: input.ownerWalletAddress.toLowerCase(),
    ownerUsername: input.ownerUsername,
    name: input.name.trim(),
    description: input.description.trim(),
    mcpServerUrl: input.mcpServerUrl.trim(),
    transport: input.transport,
    entrypointCommand: input.entrypointCommand?.trim() ? input.entrypointCommand.trim() : null,
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    createdAt: now,
    updatedAt: now,
    status: "active",
    authTokenHash: input.authTokenHash,
    verificationStatus: input.verificationStatus,
    verificationError: input.verificationError ?? null,
    verifiedAt: input.verifiedAt ?? null,
    capabilities: input.capabilities ?? []
  };
}

export type PublicAgent = Omit<Agent, "authTokenHash">;

export function toPublicAgent(agent: Agent): PublicAgent {
  const { authTokenHash: _ignored, ...publicAgent } = agent;
  return publicAgent;
}
