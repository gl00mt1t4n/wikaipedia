"use client";

import { getIdentityToken, useIdentityToken, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type VerifyResponse = {
  ok?: boolean;
  hasUsername?: boolean;
  username?: string | null;
  walletAddress?: string | null;
  error?: string;
};

// Poll until identity token becomes available.
async function waitForIdentityToken(initialToken: string | null, attempts = 12, delayMs = 250): Promise<string | null> {
  if (initialToken) return initialToken;
  for (let i = 0; i < attempts; i += 1) {
    const token = await getIdentityToken().catch(() => null);
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

// Poll until access token becomes available.
async function waitForAccessToken(
  getAccessToken: () => Promise<string | null>,
  attempts = 12,
  delayMs = 250
): Promise<string | null> {
  for (let i = 0; i < attempts; i += 1) {
    const token = await getAccessToken().catch(() => null);
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

// Wallet connect helper.
export function WalletConnect({
  initiallyLoggedIn = false,
  initialUsername = null
}: {
  initiallyLoggedIn?: boolean;
  initialUsername?: string | null;
}) {
  const router = useRouter();
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const [syncing, setSyncing] = useState(false);

  const [loggedIn, setLoggedIn] = useState(initiallyLoggedIn);
  const [username, setUsername] = useState(initialUsername);
  const [syncedPrivyUserId, setSyncedPrivyUserId] = useState<string | null>(null);

  const privyConnected = ready && authenticated && Boolean(user);

  useEffect(() => {
    let cancelled = false;

    // Sync backend session helper.
    async function syncBackendSession() {
      if (!ready || !authenticated || !user) return;
      if (syncedPrivyUserId === user.id) return;

      setSyncing(true);

      try {
        const idToken = await waitForIdentityToken(identityToken);
        const accessToken = idToken ? null : await waitForAccessToken(getAccessToken);

        if (!idToken && !accessToken) {
          throw new Error("Privy session token was not available yet. Please retry once.");
        }

        const verifyResponse = await fetch("/api/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken ?? accessToken ?? ""}`,
            "X-Privy-Token-Type": idToken ? "id" : "access"
          },
          body: JSON.stringify({ idToken, accessToken })
        });
        const verifyData = (await verifyResponse.json().catch(() => ({}))) as VerifyResponse;

        if (!verifyResponse.ok || !verifyData.ok) {
          throw new Error(verifyData.error ?? "Could not verify auth session.");
        }

        if (cancelled) return;

        setLoggedIn(true);
        setUsername(verifyData.username ?? null);
        setSyncedPrivyUserId(user.id);

        if (!verifyData.hasUsername) {
          router.push("/associate-username");
        }
        router.refresh();
      } catch (error) {
        if (cancelled) return;
        console.error("Sign-in failed:", error);
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }
    }

    void syncBackendSession();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken, identityToken, ready, router, syncedPrivyUserId, user]);

  // Handle sign in events.
  function onSignIn() {
    if (authenticated && user) return;
    login();
  }

  // Handle logout events.
  async function onLogout() {
    try {
      await logout().catch(() => undefined);
      await fetch("/api/auth/logout", { method: "POST" });
      setLoggedIn(false);
      setUsername(null);
      setSyncedPrivyUserId(null);
      router.refresh();
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  }

  if (!ready) {
    return (
      <button className="flex group relative items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 px-4 py-1.5 opacity-50 cursor-not-allowed md:px-5">
        <span className="relative flex items-center gap-2 text-xs font-semibold tracking-wide text-white uppercase">
          Loading...
        </span>
      </button>
    );
  }

  if (loggedIn || privyConnected) {
    return (
      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-white leading-none">
            {username ? `@${username}` : "Signed in"}
          </span>
          {syncing ? (
            <span className="text-[10px] text-primary mt-1 leading-none uppercase tracking-widest">Syncing...</span>
          ) : (
            <button onClick={onLogout} className="text-[10px] text-slate-500 hover:text-red-500 mt-1 leading-none uppercase tracking-widest transition-colors">Logout</button>
          )}
        </div>

        <div
          className="size-9 rounded-full bg-cover bg-center ring-2 ring-white/10 shrink-0"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuChVjSWY_7bJSCcH911Ms1JFMAXmlM1jNDc19CLlPM5sbjclauqSpoagIubeKSeAD6Qyqa4JOpOTsMeps3XK5PZyK_3cE1DA9LPjIbn_Wv-yovsFUYgIXUCKltH01FTeyzJNbiz5m1AlypwqcKDEZlMXi7Rv9SpmXrp2oO7p5nT-JkK3xB2YhLsnHT7hK0vKwaZ1galPfKzMV_VRDbfeugJcdl6afZY43ABxSdM8Yyj9VGfOjFQ68-TLWRzXDhWKk6J9WmPsH1qMqU')"
          }}
        ></div>
      </div>
    );
  }

  return (
    <button onClick={onSignIn} className="flex group relative items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 px-4 py-1.5 transition-all hover:border-primary/50 hover:bg-primary/10 md:px-5">
      <span className="relative flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-900 dark:text-white uppercase shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
        Sign In
      </span>
    </button>
  );
}
