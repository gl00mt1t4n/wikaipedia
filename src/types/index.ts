// User
export type User = {
  walletAddress: string;
  username: string;
  createdAt: string;
};

export function createUser(input: { walletAddress: string; username: string }): User {
  return {
    walletAddress: input.walletAddress.toLowerCase(),
    username: input.username,
    createdAt: new Date().toISOString()
  };
}

// Post
export type Post = {
  id: string;
  poster: string;
  wikiId: string;
  wikiDisplayName: string;
  header: string;
  content: string;
  createdAt: string;
  complexityTier: "simple" | "medium" | "complex";
  complexityScore: number;
  complexityModel: string | null;
  answerWindowSeconds: number;
  answersCloseAt: string;
  settlementStatus: "open" | "settled";
  winnerAnswerId: string | null;
  winnerAgentId: string | null;
  settledAt: string | null;
  settlementTxHash: string | null;
  likesCount: number;
  dislikesCount: number;
  answerCount: number;
  latestAnswerPreview: {
    agentName: string;
    content: string;
  } | null;
};

export function createPost(input: {
  poster: string;
  wikiId?: string;
  wikiDisplayName?: string;
  header: string;
  content: string;
  complexityTier?: "simple" | "medium" | "complex";
  complexityScore?: number;
  complexityModel?: string | null;
  answerWindowSeconds?: number;
}): Post {
  const now = new Date();
  const answerWindowSeconds = Number.isFinite(input.answerWindowSeconds) ? Math.floor(input.answerWindowSeconds ?? 300) : 300;
  const answersCloseAt = new Date(now.getTime() + answerWindowSeconds * 1000);

  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    poster: input.poster.trim() || "anonymous",
    wikiId: input.wikiId?.trim().toLowerCase() || "general",
    wikiDisplayName: input.wikiDisplayName?.trim() || "General",
    header: input.header.trim(),
    content: input.content.trim(),
    createdAt: now.toISOString(),
    complexityTier: input.complexityTier ?? "medium",
    complexityScore: Math.min(5, Math.max(1, Math.floor(input.complexityScore ?? 3))),
    complexityModel: input.complexityModel ?? null,
    answerWindowSeconds,
    answersCloseAt: answersCloseAt.toISOString(),
    settlementStatus: "open",
    winnerAnswerId: null,
    winnerAgentId: null,
    settledAt: null,
    settlementTxHash: null,
    likesCount: 0,
    dislikesCount: 0,
    answerCount: 0,
    latestAnswerPreview: null
  };
}

// Answer
export type Answer = {
  id: string;
  postId: string;
  agentId: string;
  agentName: string;
  content: string;
  likesCount: number;
  dislikesCount: number;
  createdAt: string;
};

export function createAnswer(input: {
  postId: string;
  agentId: string;
  agentName: string;
  content: string;
}): Answer {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    postId: input.postId,
    agentId: input.agentId,
    agentName: input.agentName,
    content: input.content.trim(),
    likesCount: 0,
    dislikesCount: 0,
    createdAt: new Date().toISOString()
  };
}

// Agent
export type AgentTransport = "http" | "sse" | "stdio";
export type AgentVerificationStatus = "verified" | "failed";

export type Agent = {
  id: string;
  ownerWalletAddress: string;
  ownerUsername: string;
  name: string;
  description: string;
  totalLikes: number;
  baseWalletAddress: string | null;
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
  // Legacy identity metadata retained for backward compatibility.
  erc8004ChainId: number | null;
  erc8004TokenId: number | null;
  erc8004IdentityRegistry: string | null;
  erc8004RegisteredAt: string | null;
  erc8004TxHash: string | null;
};

export function createAgent(input: {
  ownerWalletAddress: string;
  ownerUsername: string;
  name: string;
  description: string;
  totalLikes?: number;
  baseWalletAddress?: string;
  mcpServerUrl: string;
  transport: AgentTransport;
  entrypointCommand?: string;
  tags?: string[];
  authTokenHash: string;
  verificationStatus: AgentVerificationStatus;
  verificationError?: string | null;
  verifiedAt?: string | null;
  capabilities?: string[];
  erc8004ChainId?: number | null;
  erc8004TokenId?: number | null;
  erc8004IdentityRegistry?: string | null;
  erc8004RegisteredAt?: string | null;
  erc8004TxHash?: string | null;
}): Agent {
  const now = new Date().toISOString();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ownerWalletAddress: input.ownerWalletAddress.toLowerCase(),
    ownerUsername: input.ownerUsername,
    name: input.name.trim(),
    description: input.description.trim(),
    totalLikes: Math.max(0, Math.floor(input.totalLikes ?? 0)),
    baseWalletAddress: input.baseWalletAddress?.toLowerCase() ?? null,
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
    capabilities: input.capabilities ?? [],
    erc8004ChainId: input.erc8004ChainId ?? null,
    erc8004TokenId: input.erc8004TokenId ?? null,
    erc8004IdentityRegistry: input.erc8004IdentityRegistry ?? null,
    erc8004RegisteredAt: input.erc8004RegisteredAt ?? null,
    erc8004TxHash: input.erc8004TxHash ?? null
  };
}

export type PublicAgent = Omit<Agent, "authTokenHash">;

export function toPublicAgent(agent: Agent): PublicAgent {
  const publicAgent = { ...agent } as PublicAgent & { authTokenHash?: string };
  delete publicAgent.authTokenHash;
  return publicAgent;
}

export type Wiki = {
  id: string;
  displayName: string;
  description: string;
  createdBy: string;
  createdAt: string;
};

export type WikiDiscoveryCandidate = {
  wiki: Wiki;
  memberCount: number;
  recentPostCount: number;
  lastPostAt: string | null;
  relevanceScore: number;
  activityScore: number;
  score: number;
};

export type AgentWikiMembership = {
  id: string;
  agentId: string;
  wikiId: string;
  subscribedAt: string;
};

export function createWiki(input: {
  id: string;
  displayName: string;
  description?: string;
  createdBy: string;
}): Wiki {
  return {
    id: input.id.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    description: input.description?.trim() ?? "",
    createdBy: input.createdBy.trim() || "system",
    createdAt: new Date().toISOString()
  };
}

export function createAgentWikiMembership(input: {
  agentId: string;
  wikiId: string;
}): AgentWikiMembership {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentId: input.agentId,
    wikiId: input.wikiId,
    subscribedAt: new Date().toISOString()
  };
}
