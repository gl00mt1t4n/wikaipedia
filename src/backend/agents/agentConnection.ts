import { spawn } from "node:child_process";
import type { AgentTransport } from "@/types";

type VerifyInput = {
  transport: AgentTransport;
  mcpServerUrl: string;
  entrypointCommand?: string;
};

type VerifyResult = {
  ok: boolean;
  error?: string;
  capabilities?: string[];
};

const MCP_INITIALIZE_PAYLOAD = {
  jsonrpc: "2.0",
  id: "signup-probe",
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "agentexchange-signup",
      version: "0.1.0"
    }
  }
};

async function verifyHttpEndpoint(url: string): Promise<VerifyResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(MCP_INITIALIZE_PAYLOAD),
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP endpoint responded ${response.status}.` };
    }

    const data = (await response.json().catch(() => ({}))) as {
      result?: { capabilities?: Record<string, unknown> };
    };

    const capabilities = data.result?.capabilities ? Object.keys(data.result.capabilities) : ["mcp-http"];

    return { ok: true, capabilities };
  } catch {
    return { ok: false, error: "Could not reach HTTP MCP endpoint." };
  } finally {
    clearTimeout(timeout);
  }
}

async function verifySseEndpoint(url: string): Promise<VerifyResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, error: `SSE endpoint responded ${response.status}.` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      return { ok: false, error: "Endpoint is reachable but not an SSE stream." };
    }

    return { ok: true, capabilities: ["mcp-sse"] };
  } catch {
    return { ok: false, error: "Could not reach SSE MCP endpoint." };
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyStdio(entrypointCommand?: string): Promise<VerifyResult> {
  if (!entrypointCommand?.trim()) {
    return { ok: false, error: "Stdio transport requires an entrypoint command." };
  }

  return new Promise((resolve) => {
    const child = spawn(entrypointCommand, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, error: "Stdio MCP process did not respond in time." });
    }, 6000);

    let settled = false;

    const finish = (result: VerifyResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      try {
        child.kill("SIGKILL");
      } catch {}
      resolve(result);
    };

    child.on("error", () => {
      finish({ ok: false, error: "Failed to launch stdio MCP command." });
    });

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text.includes("result") || text.includes("capabilities")) {
        finish({ ok: true, capabilities: ["mcp-stdio"] });
      }
    });

    child.stderr.on("data", () => {
      // Ignore stderr noise unless process exits with no stdout.
    });

    child.on("exit", (code) => {
      if (!settled) {
        finish({ ok: false, error: `Stdio MCP command exited early (${code ?? "unknown"}).` });
      }
    });

    child.stdin.write(`${JSON.stringify(MCP_INITIALIZE_PAYLOAD)}\n`);
  });
}

export async function verifyAgentConnection(input: VerifyInput): Promise<VerifyResult> {
  if (input.transport === "http") {
    return verifyHttpEndpoint(input.mcpServerUrl);
  }

  if (input.transport === "sse") {
    return verifySseEndpoint(input.mcpServerUrl);
  }

  return verifyStdio(input.entrypointCommand);
}
