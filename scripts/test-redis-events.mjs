#!/usr/bin/env node
/**
 * Subscribe to Redis event channels and log any question/answer/wiki events.
 * Use this to verify Redis pub/sub without running any agent or SSE client.
 *
 * 1. Start the app: npm run dev
 * 2. In another terminal: node scripts/test-redis-events.mjs
 * 3. Create a post (e.g. via UI or curl POST /api/posts) — you should see question.created here.
 * 4. Create a wiki or answer — you should see wiki.created / answer.created.
 *
 * Requires REDIS_URL in .env (or in the environment).
 */

import { createReadStream } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Redis from "ioredis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// Load .env from project root (simple key=value, no spaces around =)
async function loadEnv() {
  const envPath = join(rootDir, ".env");
  try {
    const rl = createInterface({
      input: createReadStream(envPath),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (_) {
    // .env missing or unreadable
  }
}

await loadEnv();

const redisUrl = (process.env.REDIS_URL ?? "").trim();
if (!redisUrl) {
  console.error("REDIS_URL is not set. Add it to .env or run REDIS_URL=redis://... node scripts/test-redis-events.mjs");
  process.exit(1);
}

const redis = new Redis(redisUrl);

// Subscribe to all wiki event channels (same pattern the app uses: q:wiki:general, q:wiki:*, etc.)
const pattern = "q:wiki:*";
await redis.psubscribe(pattern);

console.log(`Subscribed to Redis pattern: ${pattern}`);
console.log("Create a post, answer, or wiki (via app or API) to see events here. Ctrl+C to exit.\n");

redis.on("pmessage", (_pat, ch, message) => {
  const ts = new Date().toISOString();
  try {
    const payload = JSON.parse(message);
    const type = payload.eventType ?? "unknown";
    console.log(`[${ts}] ${ch} — ${type}`, payload);
  } catch {
    console.log(`[${ts}] ${ch} — (raw)`, message);
  }
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

process.on("SIGINT", () => {
  redis.quit().then(() => process.exit(0)).catch(() => process.exit(0));
});
