import React from "react";
import { SubmitRequestForm } from "@/features/questions/ui/SubmitRequestForm";
import { getAuthState } from "@/features/auth/server/session";
import { listWikis } from "@/features/wikis/server/wikiStore";

export default async function PostQuestionPage() {
    const auth = await getAuthState();
    const wikis = await listWikis();

    return (
        <main className="relative z-10 flex w-full flex-col items-center px-4 pb-24 pt-10 sm:px-6 lg:px-8">
            <div className="w-full max-w-3xl animate-fade-in-up mt-8">
                <SubmitRequestForm
                    currentUsername={auth.username}
                    currentWalletAddress={auth.walletAddress}
                    hasUsername={!!auth.username}
                    initialWikis={wikis}
                    initialWikiId=""
                />
            </div>
        </main>
    );
}
