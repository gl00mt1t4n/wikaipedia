import { Prisma } from "@prisma/client";
import { prisma } from "@/database/prisma";
import { createWiki, type Wiki, type WikiDiscoveryCandidate } from "@/types";
import { scoreWikiQuery } from "@/backend/wikis/wikiSearch";

export const DEFAULT_WIKI_ID = "general";
export const DEFAULT_WIKI_TAG = `w/${DEFAULT_WIKI_ID}`;
export const DEFAULT_WIKI_DISPLAY_NAME = "General";
const WIKI_ID_REGEX = /^[a-z0-9][a-z0-9-_]{1,30}[a-z0-9]$/;
const DEFAULT_WIKI_ENSURE_TTL_MS = 60_000;

let cachedDefaultWiki: { wiki: Wiki; expiresAtMs: number } | null = null;
let defaultWikiEnsureInFlight: Promise<Wiki> | null = null;

export function normalizeWikiIdInput(input: string): string {
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

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function pickLatestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function cacheDefaultWiki(wiki: Wiki): Wiki {
  cachedDefaultWiki = {
    wiki,
    expiresAtMs: Date.now() + DEFAULT_WIKI_ENSURE_TTL_MS
  };
  return wiki;
}

export async function ensureDefaultWiki(): Promise<Wiki> {
  const now = Date.now();
  if (cachedDefaultWiki && cachedDefaultWiki.expiresAtMs > now) {
    return cachedDefaultWiki.wiki;
  }

  if (defaultWikiEnsureInFlight) {
    return defaultWikiEnsureInFlight;
  }

  defaultWikiEnsureInFlight = prisma.wiki
    .upsert({
      where: { id: DEFAULT_WIKI_ID },
      update: {},
      create: {
        id: DEFAULT_WIKI_ID,
        displayName: DEFAULT_WIKI_DISPLAY_NAME,
        description: "General wiki for broad questions.",
        createdBy: "system"
      }
    })
    .then((row) => cacheDefaultWiki(toWiki(row)))
    .finally(() => {
      defaultWikiEnsureInFlight = null;
    });

  return defaultWikiEnsureInFlight;
}

export async function listWikis(): Promise<Wiki[]> {
  await ensureDefaultWiki();
  const rows = await prisma.wiki.findMany({
    orderBy: [{ id: "asc" }]
  });
  return rows.map(toWiki);
}

export async function findWikiById(wikiId: string): Promise<Wiki | null> {
  const normalized = normalizeWikiIdInput(wikiId);
  if (!normalized) {
    return null;
  }

  const row = await prisma.wiki.findUnique({
    where: { id: normalized }
  });
  return row ? toWiki(row) : null;
}

export async function getLatestWikiAnchor(): Promise<{ id: string; createdAt: string } | null> {
  const row = await prisma.wiki.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true }
  });
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString()
  };
}

export async function listWikisAfterAnchor(
  anchor: { id: string; createdAt: string } | null,
  limit = 200
): Promise<Wiki[]> {
  const anchorDate = anchor ? new Date(anchor.createdAt) : null;
  const anchorId = anchor?.id ?? "";

  const rows = await prisma.wiki.findMany({
    where: anchorDate
      ? {
          OR: [{ createdAt: { gt: anchorDate } }, { createdAt: anchorDate, id: { gt: anchorId } }]
        }
      : undefined,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit
  });

  return rows.map(toWiki);
}

function scoreWikiInterests(interests: string[], wiki: Pick<Wiki, "id" | "displayName" | "description">): number {
  if (interests.length === 0) {
    return 0;
  }

  const text = `${wiki.id} ${wiki.displayName} ${wiki.description}`.toLowerCase();
  let score = 0;

  for (const interest of interests) {
    const token = interest.trim().toLowerCase();
    if (!token) {
      continue;
    }
    if (text.includes(token)) {
      score += 15;
    }
  }

  return Math.min(score, 60);
}

function scoreWikiActivity(input: {
  recentPostCount: number;
  lastPostAt: string | null;
  memberCount: number;
}): number {
  let score = Math.min(input.recentPostCount * 4, 30);
  score += Math.min(input.memberCount, 20);

  if (input.lastPostAt) {
    const ageMs = Date.now() - new Date(input.lastPostAt).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    if (ageMs <= oneDay) {
      score += 20;
    } else if (ageMs <= sevenDays) {
      score += 10;
    }
  }

  return Math.min(score, 40);
}

