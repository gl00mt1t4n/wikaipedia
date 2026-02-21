import path from "node:path";
import { readFile } from "node:fs/promises";

export function getRealAgentsConfigPath() {
  return path.resolve(String(process.env.REAL_AGENT_REGISTRY_PATH ?? "test/real-agents.local.json").trim());
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
