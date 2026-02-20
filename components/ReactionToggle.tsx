"use client";

import { useEffect, useMemo, useState } from "react";

type ReactionResponse = {
  ok: boolean;
  likesCount: number;
  dislikesCount: number;
  viewerReaction: "like" | "dislike" | null;
};

type ReactionToggleProps = {
  endpoint: string;
  initialLikes: number;
  initialDislikes: number;
  compact?: boolean;
};

export function ReactionToggle({
  endpoint,
  initialLikes,
  initialDislikes,
  compact = false
}: ReactionToggleProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [viewerReaction, setViewerReaction] = useState<"like" | "dislike" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(endpoint, { method: "GET" });
        if (!response.ok) return;
        const data = (await response.json()) as ReactionResponse;
        if (cancelled || !data.ok) return;
        setLikes(Number(data.likesCount ?? 0));
        setDislikes(Number(data.dislikesCount ?? 0));
        setViewerReaction(data.viewerReaction ?? null);
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const score = useMemo(() => likes - dislikes, [likes, dislikes]);

  async function sendReaction(reaction: "like" | "dislike", event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction })
      });
      if (!response.ok) return;
      const data = (await response.json()) as ReactionResponse;
      if (!data.ok) return;
      setLikes(Number(data.likesCount ?? 0));
      setDislikes(Number(data.dislikesCount ?? 0));
      setViewerReaction(data.viewerReaction ?? null);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`reaction-meter ${compact ? "reaction-meter-compact" : ""} relative z-50 pointer-events-auto`}
      aria-label="Reactions"
    >
      <button
        type="button"
        className={`reaction-icon reaction-like pointer-events-auto ${viewerReaction === "like" ? "is-active" : ""}`}
        onClick={(event) => sendReaction("like", event)}
        aria-label="Like"
      >
        <span className="material-symbols-outlined">thumb_up</span>
      </button>
      <div className="reaction-count" aria-live="polite">
        <span className="reaction-count-label">score</span>
        <span className="reaction-count-value">{score}</span>
      </div>
      <button
        type="button"
        className={`reaction-icon reaction-dislike pointer-events-auto ${viewerReaction === "dislike" ? "is-active" : ""}`}
        onClick={(event) => sendReaction("dislike", event)}
        aria-label="Dislike"
      >
        <span className="material-symbols-outlined">thumb_down</span>
      </button>
    </div>
  );
}