export async function suggestWikis(query: string, limit = 8): Promise<Wiki[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const all = await listWikis();
  return all
    .map((wiki) => ({ wiki, score: scoreWikiQuery(q, wiki) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.wiki.id.localeCompare(b.wiki.id))
    .slice(0, limit)
    .map((entry) => entry.wiki);
}

export async function searchWikis(query: string, limit = 20): Promise<Wiki[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const all = await listWikis();
  return all
    .map((wiki) => ({ wiki, score: scoreWikiQuery(q, wiki) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.wiki.id.localeCompare(b.wiki.id))
    .slice(0, limit)
    .map((entry) => entry.wiki);
}

export async function listFeaturedWikis(limit = 3): Promise<Wiki[]> {
  await ensureDefaultWiki();
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [wikis, memberCounts, recentPostCounts, latestPostGroups] = await Promise.all([
    prisma.wiki.findMany({
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.agentWikiMembership.groupBy({
      by: ["wikiId"],
      _count: { wikiId: true }
    }),
    prisma.post.groupBy({
      by: ["wikiId"],
      where: {
        wikiId: { not: null },
        createdAt: { gte: weekAgo }
      },
      _count: { wikiId: true }
    }),
    prisma.post.groupBy({
      by: ["wikiId"],
      where: {
        wikiId: { not: null }
      },
      _max: {
        createdAt: true
      }
    })
  ]);

  const membersByWikiId = new Map(memberCounts.map((entry) => [entry.wikiId, entry._count.wikiId]));
  const recentPostsByWikiId = new Map(recentPostCounts.map((entry) => [entry.wikiId ?? "", entry._count.wikiId]));
  const latestPostAtByWikiId = new Map(
    latestPostGroups.map((entry) => [entry.wikiId ?? "", entry._max.createdAt?.toISOString() ?? null])
  );

  const ranked = wikis
    .filter((wiki) => wiki.id !== DEFAULT_WIKI_ID)
    .map((wiki) => {
      const memberCount = Number(membersByWikiId.get(wiki.id) ?? 0);
      const recentPostCount = Number(recentPostsByWikiId.get(wiki.id) ?? 0);
      const lastPostAt = latestPostAtByWikiId.get(wiki.id) ?? null;
      const activityScore = scoreWikiActivity({
        recentPostCount,
        lastPostAt,
        memberCount
      });

      return {
        wiki: toWiki(wiki),
        score: activityScore
      };
    })
    .sort((a, b) => b.score - a.score || b.wiki.createdAt.localeCompare(a.wiki.createdAt));

  const featured = ranked.slice(0, safeLimit).map((entry) => entry.wiki);
  if (featured.length >= safeLimit) {
    return featured;
  }

  const general = wikis.find((wiki) => wiki.id === DEFAULT_WIKI_ID);
  if (general) {
    featured.push(toWiki(general));
  }

  return featured.slice(0, safeLimit);
}

export async function listWikiDiscoveryCandidates(input: {
  joinedWikiIds: string[];
  interests?: string[];
  query?: string;
  limit?: number;
}): Promise<WikiDiscoveryCandidate[]> {
  const joined = new Set(input.joinedWikiIds.map((wikiId) => normalizeWikiIdInput(wikiId)).filter(Boolean));
  const interests = (input.interests ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const query = input.query?.trim() ?? "";
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(100, Number(input.limit))) : 20;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const allWikis = await listWikis();
  const candidates = allWikis.filter((wiki) => !joined.has(wiki.id));

  if (candidates.length === 0) {
    return [];
  }

  const candidateWikiIds = candidates.map((wiki) => wiki.id);
  const includeDefaultWiki = candidateWikiIds.includes(DEFAULT_WIKI_ID);

  const postMetricWikiIds = includeDefaultWiki
    ? candidateWikiIds
    : candidateWikiIds.filter((wikiId) => wikiId !== DEFAULT_WIKI_ID);
  const postMetricWhere = postMetricWikiIds.length
    ? {
        wikiId: {
          in: postMetricWikiIds
        }
      }
    : undefined;

  const [memberCounts, recentPostCounts, latestPostGroups, nullWikiRecentPosts, nullWikiLatestPost] =
    await Promise.all([
      prisma.agentWikiMembership.groupBy({
        by: ["wikiId"],
        where: {
          wikiId: {
            in: candidateWikiIds
          }
        },
        _count: { wikiId: true }
      }),
      postMetricWhere
        ? prisma.post.groupBy({
            by: ["wikiId"],
            where: {
              ...postMetricWhere,
              createdAt: { gte: weekAgo }
            },
            _count: { wikiId: true }
          })
        : Promise.resolve([]),
      postMetricWhere
        ? prisma.post.groupBy({
            by: ["wikiId"],
            where: postMetricWhere,
            _max: { createdAt: true }
          })
        : Promise.resolve([]),
      includeDefaultWiki
        ? prisma.post.count({
            where: {
              wikiId: null,
              createdAt: { gte: weekAgo }
            }
          })
        : Promise.resolve(0),
      includeDefaultWiki
        ? prisma.post.aggregate({
            where: { wikiId: null },
            _max: { createdAt: true }
          })
        : Promise.resolve({ _max: { createdAt: null as Date | null } })
    ]);

  const membersByWikiId = new Map(memberCounts.map((entry) => [entry.wikiId, entry._count.wikiId]));
  const recentPostsByWikiId = new Map(recentPostCounts.map((entry) => [entry.wikiId ?? "", entry._count.wikiId]));
  const latestPostAtByWikiId = new Map(
    latestPostGroups.map((entry) => [entry.wikiId ?? "", toIsoOrNull(entry._max.createdAt)])
  );
  const nullWikiLatestPostAt = toIsoOrNull(nullWikiLatestPost._max.createdAt);

  const ranked = candidates.map((wiki) => {
    const memberCount = Number(membersByWikiId.get(wiki.id) ?? 0);
    const recentPostCountBase = Number(recentPostsByWikiId.get(wiki.id) ?? 0);
    const lastPostAtBase = latestPostAtByWikiId.get(wiki.id) ?? null;

    const recentPostCount =
      wiki.id === DEFAULT_WIKI_ID ? recentPostCountBase + Number(nullWikiRecentPosts) : recentPostCountBase;
    const lastPostAt =
      wiki.id === DEFAULT_WIKI_ID ? pickLatestIso(lastPostAtBase, nullWikiLatestPostAt) : lastPostAtBase;

    const relevanceScore = Math.min(
      60,
      scoreWikiInterests(interests, wiki) + (query ? Math.min(30, scoreWikiQuery(query, wiki)) : 0)
    );
    const activityScore = scoreWikiActivity({
      recentPostCount,
      lastPostAt,
      memberCount
    });
    const score = Math.min(100, relevanceScore + activityScore);

    return {
      wiki,
      memberCount,
      recentPostCount,
      lastPostAt,
      relevanceScore,
      activityScore,
      score
    };
  });

  return ranked.sort((a, b) => b.score - a.score || a.wiki.id.localeCompare(b.wiki.id)).slice(0, limit);
}

export async function createWikiRecord(input: {
  rawName: string;
  createdBy: string;
  description?: string;
}): Promise<{ ok: true; wiki: Wiki } | { ok: false; error: string }> {
  const normalizedId = normalizeWikiIdInput(input.rawName);
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
    description: input.description ?? "",
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
      return { ok: false, error: "Wiki already exists." };
    }
    throw error;
  }
}

export async function resolveWikiForPost(input: {
  wikiQuery: string;
}): Promise<{ ok: true; wiki: Wiki } | { ok: false; error: string }> {
  const query = input.wikiQuery.trim();
  if (!query) {
    const wiki = await ensureDefaultWiki();
    return { ok: true, wiki };
  }

  const normalized = normalizeWikiIdInput(query);
  const exactById = normalized ? await findWikiById(normalized) : null;
  if (exactById) {
    return { ok: true, wiki: exactById };
  }

  const all = await listWikis();
  const exactByDisplay = all.find(
    (wiki) => wiki.displayName.trim().toLowerCase() === query.trim().toLowerCase()
  );
  if (exactByDisplay) {
    return { ok: true, wiki: exactByDisplay };
  }

  return {
    ok: false,
    error: "Wiki not found. Create it first from Create Wiki."
  };
}
