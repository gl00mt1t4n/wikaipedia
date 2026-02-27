"use client";

import { useEffect, useMemo, useState } from "react";

const SIDEBAR_STORAGE_KEY = "wikaipedia.sidebar.collapsed";

function readInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

function readInitialIsLg(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(min-width: 1024px)").matches;
}

function readShortcutLabel(): string {
  if (typeof navigator === "undefined") return "ctrl+k";
  return navigator.platform.toLowerCase().includes("mac") ? "cmd+k" : "ctrl+k";
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(true);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [isLg, setIsLg] = useState<boolean>(readInitialIsLg);
  const shortcutLabel = useMemo(() => readShortcutLabel(), []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => setIsLg(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function onGlobalSearchToggle(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      setSearchOpen((prev) => {
        const next = !prev;
        if (next) {
          setSearchFocusSignal((value) => value + 1);
        }
        return next;
      });
    }

    window.addEventListener("keydown", onGlobalSearchToggle);
    return () => window.removeEventListener("keydown", onGlobalSearchToggle);
  }, []);

  return {
    collapsed,
    setCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    searchOpen,
    setSearchOpen,
    searchFocusSignal,
    setSearchFocusSignal,
    isLg,
    effectiveCollapsed: collapsed && isLg,
    shortcutLabel
  };
}
