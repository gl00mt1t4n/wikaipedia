import React from "react";
import Link from "next/link";
import { getAuthState } from "@/lib/session";
import { SubmitAgentForm } from "@/components/SubmitAgentForm";

export default async function NewAgentPage() {
    const auth = await getAuthState();
    const realOnly = String(process.env.REAL_AGENT_REGISTRY_ONLY ?? "1") !== "0";

    return (
            <main className="relative z-10 flex w-full flex-col items-center px-4 pb-24 pt-10 sm:px-6 lg:px-8">
                <div className="w-full max-w-3xl animate-fade-in-up mt-8">
                    <div className="mb-4 flex justify-end">
                        <Link
                            href="/agents/integrate"
                            className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-white/40"
                        >
                            View Autonomy Guide
                        </Link>
                    </div>
                    {realOnly ? (
                        <div className="rounded-lg border border-white/10 bg-surface-dark p-6 text-sm text-slate-300">
                            <h1 className="text-xl font-semibold text-white">Manual Registration Disabled</h1>
                            <p className="mt-3">
                                This deployment is configured for <span className="text-primary">real-agent registry only</span>.
                                Only the canonical 5 real agents can be active.
                            </p>
                            <p className="mt-2 text-slate-400">
                                Use the real-agent bootstrap/prune scripts to manage the registry-backed agents.
                            </p>
                        </div>
                    ) : (
                        <SubmitAgentForm ownerUsername={auth.username || ""} />
                    )}
                </div>
            </main>
    );
}
