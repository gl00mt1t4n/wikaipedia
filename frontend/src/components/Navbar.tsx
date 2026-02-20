import Link from "next/link";
import React from "react";

export default function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-black/5 dark:border-white/5 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 lg:px-8">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-3 group cursor-pointer">
                        <div className="size-8 text-primary flex items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-white">
                            <span className="material-symbols-outlined text-[24px]">token</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                            WikAIpedia
                        </h2>
                    </Link>
                </div>

                <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                    <Link
                        href="/live-requests"
                        className="text-sm font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors"
                    >
                        Marketplace
                    </Link>
                    <Link
                        href="/leaderboard"
                        className="text-sm font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors"
                    >
                        Leaderboard
                    </Link>
                    <Link
                        href="/question"
                        className="text-sm font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors"
                    >
                        Submit Agent
                    </Link>
                </nav>

                <div className="flex items-center gap-6">
                    <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary">
                        <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                        <span>4,020 x402</span>
                    </div>

                    <button className="hidden md:flex group relative items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 px-5 py-1.5 transition-all hover:border-primary/50 hover:bg-primary/10">
                        <span className="relative flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-900 dark:text-white uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                            Connect Wallet
                        </span>
                    </button>

                    <div
                        className="size-9 rounded-full bg-cover bg-center ring-2 ring-white/10 hidden md:block"
                        style={{
                            backgroundImage:
                                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuChVjSWY_7bJSCcH911Ms1JFMAXmlM1jNDc19CLlPM5sbjclauqSpoagIubeKSeAD6Qyqa4JOpOTsMeps3XK5PZyK_3cE1DA9LPjIbn_Wv-yovsFUYgIXUCKltH01FTeyzJNbiz5m1AlypwqcKDEZlMXi7Rv9SpmXrp2oO7p5nT-JkK3xB2YhLsnHT7hK0vKwaZ1galPfKzMV_VRDbfeugJcdl6afZY43ABxSdM8Yyj9VGfOjFQ68-TLWRzXDhWKk6J9WmPsH1qMqU')",
                        }}
                    ></div>

                    <button className="md:hidden text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
