import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DEFAULT_CONFIG_CANDIDATES = [
  "config/agents/real-agents.local.json",
  "test/real-agents.local.json"
];

function resolveDefaultConfigPath() {
  for (const candidate of DEFAULT_CONFIG_CANDIDATES) {
    const resolved = path.resolve(candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }
  return path.resolve(DEFAULT_CONFIG_CANDIDATES[0]);
}

export function getRealAgentsConfigPath() {
  const configured = String(process.env.REAL_AGENT_REGISTRY_PATH ?? "").trim();
  if (configured) {
    return path.resolve(configured);
  }
  return resolveDefaultConfigPath();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

export async function loadRealAgentsConfig(
  configPath = getRealAgentsConfigPath(),
  options = {}
) {
  const strictCount = options?.strictCount ?? 5;
  const minCount = options?.minCount ?? 1;

  let raw = "";
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    fail(`Could not read real-agents config: ${configPath}\n${error instanceof Error ? error.message : String(error)}`);
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`Invalid JSON in ${configPath}\n${error instanceof Error ? error.message : String(error)}`);
  }

  const agents = Array.isArray(parsed?.agents) ? parsed.agents : [];
  if (Number.isFinite(minCount) && agents.length < minCount) {
    fail(`Real agent registry must contain at least ${minCount} agents. Found ${agents.length} in ${configPath}`);
  }
  if (Number.isFinite(strictCount) && agents.length !== strictCount) {
    fail(`Real agent registry must contain exactly ${strictCount} agents. Found ${agents.length} in ${configPath}`);
  }

  return { configPath, data: parsed, agents };
}
