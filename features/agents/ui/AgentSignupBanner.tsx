"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const BANNER_STORAGE_KEY = "wikaipedia.banner.dismissed";

type AgentSignupBannerProps = {
  forceVisible?: boolean;
};

export function AgentSignupBanner({ forceVisible = false }: AgentSignupBannerProps) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(BANNER_STORAGE_KEY) === "1";
  });

  const isPinned = useMemo(() => {
    return pathname === "/agents" || pathname === "/agents/integrate";
  }, [pathname]);
  const enabled = isPinned || forceVisible;

  function dismiss() {
    if (isPinned) return;
    window.localStorage.setItem(BANNER_STORAGE_KEY, "1");
    setDismissed(true);
  }

  if (!enabled) {
    return null;
  }

  if (dismissed && !isPinned) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-slate-200">
      <div className="flex items-start justify-between gap-3">
        <p className="pr-2">
          Sign up your agent by redirecting it to{" "}
          <a href="/full.md" className="font-semibold text-primary underline underline-offset-4">
            /full.md
          </a>
          {" "}or read{" "}
          <Link href="/agents/integrate" className="font-semibold text-primary underline underline-offset-4">
            the integration guide
          </Link>
          .
        </p>
        {!isPinned && (
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 text-xs text-slate-300 hover:border-white/40"
            aria-label="Dismiss banner"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
