import crypto from "node:crypto";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadLocalEnv } from "../lib/load-local-env.mjs";

loadLocalEnv();

// Dynamic import for ERC-8004 (TypeScript module)
let erc8004Module = null;
async function getErc8004() {
  if (!erc8004Module) {
    try {
      erc8004Module = await import("../lib/erc8004.js");
    } catch {
      erc8004Module = { configured: false };
    }
  }
  return erc8004Module;
}

if (!process.env.DATABASE_URL && (process.env.DIRECT_URL ?? "").trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

const DEFAULT_OWNER_WALLET = "0x1111111111111111111111111111111111111111";
const DEFAULT_OWNER_USERNAME = "local_test_owner";
const DEFAULT_WIKI_ID = "general";
const DEFAULT_WIKI_DISPLAY_NAME = "General";
const DEFAULT_WIKI_DESCRIPTION = "General wiki for broad questions.";

const CONFIG_PATH = path.resolve(
  String(process.env.OPENCLAW_SWARM_CONFIG ?? "test/openclaw-agents.local.json").trim()
);
const AGENT_COUNT = Number(process.env.OPENCLAW_SWARM_COUNT ?? process.argv[2] ?? 8);
const MCP_URL = String(process.env.OPENCLAW_SWARM_MCP_URL ?? "http://localhost:8790/mcp").trim();
const OWNER_WALLET_ADDRESS = String(process.env.OPENCLAW_SWARM_OWNER_WALLET ?? DEFAULT_OWNER_WALLET)
  .trim()
  .toLowerCase();
const OWNER_USERNAME = String(process.env.OPENCLAW_SWARM_OWNER_USERNAME ?? DEFAULT_OWNER_USERNAME).trim();
const PERSONA_CATALOG = [
  {
    codename: "tech-builder",
    specialties: ["software-engineering", "web3", "product-architecture"],
    temperament: "analytical",
    riskStyle: "balanced",
    interactionStyle: "precise"
  },
  {
    codename: "sports-analyst",
    specialties: ["sports", "fitness", "competition-strategy"],
    temperament: "energetic",
    riskStyle: "aggressive",
    interactionStyle: "direct"
  },
  {
    codename: "game-master",
    specialties: ["gaming", "esports", "game-design"],
    temperament: "playful",
    riskStyle: "balanced",
    interactionStyle: "concise"
  },
  {
    codename: "bookworm-critic",
    specialties: ["books", "literature", "writing"],
    temperament: "reflective",
    riskStyle: "conservative",
    interactionStyle: "explanatory"
  },
  {
    codename: "market-observer",
    specialties: ["finance", "economics", "markets"],
    temperament: "skeptical",
    riskStyle: "conservative",
    interactionStyle: "high-signal"
  },
  {
    codename: "science-guide",
    specialties: ["science", "space", "health"],
    temperament: "curious",
    riskStyle: "balanced",
    interactionStyle: "structured"
  },
  {
    codename: "culture-curator",
    specialties: ["movies", "music", "pop-culture"],
    temperament: "social",
    riskStyle: "balanced",
    interactionStyle: "insightful"
  },
  {
    codename: "life-coach",
    specialties: ["career", "habits", "self-improvement"],
    temperament: "supportive",
    riskStyle: "balanced",
    interactionStyle: "empathetic"
  }
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function nowId(prefix = "") {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateAccessToken() {
  return `ag_${crypto.randomBytes(24).toString("hex")}`;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function ensureDefaultWiki() {
  await prisma.wiki.upsert({
    where: { id: DEFAULT_WIKI_ID },
    update: {},
    create: {
      id: DEFAULT_WIKI_ID,
      displayName: DEFAULT_WIKI_DISPLAY_NAME,
      description: DEFAULT_WIKI_DESCRIPTION,
      createdBy: "system"
    }
  });
}

async function ensureDefaultWikiMembership(agentId) {
  await ensureDefaultWiki();
  await prisma.agentWikiMembership.upsert({
    where: {
      agentId_wikiId: {
        agentId,
        wikiId: DEFAULT_WIKI_ID
      }
    },
    update: {},
    create: {
      id: nowId("awm_"),
      agentId,
      wikiId: DEFAULT_WIKI_ID,
      subscribedAt: new Date()
    }
  });
}

async function loadExistingConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const agents = Array.isArray(parsed?.agents) ? parsed.agents : [];
    return agents;
  } catch {
    return [];
  }
}

function normalizeExistingMap(agents) {
  const map = new Map();
  for (const agent of agents) {
    const name = String(agent?.name ?? "").trim();
    if (!name) continue;
    map.set(name.toLowerCase(), {
      name,
      accessToken: String(agent?.accessToken ?? "").trim(),
      basePrivateKey: String(agent?.basePrivateKey ?? "").trim(),
      baseWalletAddress: String(agent?.baseWalletAddress ?? "").trim(),
      description: String(agent?.description ?? "").trim(),
      mcpServerUrl: String(agent?.mcpServerUrl ?? "").trim(),
      interests: String(agent?.interests ?? "").trim(),
      personaProfile: agent?.personaProfile && typeof agent.personaProfile === "object" ? agent.personaProfile : null,
      erc8004TokenId: typeof agent?.erc8004TokenId === "number" ? agent.erc8004TokenId : null,
      erc8004ChainId: typeof agent?.erc8004ChainId === "number" ? agent.erc8004ChainId : null,
      erc8004IdentityRegistry: String(agent?.erc8004IdentityRegistry ?? "").trim() || null,
      erc8004TxHash: String(agent?.erc8004TxHash ?? "").trim() || null
    });
  }
  return map;
}

async function upsertAgentRecord(input) {
  const existing = await prisma.agent.findFirst({
    where: {
      ownerWalletAddress: OWNER_WALLET_ADDRESS,
      name: {
        equals: input.name,
        mode: "insensitive"
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const now = new Date();
  const erc8004Data = input.erc8004TokenId != null ? {
    erc8004ChainId: input.erc8004ChainId,
    erc8004TokenId: input.erc8004TokenId,
    erc8004IdentityRegistry: input.erc8004IdentityRegistry,
    erc8004RegisteredAt: input.erc8004RegisteredAt ?? now,
    erc8004TxHash: input.erc8004TxHash
  } : {};

  if (existing) {
    const updated = await prisma.agent.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        baseWalletAddress: input.baseWalletAddress,
        mcpServerUrl: input.mcpServerUrl,
        transport: "http",
        entrypointCommand: null,
        tags: [],
        updatedAt: now,
        status: "active",
        authTokenHash: input.authTokenHash,
        verificationStatus: "verified",
        verificationError: null,
        verifiedAt: now,
        capabilities: ["tools"],
        ...erc8004Data
      }
    });
    return { action: "updated", agent: updated };
  }

  const created = await prisma.agent.create({
    data: {
      id: nowId("agnt_"),
      ownerWalletAddress: OWNER_WALLET_ADDRESS,
      ownerUsername: OWNER_USERNAME,
      name: input.name,
      description: input.description,
      totalLikes: 0,
      baseWalletAddress: input.baseWalletAddress,
      mcpServerUrl: input.mcpServerUrl,
      transport: "http",
      entrypointCommand: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
      status: "active",
      authTokenHash: input.authTokenHash,
      verificationStatus: "verified",
      verificationError: null,
      verifiedAt: now,
      capabilities: ["tools"],
      ...erc8004Data
    }
  });
  return { action: "created", agent: created };
}

function buildAgentName(index) {
  return `openclaw-${String(index + 1).padStart(2, "0")}`;
}

function buildAgentDescription(persona) {
  return `OpenClaw agent persona=${persona.codename}; specialties=${persona.specialties.join(", ")}; style=${persona.interactionStyle}; risk=${persona.riskStyle}.`;
}

function buildPersona(index) {
  const template = PERSONA_CATALOG[index % PERSONA_CATALOG.length];
  return {
    ...template,
    personaId: `${template.codename}-${String(index + 1).padStart(2, "0")}`
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    fail("Missing DATABASE_URL (or DIRECT_URL).");
  }
  if (!Number.isFinite(AGENT_COUNT) || AGENT_COUNT < 1 || AGENT_COUNT > 200) {
    fail("OPENCLAW_SWARM_COUNT must be between 1 and 200.");
  }
  if (!MCP_URL.startsWith("http://") && !MCP_URL.startsWith("https://")) {
    fail("OPENCLAW_SWARM_MCP_URL must be an http(s) URL.");
  }
  if (!isWalletAddress(OWNER_WALLET_ADDRESS)) {
    fail("OPENCLAW_SWARM_OWNER_WALLET must be a valid wallet address.");
  }
  if (!OWNER_USERNAME) {
    fail("OPENCLAW_SWARM_OWNER_USERNAME cannot be empty.");
  }

  // Check ERC-8004 configuration
  const erc8004 = await getErc8004();
  const erc8004Config = erc8004.getErc8004Config?.() ?? { configured: false };
  const erc8004Enabled = erc8004Config.configured;
  
  if (erc8004Enabled) {
    console.log(`ERC-8004 enabled: chainId=${erc8004Config.chainId}, registry=${erc8004Config.identityRegistry}`);
  } else {
    console.log("ERC-8004 not configured. Agents will be created without on-chain identity.");
    console.log("Set ERC8004_IDENTITY_REGISTRY and ERC8004_REPUTATION_REGISTRY to enable.");
  }

  const existingAgents = await loadExistingConfig();
  const existingByName = normalizeExistingMap(existingAgents);
  const outputAgents = [];

  for (let i = 0; i < AGENT_COUNT; i += 1) {
    const name = buildAgentName(i);
    const previous = existingByName.get(name.toLowerCase());
    const persona = previous?.personaProfile ?? buildPersona(i);
    const description = buildAgentDescription(persona);

    const basePrivateKey = previous?.basePrivateKey || generatePrivateKey();
    const baseWalletAddress = privateKeyToAccount(basePrivateKey).address;
    const accessToken = previous?.accessToken || generateAccessToken();
    const authTokenHash = hashToken(accessToken);

    // ERC-8004 registration
    let erc8004TokenId = previous?.erc8004TokenId ?? null;
    let erc8004ChainId = previous?.erc8004ChainId ?? null;
    let erc8004IdentityRegistry = previous?.erc8004IdentityRegistry ?? null;
    let erc8004TxHash = previous?.erc8004TxHash ?? null;

    if (erc8004Enabled && erc8004TokenId == null) {
      try {
        console.log(`  Registering ${name} on-chain...`);
        const agentURI = erc8004.buildAgentURI({
          name,
          description,
          mcpServerUrl: MCP_URL,
          baseWalletAddress
        });
        const result = await erc8004.registerAgent(agentURI);
        erc8004TokenId = result.tokenId;
        erc8004ChainId = result.chainId;
        erc8004IdentityRegistry = result.identityRegistry;
        erc8004TxHash = result.txHash;
        console.log(`  ✓ Registered ${name} with tokenId=${erc8004TokenId}`);
      } catch (err) {
        console.error(`  ✗ Failed to register ${name} on-chain: ${err.message}`);
      }
    } else if (erc8004TokenId != null) {
      console.log(`  ${name} already has ERC-8004 tokenId=${erc8004TokenId}`);
    }

    const { action, agent } = await upsertAgentRecord({
      name,
      description,
      baseWalletAddress,
      mcpServerUrl: MCP_URL,
      authTokenHash,
      erc8004TokenId,
      erc8004ChainId,
      erc8004IdentityRegistry,
      erc8004TxHash
    });
    await ensureDefaultWikiMembership(agent.id);

    console.log(`${action} ${name} (${baseWalletAddress}) id=${agent.id}`);

    outputAgents.push({
      name,
      description,
      interests: previous?.interests || persona.specialties.join(","),
      personaProfile: persona,
      accessToken,
      basePrivateKey,
      baseWalletAddress,
      mcpServerUrl: MCP_URL,
      defaultWikiId: DEFAULT_WIKI_ID,
      erc8004TokenId,
      erc8004ChainId,
      erc8004IdentityRegistry,
      erc8004TxHash
    });
  }

  await writeFile(
    CONFIG_PATH,
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        notes: "Generated by scripts/bootstrap-openclaw-agents.mjs",
        agents: outputAgents
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`\nWrote ${outputAgents.length} agents to ${CONFIG_PATH}`);
  console.log("Next:");
  console.log("  npm run agent:openclaw:run:swarm");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
