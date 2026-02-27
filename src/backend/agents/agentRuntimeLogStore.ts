import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/database/prisma";

export type AgentRuntimeLogLevel = "info" | "success" | "failure";

export type AgentRuntimeLogEntry = {
  id: string;
  actionId: string;
  agentId: string | null;
  agentName: string | null;
  postId: string | null;
  eventType: string;
  level: AgentRuntimeLogLevel;
  message: string | null;
  payload: unknown;
  source: string;
  createdAt: string;
};

let ensureTablePromise: Promise<void> | null = null;

function generateRuntimeLogId(): string {
  return `arl_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
}

function toMetadata(value: unknown): Prisma.InputJsonValue | null {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

async function ensureRuntimeLogTable(): Promise<void> {
  if (ensureTablePromise) {
    await ensureTablePromise;
    return;
  }

  ensureTablePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AgentRuntimeLog" (
        "id" VARCHAR(64) PRIMARY KEY,
        "actionId" VARCHAR(96) NOT NULL,
        "agentId" VARCHAR(64),
        "agentName" VARCHAR(80),
        "postId" VARCHAR(64),
        "eventType" VARCHAR(64) NOT NULL,
        "level" VARCHAR(16) NOT NULL DEFAULT 'info',
        "message" TEXT,
        "payload" JSONB,
        "source" VARCHAR(32) NOT NULL DEFAULT 'agent-runtime',
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AgentRuntimeLog_agentId_createdAt_idx" ON "AgentRuntimeLog" ("agentId", "createdAt");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AgentRuntimeLog_postId_createdAt_idx" ON "AgentRuntimeLog" ("postId", "createdAt");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AgentRuntimeLog_eventType_createdAt_idx" ON "AgentRuntimeLog" ("eventType", "createdAt");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AgentRuntimeLog_createdAt_idx" ON "AgentRuntimeLog" ("createdAt");`
    );
  })();

  await ensureTablePromise;
}

export async function appendAgentRuntimeLog(input: {
  actionId: string;
  agentId?: string | null;
  agentName?: string | null;
  postId?: string | null;
  eventType: string;
  level: AgentRuntimeLogLevel;
  message?: string | null;
  payload?: unknown;
  source?: string;
}): Promise<void> {
  await ensureRuntimeLogTable();

  const payload = toMetadata(input.payload);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "AgentRuntimeLog"
      ("id","actionId","agentId","agentName","postId","eventType","level","message","payload","source")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
    `,
    generateRuntimeLogId(),
    input.actionId.trim(),
    input.agentId?.trim() || null,
    input.agentName?.trim() || null,
    input.postId?.trim() || null,
    input.eventType.trim().slice(0, 64),
    input.level,
    input.message?.trim() || null,
    payload ? JSON.stringify(payload) : null,
    input.source?.trim().slice(0, 32) || "agent-runtime"
  );
}

export async function listAgentRuntimeLogs(options?: {
  limit?: number;
  postId?: string;
  agentId?: string;
  includeNeutral?: boolean;
}): Promise<AgentRuntimeLogEntry[]> {
  await ensureRuntimeLogTable();

  const limitRaw = options?.limit ?? 120;
  const take = Math.min(500, Math.max(1, Math.floor(limitRaw)));
  const where: string[] = [];
  const values: unknown[] = [];

  if (options?.postId?.trim()) {
    values.push(options.postId.trim());
    where.push(`"postId" = $${values.length}`);
  }
  if (options?.agentId?.trim()) {
    values.push(options.agentId.trim());
    where.push(`"agentId" = $${values.length}`);
  }
  if (!options?.includeNeutral) {
    where.push(`"level" <> 'info'`);
  }

  values.push(take);
  const sql = `
    SELECT
      "id",
      "actionId",
      "agentId",
      "agentName",
      "postId",
      "eventType",
      "level",
      "message",
      "payload",
      "source",
      "createdAt"
    FROM "AgentRuntimeLog"
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY "createdAt" DESC
    LIMIT $${values.length}
  `;

  type RuntimeLogRow = {
    id: string;
    actionId: string;
    agentId: string | null;
    agentName: string | null;
    postId: string | null;
    eventType: string;
    level: string;
    message: string | null;
    payload: Prisma.JsonValue | null;
    source: string;
    createdAt: Date;
  };

  const rows = (await prisma.$queryRawUnsafe(sql, ...values)) as RuntimeLogRow[];
  return rows.map((row) => {
    const level: AgentRuntimeLogLevel =
      row.level === "success" || row.level === "failure" ? row.level : "info";
    return {
      id: row.id,
      actionId: row.actionId,
      agentId: row.agentId,
      agentName: row.agentName,
      postId: row.postId,
      eventType: row.eventType,
      level,
      message: row.message,
      payload: row.payload,
      source: row.source,
      createdAt: row.createdAt.toISOString()
    };
  });
}
