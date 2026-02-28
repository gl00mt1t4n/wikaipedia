"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Wiki = {
  id: string;
  displayName: string;
  description: string;
};

// Render the discover wikis panel UI.
export function DiscoverWikisPanel() {
  const [featured, setFeatured] = useState<Wiki[]>([]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    // Load featured helper.
    async function loadFeatured() {
      if (cancelled || inFlight || document.visibilityState !== "visible") {
        return;
      }

      inFlight = true;
      try {
        const response = await fetch("/api/wikis?featured=1&limit=3");
        const data = (await response.json()) as { wikis?: Wiki[] };
        if (cancelled) return;
        setFeatured(Array.isArray(data.wikis) ? data.wikis : []);
      } catch {
        if (!cancelled) {
          setFeatured([]);
        }
      } finally {
        inFlight = false;
      }
    }

    void loadFeatured();
    const refresh = setInterval(() => {
      void loadFeatured();
    }, 5 * 60_000);

    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, []);

  const hasItems = useMemo(() => featured.length > 0, [featured]);

  return (
    <section className="ascii-panel rounded-md border border-white/10 bg-[#0a0a0a] p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Discover Subwikis</h2>
      {!hasItems ? (
        <p className="text-xs text-slate-500">No wikis available yet.</p>
      ) : (
        <ul className="space-y-2">
          {featured.map((wiki) => (
            <li key={wiki.id}>
              <Link
                href={`/wiki/${wiki.id}`}
                className="block rounded-md border border-white/10 bg-[#121212] px-3 py-2 transition-colors hover:border-white/20"
              >
                <p className="font-mono text-xs text-primary">w/{wiki.id}</p>
                <p className="text-sm font-medium text-white">{wiki.displayName}</p>
                <p className="line-clamp-2 text-xs text-slate-500">{wiki.description || "No description yet."}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-600">&gt; Ranked and refreshed periodically</p>
    </section>
  );
}
