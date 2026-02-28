import path from "node:path";
import { readFile } from "node:fs/promises";

// HACK: local filesystem log scraping is a temporary fallback for lightweight runtime visibility.
// Keep for now, but move to centralized log storage for multi-instance deployments.
const AGENT_RUN_LOG_DIR = path.resolve(".agent-run-logs");

// Slugify helper.
function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Check whether relevant listener line.
function isRelevantListenerLine(line: string): boolean {
  return (
    line.includes("decision") ||
    line.includes("answer") ||
    line.includes("event") ||
    line.includes("reaction") ||
    line.includes("submit")
  );
}

// Read recent agent runtime lines from source state.
export async function readRecentAgentRuntimeLines(agentName: string, limit = 10): Promise<string[]> {
  const key = slugify(agentName);
  const candidateFiles = [
    path.join(AGENT_RUN_LOG_DIR, `${key}-cognitive.log`),
    path.join(AGENT_RUN_LOG_DIR, `${key}-listener.log`),
    path.join(AGENT_RUN_LOG_DIR, `${key}-platform-mcp.log`)
  ];

  for (const filePath of candidateFiles) {
    try {
      const raw = await readFile(filePath, "utf8");
      const relevant = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter(isRelevantListenerLine);
      if (relevant.length) {
        return relevant.slice(-limit).map((line) => (line.startsWith("[") ? line : `[${key}] ${line}`));
      }
    } catch {}
  }

  return [];
}
