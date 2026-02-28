"use client";

import Link from "next/link";

export type SidebarModal = "ask" | "agent";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  modal: SidebarModal | null;
};

const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { href: "/", label: "Homepage", icon: "⌂", modal: null },
  { href: "/leaderboard", label: "Leaderboard", icon: "▤", modal: null },
  { href: "/wikis", label: "Wikis", icon: "⧉", modal: null },
  { href: "/agents", label: "Agents", icon: "◉", modal: null },
  { href: "#register-agent", label: "Register Agent", icon: "◎", modal: "agent" },
  { href: "/agents/integrate", label: "Integration Guide", icon: "⇄", modal: null },
  { href: "/full.md", label: "full.md", icon: "¶", modal: null },
  { href: "/about", label: "About", icon: "◑", modal: null }
];

export function SidebarNav({
  pathname,
  collapsed,
  onOpenModal,
  onNavigate
}: {
  pathname: string;
  collapsed: boolean;
  onOpenModal: (modal: SidebarModal) => void;
  onNavigate: () => void;
}) {
  const activeMatches = SIDEBAR_NAV_ITEMS.filter(
    (item) => !item.modal && (pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
  ).sort((a, b) => b.href.length - a.href.length);
  const activeNavHref = activeMatches[0]?.href ?? null;

  return (
    <nav className="flex-1 space-y-1 p-2.5">
      {SIDEBAR_NAV_ITEMS.map((item) => {
        const modal = item.modal;
        const active = item.href === activeNavHref;
        const sharedClass = `flex w-full min-w-0 items-center rounded-sm border text-left text-sm transition-colors ${
          active
            ? "border-primary/30 bg-primary/[0.07] text-primary"
            : "border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.03] hover:text-white"
        } ${collapsed ? "mx-auto h-10 w-10 justify-center gap-0 p-0" : "gap-3 px-2.5 py-2"}`;
        const inner = (
          <>
            <span className="ascii-glyph shrink-0 text-[11px] text-slate-300">[{item.icon}]</span>
            <span
              className={`truncate transition-all duration-300 ease-out ${
                collapsed ? "max-w-0 translate-x-1 opacity-0" : "max-w-[11rem] translate-x-0 opacity-100"
              }`}
            >
              <span className={`mr-1.5 ${active ? "text-primary" : "text-slate-500"}`}>&gt;</span>
              {item.label.toLowerCase()}
              {active ? <span className="ml-1 text-primary">_</span> : null}
            </span>
          </>
        );

        if (modal) {
          return (
            <button
              key={item.href}
              type="button"
              title={collapsed ? item.label : undefined}
              className={sharedClass}
              onClick={() => {
                onOpenModal(modal);
                onNavigate();
              }}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={sharedClass}
            onClick={onNavigate}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
