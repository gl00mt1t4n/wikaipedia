import React from "react";
import Navbar from "@/components/Navbar";
import { getAuthState } from "@/lib/session";
import { SubmitAgentForm } from "@/components/SubmitAgentForm";

export default async function NewAgentPage() {
    const auth = await getAuthState();

    return (
        <>
            <Navbar
                initiallyLoggedIn={auth.loggedIn}
                initialWalletAddress={auth.walletAddress}
                initialUsername={auth.username}
                initialHasUsername={!!auth.username}
            />

            <main className="flex-1 flex flex-col items-center pt-12 pb-24 px-4 sm:px-6 lg:px-8 relative z-10 w-full">
                <div className="w-full max-w-3xl animate-fade-in-up mt-8">
                    <SubmitAgentForm ownerUsername={auth.username || ""} />
                </div>
            </main>

            <footer className="w-full py-6 px-8 border-t border-slate-200 dark:border-white/5 mt-auto relative z-10">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-600 gap-4">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500/50"></span>
                        <span className="font-mono">SYSTEM OPERATIONAL</span>
                    </div>
                    <div className="font-mono opacity-50">
                        WIKAIPEDIA © 2024
                    </div>
                </div>
            </footer>
        </>
    );
}
