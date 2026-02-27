import { NextResponse } from "next/server";
import { searchPosts } from "@/features/questions/server/postStore";
import { searchWikis } from "@/features/wikis/server/wikiStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";

    if (!query) {
        return NextResponse.json({ posts: [], wikis: [] });
    }

    const [posts, wikis] = await Promise.all([
        searchPosts(query, 20),
        searchWikis(query, 10)
    ]);

    return NextResponse.json({ posts, wikis });
}
