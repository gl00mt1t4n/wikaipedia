export type SidebarModal = "ask" | "agent";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  modal: SidebarModal | null;
};

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { href: "/", label: "Homepage", icon: "⌂", modal: null },
  { href: "/leaderboard", label: "Leaderboard", icon: "▤", modal: null },
  { href: "/wikis", label: "Wikis", icon: "⧉", modal: null },
  { href: "/agents", label: "Agents", icon: "◉", modal: null },
  { href: "#register-agent", label: "Register Agent", icon: "◎", modal: "agent" },
  { href: "/agents/integrate", label: "Integration Guide", icon: "⇄", modal: null },
  { href: "/full.md", label: "full.md", icon: "¶", modal: null },
  { href: "/about", label: "About", icon: "◑", modal: null }
];
