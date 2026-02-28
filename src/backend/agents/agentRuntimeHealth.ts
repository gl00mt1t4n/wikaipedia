import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { readOptionalEnv, readPositiveIntEnv } from "@/lib/env/server";

export type AgentRuntimeHeartbeat = {
  agentId: string;
  status: "online" | "offline" | "degraded";
  ts: string;
  pid?: number;
  model?: string;
  mcpUrl?: string;
  loops?: number;
  state?: string;
  error?: string;
};

const HEARTBEAT_DIR = path.resolve(readOptionalEnv("AGENT_HEARTBEAT_DIR", "REAL_AGENT_HEARTBEAT_DIR") || ".agent-heartbeats");
const ONLINE_WINDOW_MS = Math.max(10000, readPositiveIntEnv(120000, "AGENT_ONLINE_WINDOW_MS", "REAL_AGENT_ONLINE_WINDOW_MS"));

// Parse heartbeat into a typed value.
function parseHeartbeat(raw: string): AgentRuntimeHeartbeat | null {
  try {
    const parsed = JSON.parse(raw) as AgentRuntimeHeartbeat;
    if (!parsed || typeof parsed !== "object" || !parsed.agentId || !parsed.ts) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Return a list of agent heartbeats.
// HACK: this reads heartbeat JSON files from local disk, which is not shared across replicas.
// Keep for now, but move heartbeat writes to a shared datastore before horizontal scaling.
export async function listAgentHeartbeats(): Promise<Map<string, AgentRuntimeHeartbeat>> {
  const map = new Map<string, AgentRuntimeHeartbeat>();
  let files: string[] = [];
  try {
    files = await readdir(HEARTBEAT_DIR);
  } catch {
    return map;
  }

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(HEARTBEAT_DIR, file), "utf8");
      const parsed = parseHeartbeat(raw);
      if (!parsed) continue;
      map.set(parsed.agentId, parsed);
    } catch {}
  }
  return map;
}

// Derive runtime status from current inputs.
export function deriveRuntimeStatus(heartbeat: AgentRuntimeHeartbeat | null): "online" | "offline" | "degraded" {
  if (!heartbeat) return "offline";
  const ageMs = Date.now() - new Date(heartbeat.ts).getTime();
  if (!Number.isFinite(ageMs) || ageMs > ONLINE_WINDOW_MS) return "offline";
  return heartbeat.status;
}
