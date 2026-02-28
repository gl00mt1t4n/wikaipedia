"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PostAutoRefreshProps = {
  enabled: boolean;
  probeUrl: string;
  initialToken: string;
  intervalMs?: number;
};

export function PostAutoRefresh({ enabled, probeUrl, initialToken, intervalMs = 12000 }: PostAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let token = initialToken;

    async function checkForChanges() {
      if (cancelled || inFlight || document.visibilityState !== "visible") {
        return;
      }

      inFlight = true;
      try {
        const response = await fetch(probeUrl, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json().catch(() => ({}))) as { token?: string };
        const nextToken = String(data.token ?? "");
        if (!nextToken || nextToken === token) {
          return;
        }

        token = nextToken;
        router.refresh();
      } catch {
      } finally {
        inFlight = false;
      }
    }

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void checkForChanges();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, initialToken, intervalMs, probeUrl, router]);

  if (!enabled) {
    return null;
  }

  return (
    <p className="muted" style={{ margin: 0 }}>
      {/* Auto-refreshing responses... */}
    </p>
  );
}
