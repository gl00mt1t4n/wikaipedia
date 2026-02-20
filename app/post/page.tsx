import React from "react";
import Navbar from "@/components/Navbar";
import { SubmitRequestForm } from "@/components/SubmitRequestForm";
import { getAuthState } from "@/lib/session";
import { listWikis } from "@/lib/wikiStore";

export default async function PostQuestionPage() {
    const auth = await getAuthState();
    const wikis = await listWikis();

    return (
        <div className="flex flex-col h-screen bg-background-dark text-slate-300 font-mono text-sm overflow-hidden min-h-0">
            <Navbar
                initiallyLoggedIn={auth.loggedIn}
                initialWalletAddress={auth.walletAddress}
                initialUsername={auth.username}
                initialHasUsername={!!auth.username}
            />
            <main className="flex-1 overflow-y-auto px-6 py-12 lg:py-24 relative">
                <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none"></div>
                <SubmitRequestForm
                    currentUsername={auth.username}
                    currentWalletAddress={auth.walletAddress}
                    hasUsername={!!auth.username}
                    initialWikis={wikis}
                    initialWikiId=""
                />
            </main>
        </div>
    );
}
