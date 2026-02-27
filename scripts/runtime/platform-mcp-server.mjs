import http from "node:http";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

const PORT = Number(process.env.PLATFORM_MCP_PORT ?? 8795);
const APP_BASE_URL = String(process.env.APP_BASE_URL ?? "http://localhost:3000").trim();
const AGENT_ACCESS_TOKEN = String(process.env.AGENT_ACCESS_TOKEN ?? "").trim();
const LOG_DIR = path.resolve(process.env.AGENT_LOG_DIR ?? ".agent-run-logs");
const STATE_FILE = path.resolve(process.env.AGENT_TOOL_STATE_FILE ?? ".agent-tool-state.json");
const ACTION_LOG_FILE = path.join(LOG_DIR, "agent-actions.log");
const AGENT_MAX_ACTIONS_PER_MINUTE = Number(process.env.AGENT_TOOL_RATE_LIMIT_PER_MINUTE ?? 60);
const AGENT_ID = String(process.env.AGENT_ID ?? process.env.AGENT_RUNTIME_AGENT_ID ?? "").trim();

const runtime = {
  state: {
    callsByMinute: new Map(),
    idempotency: {}
  }
};

function nowIso() {
  return new Date().toISOString();
}

function fail(message, status = 400, details = undefined) {
  const error = { ok: false, error: message };
  if (details !== undefined) {
    error.details = details;
  }
  return { status, body: error };
}

function jsonResponse(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(payload);
}

function minuteKey() {
  return new Date().toISOString().slice(0, 16);
}

function checkRateLimit() {
  const key = minuteKey();
  const current = Number(runtime.state.callsByMinute.get(key) ?? 0);
  if (current >= AGENT_MAX_ACTIONS_PER_MINUTE) {
    return false;
  }
  runtime.state.callsByMinute.set(key, current + 1);
  for (const [k] of runtime.state.callsByMinute) {
    if (k < key) runtime.state.callsByMinute.delete(k);
  }
  return true;
}

async function ensureRuntimeFiles() {
  await mkdir(LOG_DIR, { recursive: true });
  try {
    await readFile(STATE_FILE, "utf8");
  } catch {
    await writeFile(STATE_FILE, JSON.stringify({ idempotency: {} }, null, 2));
  }
}

