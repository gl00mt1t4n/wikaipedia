import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createWiki, type Wiki } from "@/lib/types";

export const DEFAULT_WIKI_ID = "general";
export const DEFAULT_WIKI_TAG = `w/${DEFAULT_WIKI_ID}`;
export const DEFAULT_WIKI_DISPLAY_NAME = "General";

const WIKI_ID_REGEX = /^[a-z0-9][a-z0-9-_]{1,30}[a-z0-9]$/;

function normalizeWikiId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^w\//, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function toWiki(record: {
  id: string;
  displayName: string;
  description: string;
  createdBy: string;
  createdAt: Date;
}): Wiki {
  return {
    id: record.id,
    displayName: record.displayName,
    description: record.description,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString()
  };
}

function scoreWikiQuery(query: string, wiki: Pick<Wiki, "id" | "displayName">): number {
  const q = query.trim().toLowerCase().replace(/^w\//, "");
  if (!q) {
    return 0;
  }

  const id = wiki.id.toLowerCase();
  const display = wiki.displayName.toLowerCase();

  if (id === q) return 100;
  if (display === q) return 95;
  if (id.startsWith(q)) return 85;
  if (display.startsWith(q)) return 80;
  if (id.includes(q)) return 70;
  if (display.includes(q)) return 65;

  const qTokens = q.split(/[-_\s]+/).filter(Boolean);
  if (qTokens.length > 0) {
    const joined = `${id} ${display}`;
    let tokenHits = 0;
    for (const token of qTokens) {
      if (joined.includes(token)) {
        tokenHits += 1;
      }
    }
    if (tokenHits > 0) {
      return 40 + tokenHits * 5;
    }
  }

  return 0;
}

export async function ensureDefaultWiki(): Promise<Wiki> {
  const row = await prisma.wiki.upsert({
    where: { id: DEFAULT_WIKI_ID },
    update: {},
    create: {
      id: DEFAULT_WIKI_ID,
      displayName: DEFAULT_WIKI_DISPLAY_NAME,
      description: "General wiki for broad questions.",
      createdBy: "system"
    }
  });
  return toWiki(row);
}

export async function listWikis(): Promise<Wiki[]> {
  await ensureDefaultWiki();
  const rows = await prisma.wiki.findMany({
    orderBy: [{ id: "asc" }]
  });
  return rows.map(toWiki);
}

export async function findWikiById(wikiId: string): Promise<Wiki | null> {
  const normalized = normalizeWikiId(wikiId);
  if (!normalized) {
    return null;
  }

  const row = await prisma.wiki.findUnique({
    where: { id: normalized }
  });
  return row ? toWiki(row) : null;
}

export async function createWikiRecord(input: {
  rawName: string;
  createdBy: string;
}): Promise<{ ok: true; wiki: Wiki } | { ok: false; error: string }> {
  const normalizedId = normalizeWikiId(input.rawName);
  if (!WIKI_ID_REGEX.test(normalizedId)) {
    return {
      ok: false,
      error: "Wiki name must be 3-32 chars and only use lowercase letters, numbers, hyphen, underscore."
    };
  }

  const displayName = input.rawName.trim().replace(/^w\//i, "") || normalizedId;
  const wiki = createWiki({
    id: normalizedId,
    displayName,
    description: "",
    createdBy: input.createdBy
  });

  try {
    const created = await prisma.wiki.create({
      data: {
        id: wiki.id,
        displayName: wiki.displayName,
        description: wiki.description,
        createdBy: wiki.createdBy,
        createdAt: new Date(wiki.createdAt)
      }
    });
    return { ok: true, wiki: toWiki(created) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await findWikiById(normalizedId);
      if (existing) {
        return { ok: true, wiki: existing };
      }
      return { ok: false, error: "Wiki already exists." };
    }
    throw error;
  }
}

export async function resolveWikiForPost(input: {
  wikiQuery: string;
  createdBy: string;
}): Promise<{ ok: true; wiki: Wiki } | { ok: false; error: string }> {
  const query = input.wikiQuery.trim();
  if (!query) {
    const wiki = await ensureDefaultWiki();
    return { ok: true, wiki };
  }

  const normalized = normalizeWikiId(query);
  const exact = normalized ? await findWikiById(normalized) : null;
  if (exact) {
    return { ok: true, wiki: exact };
  }

  const all = await listWikis();
  const ranked = all
    .map((wiki) => ({ wiki, score: scoreWikiQuery(query, wiki) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked[0] && ranked[0].score >= 85) {
    return { ok: true, wiki: ranked[0].wiki };
  }

  const created = await createWikiRecord({
    rawName: query,
    createdBy: input.createdBy
  });
  if (!created.ok) {
    return { ok: false, error: created.error };
  }
  return { ok: true, wiki: created.wiki };
}

