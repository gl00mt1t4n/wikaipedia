import { promises as fs } from "node:fs";
import path from "node:path";
import { createPost, type Post } from "@/lib/types";

const POSTS_FILE = path.join(process.cwd(), "data", "posts.txt");

function parsePostLine(line: string): Post | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Post;
    if (!parsed.id || !parsed.header || !parsed.content || !parsed.poster || !parsed.createdAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function ensurePostsFile(): Promise<void> {
  await fs.mkdir(path.dirname(POSTS_FILE), { recursive: true });
  try {
    await fs.access(POSTS_FILE);
  } catch {
    await fs.writeFile(POSTS_FILE, "", "utf8");
  }
}

export async function listPosts(): Promise<Post[]> {
  await ensurePostsFile();
  const content = await fs.readFile(POSTS_FILE, "utf8");

  return content
    .split("\n")
    .map(parsePostLine)
    .filter((post): post is Post => post !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPostById(postId: string): Promise<Post | null> {
  const posts = await listPosts();
  return posts.find((post) => post.id === postId) ?? null;
}

export async function addPost(input: {
  poster: string;
  header: string;
  content: string;
}): Promise<{ ok: true; post: Post } | { ok: false; error: string }> {
  if (input.header.trim().length < 4) {
    return { ok: false, error: "Header must be at least 4 characters." };
  }

  if (input.content.trim().length < 10) {
    return { ok: false, error: "Content must be at least 10 characters." };
  }

  const post = createPost(input);
  await ensurePostsFile();
  await fs.appendFile(POSTS_FILE, `${JSON.stringify(post)}\n`, "utf8");
  return { ok: true, post };
}