async function logAction(event, payload = {}) {
  const line = JSON.stringify({ ts: nowIso(), event, ...payload });
  await appendFile(ACTION_LOG_FILE, `${line}\n`, "utf8");
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${APP_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(AGENT_ACCESS_TOKEN ? { Authorization: `Bearer ${AGENT_ACCESS_TOKEN}` } : {}),
      ...(options.headers ?? {})
    }
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function tool_list_open_questions(args) {
  const wikiId = String(args?.wikiId ?? "").trim();
  const query = wikiId ? `?wikiId=${encodeURIComponent(wikiId)}` : "";
  const { response, body } = await fetchJson(`/api/posts${query}`);
  if (!response.ok) {
    return fail("Failed to list posts.", response.status, body);
  }
  return {
    status: 200,
    body: {
      ok: true,
      posts: Array.isArray(body?.posts) ? body.posts : []
    }
  };
}

async function tool_get_question(args) {
  const postId = String(args?.postId ?? "").trim();
  if (!postId) {
    return fail("postId is required.");
  }
  const { response, body } = await fetchJson(`/api/posts/${encodeURIComponent(postId)}`);
  if (!response.ok) {
    return fail("Failed to fetch post.", response.status, body);
  }
  return {
    status: 200,
    body: {
      ok: true,
      post: body?.post ?? null
    }
  };
}

async function tool_post_answer(args) {
  const postId = String(args?.postId ?? "").trim();
  const content = String(args?.content ?? "").trim();
  const idempotencyKey = String(args?.idempotencyKey ?? "").trim();

  if (!postId) return fail("postId is required.");
  if (!content) return fail("content is required.");
  if (!AGENT_ACCESS_TOKEN) return fail("Missing AGENT_ACCESS_TOKEN.", 401);
  if (!checkRateLimit()) return fail("Rate limit exceeded.", 429);

  if (idempotencyKey && runtime.state.idempotency[idempotencyKey]) {
    return {
      status: 200,
      body: { ok: true, reused: true, result: runtime.state.idempotency[idempotencyKey] }
    };
  }

  const actionId = randomUUID();
  const { response, body } = await fetchJson(`/api/posts/${encodeURIComponent(postId)}/answers`, {
    method: "POST",
    headers: { "x-agent-action-id": actionId },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    await logAction("answer_failed", { actionId, postId, status: response.status, error: body?.error ?? null });
    return fail(body?.error ?? "Failed to submit answer.", response.status, body);
  }

  const result = {
    actionId,
    postId,
    answerId: body?.answer?.id ?? null,
    createdAt: body?.answer?.createdAt ?? nowIso()
  };

  if (idempotencyKey) {
    runtime.state.idempotency[idempotencyKey] = result;
    await writeFile(STATE_FILE, JSON.stringify({ idempotency: runtime.state.idempotency }, null, 2));
  }

  await logAction("answer_posted", { actionId, postId, answerId: result.answerId });

  return {
    status: 200,
    body: {
      ok: true,
      result
    }
  };
}

async function tool_get_current_post_state(args) {
  const postId = String(args?.postId ?? "").trim();
  if (!postId) return fail("postId is required.");

  const [postResult, answersResult] = await Promise.all([
    fetchJson(`/api/posts/${encodeURIComponent(postId)}`),
    fetchJson(`/api/posts/${encodeURIComponent(postId)}/answers`)
  ]);

  if (!postResult.response.ok) {
    return fail("Failed to fetch post state.", postResult.response.status, postResult.body);
  }

  const post = postResult.body?.post ?? null;
  const answers = Array.isArray(answersResult.body?.answers) ? answersResult.body.answers : [];

  return {
    status: 200,
    body: {
      ok: true,
      postId,
      post,
      answerCount: answers.length,
      answers
    }
  };
}

const tools = {
  list_open_questions: tool_list_open_questions,
  get_question: tool_get_question,
  post_answer: tool_post_answer,
  get_current_post_state: tool_get_current_post_state
};

function mcpToolList() {
  return [
    {
      name: "list_open_questions",
      description: "List posts that agents can respond to.",
      inputSchema: {
        type: "object",
        properties: { wikiId: { type: "string" } }
      }
    },
    {
      name: "get_question",
      description: "Fetch a single post by id.",
      inputSchema: {
        type: "object",
        properties: { postId: { type: "string" } },
        required: ["postId"]
      }
    },
    {
      name: "post_answer",
      description: "Submit an answer to a post.",
      inputSchema: {
        type: "object",
        properties: {
          postId: { type: "string" },
          content: { type: "string" },
          idempotencyKey: { type: "string" }
        },
        required: ["postId", "content"]
      }
    },
    {
      name: "get_current_post_state",
      description: "Return current post + answer state.",
      inputSchema: {
        type: "object",
        properties: { postId: { type: "string" } },
        required: ["postId"]
      }
    }
  ];
}

async function handleMcp(req, res, body) {
  const payload = body ? JSON.parse(body) : {};
  const method = String(payload?.method ?? "");
  const id = payload?.id ?? null;

  if (method === "initialize") {
    return jsonResponse(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "wikaipedia-platform-mcp", version: "0.2.0" },
        capabilities: { tools: {} }
      }
    });
  }

  if (method === "tools/list") {
    return jsonResponse(res, 200, {
      jsonrpc: "2.0",
      id,
      result: { tools: mcpToolList() }
    });
  }

  if (method === "tools/call") {
    const name = String(payload?.params?.name ?? "");
    const args = payload?.params?.arguments ?? {};
    const handler = tools[name];
    if (!handler) {
      return jsonResponse(res, 200, {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${name}` }
      });
    }

    const result = await handler(args);
    return jsonResponse(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result.body) }],
        isError: result.status >= 400
      }
    });
  }

  return jsonResponse(res, 200, {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unsupported method: ${method}` }
  });
}

await ensureRuntimeFiles();

const server = http.createServer(async (req, res) => {
  const pathname = String(req.url ?? "").split("?")[0] || "/";

  if (req.method === "GET" && pathname === "/health") {
    return jsonResponse(res, 200, {
      ok: true,
      now: nowIso(),
      appBaseUrl: APP_BASE_URL,
      agentId: AGENT_ID || null,
      hasToken: Boolean(AGENT_ACCESS_TOKEN)
    });
  }

  if (req.method === "POST" && pathname === "/mcp") {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        await handleMcp(req, res, body);
      } catch (error) {
        jsonResponse(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    return;
  }

  return jsonResponse(res, 404, { ok: false, error: "Not found." });
});

server.listen(PORT, () => {
  console.log(
    `[platform-mcp] listening on http://localhost:${PORT}/mcp appBaseUrl=${APP_BASE_URL} agentId=${AGENT_ID || "unset"}`
  );
});
