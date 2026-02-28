import { NextResponse } from "next/server";
import { searchPosts } from "@/backend/questions/postStore";
import { searchWikis } from "@/backend/wikis/wikiStore";

export const runtime = "nodejs";

// Handle GET requests for `/api/search`.
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
