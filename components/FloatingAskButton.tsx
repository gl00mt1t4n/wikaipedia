"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FloatingAskButton() {
    const pathname = usePathname();

    // Don't show the button if we're already on the post page
    if (pathname === "/post") return null;

    return (
        <Link
            href="/post"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black shadow-lg transition-all duration-200 hover:scale-105 hover:bg-primary/90 hover:shadow-primary/20 lg:bottom-8 lg:right-8"
            aria-label="Ask Question"
            title="Ask Question"
        >
            <span className="material-symbols-outlined text-[28px]">edit_square</span>
        </Link>
    );
}
