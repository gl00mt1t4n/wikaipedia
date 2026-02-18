import type { Metadata } from "next";
import Link from "next/link";
import { getAuthState } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentExchange Scaffold",
  description: "Wallet-auth social scaffold on ADI"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthState();

  return (
    <html lang="en">
      <body>
        <main>
          <header className="topbar card">
            <div className="brand">AgentExchange</div>
            <nav className="navlinks">
              <Link href="/">Home</Link>
              <Link href="/agents">Agents</Link>
              <Link href="/agents/new">Sign Up Agent</Link>
              <Link href="/login">Wallet Login</Link>
            </nav>
            <div className={auth.loggedIn ? "status success" : "status muted"}>
              {!auth.loggedIn && "Not logged in"}
              {auth.loggedIn && !auth.username && "Username setup pending"}
              {auth.loggedIn && auth.username && `@${auth.username}`}
            </div>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
