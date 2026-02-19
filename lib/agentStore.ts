import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { verifyAgentConnection } from "@/lib/agentConnection";
import { createAgent, toPublicAgent, type Agent, type AgentTransport, type PublicAgent } from "@/lib/types";

const AGENTS_FILE = path.join(process.cwd(), "data", "agents.txt");

function parseAgentLine(line: string): Agent | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Agent;
    if (!parsed.id || !parsed.name || !parsed.ownerWalletAddress || !parsed.ownerUsername || !parsed.mcpServerUrl) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function ensureAgentsFile(): Promise<void> {
  await fs.mkdir(path.dirname(AGENTS_FILE), { recursive: true });
  try {
    await fs.access(AGENTS_FILE);
  } catch {
    await fs.writeFile(AGENTS_FILE, "", "utf8");
  }
}

function isValidTransport(value: string): value is AgentTransport {
  return value === "http" || value === "sse" || value === "stdio";
}

function isValidMcpEndpoint(value: string): boolean {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return true;
  }

  if (value.startsWith("stdio://")) {
    return true;
  }

  return false;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateAgentToken(): string {
  return `ag_${crypto.randomBytes(24).toString("hex")}`;
}

export async function listAgentsRaw(): Promise<Agent[]> {
  await ensureAgentsFile();
  const content = await fs.readFile(AGENTS_FILE, "utf8");

  return content
    .split("\n")
    .map(parseAgentLine)
    .filter((agent): agent is Agent => agent !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAgents(): Promise<PublicAgent[]> {
  const all = await listAgentsRaw();
  return all.map(toPublicAgent);
}

export async function listAgentsByOwner(ownerWalletAddress: string): Promise<PublicAgent[]> {
  const all = await listAgentsRaw();
  const normalized = ownerWalletAddress.toLowerCase();
  return all.filter((agent) => agent.ownerWalletAddress === normalized).map(toPublicAgent);
}

export async function findAgentByAccessToken(token: string): Promise<Agent | null> {
  const tokenHash = hashToken(token);
  const all = await listAgentsRaw();
  return all.find((agent) => agent.authTokenHash === tokenHash) ?? null;
}

export async function registerAgent(input: {
  ownerWalletAddress: string;
  ownerUsername: string;
  name: string;
  description: string;
  mcpServerUrl: string;
  transport: string;
  entrypointCommand?: string;
  tags?: string[];
}): Promise<
  | { ok: true; agent: PublicAgent; agentAccessToken: string }
  | { ok: false; error: string }
> {
  const name = input.name.trim();
  const description = input.description.trim();
  const mcpServerUrl = input.mcpServerUrl.trim();
  const transport = input.transport.trim().toLowerCase();

  if (name.length < 3 || name.length > 80) {
    return { ok: false, error: "Agent name must be 3-80 characters." };
  }

  if (description.length < 10 || description.length > 2000) {
    return { ok: false, error: "Description must be 10-2000 characters." };
  }

  if (!isValidTransport(transport)) {
    return { ok: false, error: "Transport must be one of: http, sse, stdio." };
  }

  if (!isValidMcpEndpoint(mcpServerUrl)) {
    return { ok: false, error: "MCP endpoint must start with http://, https://, or stdio://" };
  }

  const existing = await listAgentsRaw();
  const duplicateName = existing.find(
    (agent) => agent.ownerWalletAddress === input.ownerWalletAddress.toLowerCase() && agent.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicateName) {
    return { ok: false, error: "You already have an agent with this name." };
  }

  const verification = await verifyAgentConnection({
    transport,
    mcpServerUrl,
    entrypointCommand: input.entrypointCommand
  });

  if (!verification.ok) {
    return { ok: false, error: verification.error ?? "Agent endpoint verification failed." };
  }

  const accessToken = generateAgentToken();
  const agent = createAgent({
    ownerWalletAddress: input.ownerWalletAddress,
    ownerUsername: input.ownerUsername,
    name,
    description,
    mcpServerUrl,
    transport,
    entrypointCommand: input.entrypointCommand,
    tags: input.tags,
    authTokenHash: hashToken(accessToken),
    verificationStatus: "verified",
    verificationError: null,
    verifiedAt: new Date().toISOString(),
    capabilities: verification.capabilities ?? []
  });

  await ensureAgentsFile();
  await fs.appendFile(AGENTS_FILE, `${JSON.stringify(agent)}\n`, "utf8");

  return { ok: true, agent: toPublicAgent(agent), agentAccessToken: accessToken };
}
