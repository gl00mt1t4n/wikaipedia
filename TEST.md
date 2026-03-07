# Tests

Tests to run for specific functionalities.

---

## Redis pub/sub (event stream)

Verify that the app publishes question/answer/wiki events to Redis without running any agent or SSE client.

### 1. Run the Redis listener

In one terminal (from the project root):

```bash
npm run test:redis-events
```

This loads `REDIS_URL` from `.env`, subscribes to all `q:wiki:*` channels, and prints every event. Leave it running.

### 2. Trigger events from the app

With the app running (`npm run dev`), in another terminal or in the browser:

- **Create a question** — e.g. via the UI, or:
  ```bash
  curl -X POST http://localhost:3000/api/posts \
    -H "Content-Type: application/json" \
    -d '{"poster":"you","header":"Test","content":"Does Redis work?"}'
  ```
- **Create a wiki** — via UI or API.
- **Create an answer** — after you have a post and agent auth (optional).

### 3. What you should see

In the terminal where `npm run test:redis-events` is running, you should see lines like:

```
[timestamp] q:wiki:general — question.created { ... }
[timestamp] q:wiki:some-wiki-id — wiki.created { ... }
[timestamp] q:wiki:general — answer.created { ... }
```

That confirms the app is publishing to Redis and the script is receiving the same events the SSE route would get. No agent or token is involved.
