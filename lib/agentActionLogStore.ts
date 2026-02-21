import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AgentActionOutcome = "info" | "success" | "failure";

export type AgentActionStatus =
  | "ACTION_REQUESTED"
  | "IDENTITY_PROOF_ATTACHED"
  | "IDENTITY_PROOF_FAILED"
  | "X402_PAYMENT_REQUIRED"
  | "X402_SETTLEMENT_ATTEMPTED"
  | "X402_SETTLEMENT_CONFIRMED"
  | "X402_SETTLEMENT_FAILED"
  | "ACTION_COMPLETED"
  | "ACTION_FAILED";

export type AgentActionLogEntry = {
  id: string;
  actionId: string;
  actionType: string;
  route: string;
  method: string;
  stage: string;
  status: string;
  outcome: AgentActionOutcome;
  agentId: string | null;
  agentName: string | null;
  postId: string | null;
  bidAmountCents: number | null;
  paymentNetwork: string | null;
  paymentTxHash: string | null;
  x402PaymentRequired: boolean | null;
  x402Amount: string | null;
  x402Currency: string | null;
  x402TokenAddress: string | null;
  facilitatorResponseCode: string | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  identityScheme: string | null;
  identityProofRef: string | null;
  identitySubject: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AgentActionSummary = {
  actionId: string;
  actionType: string;
  agentId: string | null;
  agentName: string | null;
  postId: string | null;
  paymentNetwork: string | null;
  paymentTxHash: string | null;
  x402Amount: string | null;
  x402Currency: string | null;
  x402TokenAddress: string | null;
  latestStatus: string;
  latestOutcome: AgentActionOutcome;
  failureCode: string | null;
  failureMessage: string | null;
  identityScheme: string | null;
  identitySubject: string | null;
  firstAt: string;
  lastAt: string;
  statuses: string[];
};

export type AgentActionStats = {
  total: number;
  success: number;
  failure: number;
  byStatus: Array<{ status: string; count: number }>;
  byNetwork: Array<{ network: string; count: number }>;
  failureReasons: Array<{ failureCode: string; count: number }>;
};

export function generateAgentActionId(): string {
  const timestamp = Date.now().toString(36);
  const suffix = crypto.randomBytes(6).toString("hex");
  return `act_${timestamp}_${suffix}`;
}

function generateLogId(): string {
  return `aal_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
}

function toMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function deriveStatus(stage: string, outcome: AgentActionOutcome): AgentActionStatus {
  const normalizedStage = stage.trim().toUpperCase();

  const knownStatuses: AgentActionStatus[] = [
    "ACTION_REQUESTED",
    "IDENTITY_PROOF_ATTACHED",
    "IDENTITY_PROOF_FAILED",
    "X402_PAYMENT_REQUIRED",
    "X402_SETTLEMENT_ATTEMPTED",
    "X402_SETTLEMENT_CONFIRMED",
    "X402_SETTLEMENT_FAILED",
    "ACTION_COMPLETED",
    "ACTION_FAILED"
  ];

  const known = knownStatuses.find((status) => normalizedStage === status);
  if (known) {
    return known;
  }

  if (outcome === "success") {
    return "ACTION_COMPLETED";
  }

  if (outcome === "failure") {
    return "ACTION_FAILED";
  }

  return "ACTION_REQUESTED";
}

function isMissingTableOrColumnError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function appendAgentActionLog(input: {
  actionId: string;
  actionType?: string;
  route: string;
  method: string;
  stage: string;
  status?: AgentActionStatus;
  outcome: AgentActionOutcome;
  agentId?: string | null;
  agentName?: string | null;
  postId?: string | null;
  bidAmountCents?: number | null;
  paymentNetwork?: string | null;
  paymentTxHash?: string | null;
  x402PaymentRequired?: boolean | null;
  x402Amount?: string | null;
  x402Currency?: string | null;
  x402TokenAddress?: string | null;
  facilitatorResponseCode?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  identityScheme?: string | null;
  identityProofRef?: string | null;
  identitySubject?: string | null;
  metadata?: unknown;
}): Promise<void> {
  const status = input.status ?? deriveStatus(input.stage, input.outcome);

  await prisma.agentActionLog.create({
    data: {
      id: generateLogId(),
      actionId: input.actionId.trim(),
      actionType: input.actionType?.trim().slice(0, 64) || "agent_paid_action",
      route: input.route.trim().slice(0, 128),
      method: input.method.trim().toUpperCase().slice(0, 12),
      stage: input.stage.trim().slice(0, 64),
      status,
      outcome: input.outcome,
      agentId: input.agentId?.trim() || null,
      agentName: input.agentName?.trim() || null,
      postId: input.postId?.trim() || null,
      bidAmountCents: typeof input.bidAmountCents === "number" ? input.bidAmountCents : null,
      paymentNetwork: input.paymentNetwork?.trim() || null,
      paymentTxHash: input.paymentTxHash?.trim() || null,
      x402PaymentRequired: typeof input.x402PaymentRequired === "boolean" ? input.x402PaymentRequired : null,
      x402Amount: input.x402Amount?.trim() || null,
      x402Currency: input.x402Currency?.trim() || null,
      x402TokenAddress: input.x402TokenAddress?.trim() || null,
      facilitatorResponseCode: input.facilitatorResponseCode?.trim() || null,
      httpStatus: typeof input.httpStatus === "number" ? input.httpStatus : null,
      errorCode: input.errorCode?.trim() || null,
      errorMessage: input.errorMessage?.trim() || null,
      failureCode: input.failureCode?.trim() || input.errorCode?.trim() || null,
      failureMessage: input.failureMessage?.trim() || input.errorMessage?.trim() || null,
      identityScheme: input.identityScheme?.trim() || null,
      identityProofRef: input.identityProofRef?.trim() || null,
      identitySubject: input.identitySubject?.trim() || null,
      metadata: toMetadata(input.metadata)
    }
  });
}

function toAgentActionLogEntry(record: {
  id: string;
  actionId: string;
  actionType: string;
  route: string;
  method: string;
  stage: string;
  status: string;
  outcome: string;
  agentId: string | null;
  agentName: string | null;
  postId: string | null;
  bidAmountCents: number | null;
  paymentNetwork: string | null;
  paymentTxHash: string | null;
  x402PaymentRequired: boolean | null;
  x402Amount: string | null;
  x402Currency: string | null;
  x402TokenAddress: string | null;
  facilitatorResponseCode: string | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  identityScheme: string | null;
  identityProofRef: string | null;
  identitySubject: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): AgentActionLogEntry {
  const outcome = record.outcome === "success" || record.outcome === "failure" ? record.outcome : "info";
  return {
    id: record.id,
    actionId: record.actionId,
    actionType: record.actionType,
    route: record.route,
    method: record.method,
    stage: record.stage,
    status: record.status,
    outcome,
    agentId: record.agentId,
    agentName: record.agentName,
    postId: record.postId,
    bidAmountCents: record.bidAmountCents,
    paymentNetwork: record.paymentNetwork,
    paymentTxHash: record.paymentTxHash,
    x402PaymentRequired: record.x402PaymentRequired,
    x402Amount: record.x402Amount,
    x402Currency: record.x402Currency,
    x402TokenAddress: record.x402TokenAddress,
    facilitatorResponseCode: record.facilitatorResponseCode,
    httpStatus: record.httpStatus,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    identityScheme: record.identityScheme,
    identityProofRef: record.identityProofRef,
    identitySubject: record.identitySubject,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString()
  };
}

type AgentActionLogRow = Awaited<
  ReturnType<typeof prisma.agentActionLog.findMany>
>[number];

export async function listAgentActionLogsByAgentId(
  agentId: string,
  options?: { limit?: number; network?: string; status?: string }
): Promise<AgentActionLogEntry[]> {
  const limitRaw = options?.limit ?? 60;
  const take = Math.min(500, Math.max(1, Math.floor(limitRaw)));
  const network = String(options?.network ?? "").trim();
  const status = String(options?.status ?? "").trim();

  try {
    const rows = await prisma.agentActionLog.findMany({
      where: {
        agentId: agentId.trim(),
        ...(network ? { paymentNetwork: network } : {}),
        ...(status ? { status } : {})
      },
      orderBy: [{ createdAt: "desc" }],
      take
    });
    return rows.map((row) => toAgentActionLogEntry(row as AgentActionLogRow));
  } catch (error) {
    if (isMissingTableOrColumnError(error)) {
      return [];
    }
    throw error;
  }
}

export async function listAgentActionLogs(options?: {
  limit?: number;
  postId?: string;
  agentId?: string;
  network?: string;
  status?: string;
}): Promise<AgentActionLogEntry[]> {
  const limitRaw = options?.limit ?? 120;
  const take = Math.min(1000, Math.max(1, Math.floor(limitRaw)));
  const where: {
    postId?: string;
    agentId?: string;
    paymentNetwork?: string;
    status?: string;
  } = {};
  if (options?.postId?.trim()) {
    where.postId = options.postId.trim();
  }
  if (options?.agentId?.trim()) {
    where.agentId = options.agentId.trim();
  }
  if (options?.network?.trim()) {
    where.paymentNetwork = options.network.trim();
  }
  if (options?.status?.trim()) {
    where.status = options.status.trim();
  }
  try {
    const rows = await prisma.agentActionLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take
    });
    return rows.map((row) => toAgentActionLogEntry(row as AgentActionLogRow));
  } catch (error) {
    if (isMissingTableOrColumnError(error)) {
      return [];
    }
    throw error;
  }
}

export function summarizeAgentActionLogs(logs: AgentActionLogEntry[]): AgentActionSummary[] {
  const grouped = new Map<string, AgentActionLogEntry[]>();

  for (const entry of logs) {
    const existing = grouped.get(entry.actionId);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(entry.actionId, [entry]);
    }
  }

  return Array.from(grouped.entries())
    .map(([, entries]) => {
      const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      const statusSet = new Set(sorted.map((entry) => entry.status));
      const failure = [...sorted].reverse().find((entry) => entry.failureCode || entry.failureMessage) ?? null;

      return {
        actionId: first.actionId,
        actionType: first.actionType,
        agentId: first.agentId,
        agentName: first.agentName,
        postId: first.postId,
        paymentNetwork: latest.paymentNetwork ?? first.paymentNetwork,
        paymentTxHash: latest.paymentTxHash ?? first.paymentTxHash,
        x402Amount: latest.x402Amount ?? first.x402Amount,
        x402Currency: latest.x402Currency ?? first.x402Currency,
        x402TokenAddress: latest.x402TokenAddress ?? first.x402TokenAddress,
        latestStatus: latest.status,
        latestOutcome: latest.outcome,
        failureCode: failure?.failureCode ?? null,
        failureMessage: failure?.failureMessage ?? null,
        identityScheme: latest.identityScheme ?? first.identityScheme,
        identitySubject: latest.identitySubject ?? first.identitySubject,
        firstAt: first.createdAt,
        lastAt: latest.createdAt,
        statuses: Array.from(statusSet)
      } satisfies AgentActionSummary;
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function getAgentActionStats(options?: { network?: string }): Promise<AgentActionStats> {
  const network = String(options?.network ?? "").trim();
  const where = network ? { paymentNetwork: network } : undefined;

  try {
    const [total, success, failure, byStatusRows, byNetworkRows, failureCodeRows] = await Promise.all([
      prisma.agentActionLog.count({ where }),
      prisma.agentActionLog.count({ where: { ...(where ?? {}), outcome: "success" } }),
      prisma.agentActionLog.count({ where: { ...(where ?? {}), outcome: "failure" } }),
      prisma.agentActionLog.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      }),
      prisma.agentActionLog.groupBy({
        by: ["paymentNetwork"],
        where,
        _count: { _all: true }
      }),
      prisma.agentActionLog.groupBy({
        by: ["failureCode"],
        where: {
          ...(where ?? {}),
          failureCode: { not: null }
        },
        _count: { _all: true }
      })
    ]);

    return {
      total,
      success,
      failure,
      byStatus: byStatusRows
        .map((row) => ({ status: row.status, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
      byNetwork: byNetworkRows
        .map((row) => ({ network: row.paymentNetwork ?? "unknown", count: row._count._all }))
        .sort((a, b) => b.count - a.count),
      failureReasons: failureCodeRows
        .map((row) => ({ failureCode: row.failureCode ?? "unknown", count: row._count._all }))
        .sort((a, b) => b.count - a.count)
    };
  } catch (error) {
    if (isMissingTableOrColumnError(error)) {
      return {
        total: 0,
        success: 0,
        failure: 0,
        byStatus: [],
        byNetwork: [],
        failureReasons: []
      };
    }
    throw error;
  }
}
