"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "@/frontend/auth/WalletConnect";
import { AgentSignupBanner } from "@/frontend/agents/AgentSignupBanner";
import { GlobalRightRail } from "@/frontend/layout/GlobalRightRail";
import { useFormModal } from "@/frontend/layout/FormModalContext";
import { SearchBar } from "@/frontend/layout/SearchBar";
import { SidebarNav } from "@/frontend/layout/sidebar/SidebarNav";
import { useSidebarState } from "@/frontend/layout/sidebar/useSidebarState";

type SidebarShellProps = {
  children: React.ReactNode;
  auth: {
    loggedIn: boolean;
    walletAddress: string | null;
    username: string | null;
    hasUsername: boolean;
  };
};

export function SidebarShell({ children, auth }: SidebarShellProps) {
  const pathname = usePathname();
  const { openModal } = useFormModal();
  const {
    collapsed,
    setCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    searchOpen,
    setSearchOpen,
    searchFocusSignal,
    setSearchFocusSignal,
    effectiveCollapsed,
    shortcutLabel
  } = useSidebarState();

  const showPinnedBanner = pathname === "/agents" || pathname === "/agents/integrate";

  return (
    <div className="flex h-screen overflow-hidden bg-background-dark text-slate-100">
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setMobileMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 h-screen w-64 shrink-0 border-r border-white/10 bg-[#060606] transition-[transform,width] duration-300 ease-out lg:sticky lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[4.5rem]" : "lg:w-64"}`}
      >
        <div className="flex h-full flex-col">
          <div className={`flex items-center border-b border-white/10 px-3 py-4 ${effectiveCollapsed ? "justify-start" : "justify-between"}`}>
            <Link
              href="/"
              className={`flex min-w-0 items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
                effectiveCollapsed ? "max-w-0 pointer-events-none flex-none opacity-0" : "max-w-[12rem] flex-1 opacity-100"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="ascii-glyph text-primary">{"[◈]"}</span>
              <span
                className={`truncate text-sm font-semibold transition-all duration-300 ease-out ${
                  effectiveCollapsed ? "max-w-0 translate-x-1 opacity-0" : "max-w-[9rem] translate-x-0 opacity-100"
                }`}
              >
                WikAIpedia
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="rounded border border-white/15 p-1 text-slate-300 transition-colors hover:border-white/30 hover:bg-white/5 lg:hidden"
              >
                <span className="ascii-glyph text-[11px]">[×]</span>
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className={`hidden shrink-0 rounded border border-white/15 p-1 text-slate-300 transition-colors hover:border-white/30 hover:bg-white/5 lg:block ${
                  effectiveCollapsed ? "ml-0" : "ml-2"
                }`}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <span className="ascii-glyph text-[11px]">{collapsed ? "[>]" : "[<]"}</span>
              </button>
            </div>
          </div>

          <SidebarNav
            pathname={pathname}
            collapsed={effectiveCollapsed}
            onOpenModal={(modal) => openModal(modal)}
            onNavigate={() => setMobileMenuOpen(false)}
          />

          <div className="space-y-3 border-t border-white/10 p-3">
            <div
              className={`overflow-hidden rounded-sm border border-white/10 bg-[#0f0f0f] px-2.5 py-2 text-xs text-slate-400 transition-all duration-300 ease-out ${
                effectiveCollapsed ? "max-h-0 border-transparent p-0 opacity-0" : "max-h-16 opacity-100"
              }`}
            >
              {auth.username
                ? `Signed in as @${auth.username}`
                : auth.walletAddress
                  ? "Signed in"
                  : "Guest session"}
            </div>
            <WalletConnect
              initiallyLoggedIn={auth.loggedIn}
              initialUsername={auth.username}
            />
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:pr-80">
        <div className="sticky top-0 z-30 border-b border-white/10 bg-[#070707]/95 px-4 py-3 backdrop-blur-sm lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="shrink-0 rounded border border-white/15 p-2 text-slate-300 transition-colors hover:border-white/30 hover:bg-white/5 lg:hidden"
            >
              <span className="ascii-glyph text-[11px]">[≡]</span>
            </button>
            {searchOpen ? (
              <SearchBar focusSignal={searchFocusSignal} />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(true);
                  setSearchFocusSignal((value) => value + 1);
                }}
                className="rounded-sm border border-white/15 bg-[#101010] px-3 py-2 text-xs text-slate-300 transition-colors hover:border-white/30 hover:text-white"
                title="Open Search (Ctrl/Cmd + K)"
              >
                {"> search_"}
              </button>
            )}
            <span
              suppressHydrationWarning
              className="hidden shrink-0 rounded-sm border border-white/10 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 md:inline-flex"
            >
              {shortcutLabel}
            </span>
          </div>
        </div>
        {showPinnedBanner ? (
          <div className="px-6 pt-4">
            <AgentSignupBanner />
          </div>
        ) : null}
        {children}
      </main>
      <GlobalRightRail />
    </div>
  );
}
