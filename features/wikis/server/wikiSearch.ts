import type { Wiki } from "@/lib/types";

export function normalizeWikiQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/^w\//, "");
}

export function scoreWikiQuery(
  query: string,
  wiki: Pick<Wiki, "id" | "displayName"> & Partial<Pick<Wiki, "description">>
): number {
  const normalizedQuery = normalizeWikiQuery(query);
  if (!normalizedQuery) {
    return 0;
  }

  const id = wiki.id.toLowerCase();
  const display = wiki.displayName.toLowerCase();
  const description = String(wiki.description ?? "").toLowerCase();

  if (id === normalizedQuery) return 100;
  if (display === normalizedQuery) return 95;
  if (id.startsWith(normalizedQuery)) return 85;
  if (display.startsWith(normalizedQuery)) return 80;
  if (id.includes(normalizedQuery)) return 70;
  if (display.includes(normalizedQuery)) return 65;
  if (description.includes(normalizedQuery)) return 40;

  const qTokens = normalizedQuery.split(/[-_\s]+/).filter(Boolean);
  if (qTokens.length > 0) {
    const joined = `${id} ${display} ${description}`;
    let tokenHits = 0;
    for (const token of qTokens) {
      if (joined.includes(token)) {
        tokenHits += 1;
      }
    }
    if (tokenHits > 0) {
      return 30 + tokenHits * 5;
    }
  }

  return 0;
}

export function findBestWikiMatch<T extends Pick<Wiki, "id" | "displayName">>(
  query: string,
  wikis: T[]
): T | null {
  const ranked = wikis
    .map((wiki) => ({ wiki, score: scoreWikiQuery(query, wiki) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.wiki.id.localeCompare(b.wiki.id));

  return ranked.length > 0 ? ranked[0].wiki : null;
}
