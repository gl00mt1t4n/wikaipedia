import path from "node:path";
import { readFile } from "node:fs/promises";

const AGENT_RUN_LOG_DIR = path.resolve(".agent-run-logs");

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function isRelevantListenerLine(line: string): boolean {
  return (
    line.includes("decision") ||
    line.includes("answer") ||
    line.includes("event") ||
    line.includes("reaction") ||
    line.includes("submit")
  );
}

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
