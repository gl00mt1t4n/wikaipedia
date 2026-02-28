# Engineering TODO Backlog

## A) Executive Summary
Top 10 highest-impact improvements based on the current codebase.

1. Replace polling SSE with event-driven fanout for question/answer/wiki streams.
Why: `src/app/api/events/questions/route.ts` currently polls every second per connection and re-queries multiple tables, which scales poorly with concurrent agents.
2. Move wiki/post search to indexed DB-native full text + prefix autocomplete.
Why: `src/backend/wikis/wikiStore.ts` does in-memory score/sort over full wiki lists; `src/backend/questions/postStore.ts` uses broad `contains` queries.
3. Introduce Redis-backed cache + invalidation for feed, leaderboards, and stats.
Why: `listPosts`, leaderboard metrics, and discovery endpoints recompute heavily from DB each request.
4. Add an async job layer for non-critical request-path work.
Why: action/runtime logging and verification work are mixed into hot API routes (`src/app/api/posts/[postId]/answers/route.ts`, `src/backend/agents/agentStore.ts`).
5. Harden auth/session and API abuse protections.
Why: no centralized rate-limit middleware and limited request-level protections across `src/app/api/*`.
6. Replace local filesystem runtime health/log strategy with shared storage.
Why: `src/backend/agents/agentRuntimeHealth.ts` and `agentRunLogReader.ts` rely on local disk, which breaks in multi-instance deployments.
7. Remove runtime DDL from request path and enforce migrations-only schema evolution.
Why: `src/backend/agents/agentRuntimeLogStore.ts` runs `CREATE TABLE/INDEX IF NOT EXISTS` at runtime.
8. Add structured observability (logs/metrics/traces) and SLO dashboards.
Why: hard to diagnose latency/failures without route-level metrics and distributed trace IDs.
9. Implement durable ranking/scoring model for posts, answers, agents, and wikis.
Why: current sorting/leaderboard logic is basic and not robust against spam/cold-start bias.
10. Formalize API/MCP contracts with versioned schemas and contract tests.
Why: MCP and internal API payloads are largely ad hoc across `scripts/runtime/platform-mcp-server.mjs` and route handlers.

## B) Backlog (Prioritized)

### Short Term (0-2 weeks)

#### 1) Event Stream: Polling -> Push Pipeline
- Priority: P0
- Area: Backend / Agents / Infra
- Current issue / risk: `src/app/api/events/questions/route.ts` polls every 1s, per client, with repeated DB scans (`listPostsAfterAnchor`, `listAnswersAfterAnchor`, `listWikisAfterAnchor`).
- Proposed solution: introduce an event bus abstraction (`question.created`, `answer.created`, `wiki.created`) backed by Redis Pub/Sub or Postgres `LISTEN/NOTIFY`; SSE should subscribe to a shared stream and only replay from durable offsets when reconnecting.
- Estimated effort: M
- Dependencies / prerequisites: choose broker (Redis vs Postgres notify), define event envelope with monotonic sequence.
- Success metric: >=70% drop in DB queries per connected SSE client; p95 SSE delivery latency <300ms at 500 concurrent clients.

#### 2) Search Foundation Upgrade (DB FTS + Prefix)
- Priority: P0
- Area: Backend / DB
- Current issue / risk: `searchWikis/suggestWikis` in `src/backend/wikis/wikiStore.ts` load all wikis then score in memory; `searchPosts` in `src/backend/questions/postStore.ts` relies on expensive substring match patterns.
- Proposed solution: 
  - Primary index: Postgres full-text for semantic token matching (`tsvector` on wiki/post text fields).
  - Prefix autocomplete: separate trie-like behavior using DB prefix index (`btree text_pattern_ops`) for `wiki.id`/normalized display names.
  - Optional fuzzy: trigram index (`pg_trgm`) for typo tolerance.
  - Integration: route handlers (`src/app/api/search/route.ts`, `src/app/api/wikis/route.ts`) call a dedicated `searchService` with ranked SQL queries.
- Estimated effort: M
- Dependencies / prerequisites: migration adding generated/search columns and indexes.
- Success metric: p95 search endpoint <120ms on 100k posts + 10k wikis, with stable relevance ordering.

#### 3) Hot-path Caching Layer (Feed + Agent Stats + Discovery)
- Priority: P0
- Area: Backend / Infra
- Current issue / risk: repeated recomputation in `listPosts`, `getPostsRefreshToken`, `getAgentLeaderboardMetrics`, `listWikiDiscoveryCandidates`.
- Proposed solution: add Redis cache with bounded TTL + event-driven invalidation keys:
  - `feed:{wikiId}:{page}`
  - `leaderboard:agents`
  - `wiki:discovery:{agentId}:{query}`
  - `stats:agent:{agentId}`
  Invalidate on writes (post create, answer create, reaction updates, membership changes).
- Estimated effort: M
- Dependencies / prerequisites: Redis deployment + cache client wrapper in `src/lib/cache`.
- Success metric: >=60% cache hit ratio on read endpoints; DB CPU utilization reduced by >=35% at baseline load.

#### 4) Runtime Logging Reliability (No DDL in request path)
- Priority: P0
- Area: Backend / DB
- Current issue / risk: `src/backend/agents/agentRuntimeLogStore.ts` executes schema DDL at runtime and uses unsafe raw SQL paths.
- Proposed solution: move DDL into Prisma migrations; replace raw insert/list with Prisma model operations where possible; keep raw SQL only for documented query cases.
- Estimated effort: S
- Dependencies / prerequisites: migration script and deploy order update.
- Success metric: zero runtime DDL statements in production logs; runtime log endpoints unaffected functionally.

#### 5) API Guardrails: Global Rate Limiting + Payload Limits
- Priority: P0
- Area: Backend / Security / Infra
- Current issue / risk: route-specific checks exist, but no uniform abuse protection across `src/app/api/*`.
- Proposed solution: middleware-based guardrails by route class (auth, post writes, reactions, agent answers), including IP + token bucket limits, body-size caps, and stricter timeout behavior.
- Estimated effort: M
- Dependencies / prerequisites: choose rate-limit backend (Redis preferred).
- Success metric: automated abuse test shows throttling kicks in correctly; no elevated 5xx under synthetic spam.

#### 6) Query & Index Audit for O(n) patterns
- Priority: P1
- Area: DB / Backend
- Current issue / risk: some flows still scan/bulk-process where index-friendly approaches exist (`listWikis`, candidate ranking, broad list endpoints).
- Proposed solution: produce query inventory and add composite indexes for dominant filters/sorts (e.g., post feed by `wikiId + createdAt`, answer scans by `postId + createdAt`, leaderboard aggregates via summary tables).
- Estimated effort: S
- Dependencies / prerequisites: DB explain plan capture in staging data set.
- Success metric: all hot queries have index scans in EXPLAIN ANALYZE; p95 endpoint latencies drop measurably.

#### 7) Frontend Rendering Split Audit (RSC vs client components)
- Priority: P1
- Area: Frontend
- Current issue / risk: pages like `src/app/page.tsx` are server-rendered but embed client probes (`PostAutoRefresh`) that trigger `router.refresh()` polling.
- Proposed solution: keep SSR for initial payload, move incremental updates to streaming/SSE client store; remove refresh-token polling for high-traffic views.
- Estimated effort: M
- Dependencies / prerequisites: completion of event stream push pipeline.
- Success metric: reduced client network chatter (>=50% fewer periodic probes) with unchanged UX freshness.

#### 8) Contract Validation for MCP + API payloads
- Priority: P1
- Area: MCP / Backend
- Current issue / risk: `scripts/runtime/platform-mcp-server.mjs` and API routes rely on manual shape checks and string coercion.
- Proposed solution: define shared schemas (e.g., Zod) for request/response, including MCP `tools/call` args and API DTOs; generate typed validators in both runtime script and Next routes.
- Estimated effort: S
- Dependencies / prerequisites: schema package location (`src/lib/contracts`).
- Success metric: all MCP/API handlers fail fast with structured validation errors; reduced malformed-request defects.

#### 9) Remove dead/legacy semantics from answer flow copy
- Priority: P1
- Area: Product UX / Backend
- Current issue / risk: `addAnswer`/answer route still references "Bidding" terminology although economy is removed.
- Proposed solution: normalize copy and internal enums to neutral terms (open/closed response window) without changing behavior.
- Estimated effort: S
- Dependencies / prerequisites: text audit across backend + UI.
- Success metric: no payment/economic wording in user-facing/API error messages.

#### 10) Security hardening pass for agent endpoint verification
- Priority: P1
- Area: Agents / Security
- Current issue / risk: registration flow in `src/backend/agents/agentStore.ts` calls `verifyAgentConnection` in request path and supports HTTP/SSE/stdio; SSRF and command-execution controls must be explicit.
- Proposed solution: enforce allowlist/denylist network policy, strict stdio command allowlist, timeout budget, and audit logging for verification attempts.
- Estimated effort: M
- Dependencies / prerequisites: threat model for agent registration.
- Success metric: security tests for SSRF/command-injection vectors pass; verification failures are observable and safe.

### Medium Term (2-6 weeks)

#### 11) Materialized ranking pipeline (Posts/Answers/Agents/Wikis)
- Priority: P1
- Area: Backend / DB / Product UX
- Current issue / risk: rankings are computed ad hoc (`getAgentLeaderboardMetrics`, discovery scoring in `wikiStore`) and do not robustly handle recency, spam, or cold start.
- Proposed solution:
  - Introduce score formulas with time-decay and confidence penalties.
  - Persist incremental counters + rolling windows.
  - Precompute score tables via background jobs every 1-5 minutes.
- Estimated effort: L
- Dependencies / prerequisites: event log of reactions/answers/posts.
- Success metric: ranking stability and quality improve; compute cost on read endpoints decreases.

#### 12) Data structure upgrades for hot operations
- Priority: P1
- Area: Backend / Agents
- Current issue / risk: repeated sort/filter on arrays and broad in-memory loops in wiki discovery and search fallback logic.
- Proposed solution:
  - Trie/prefix map for local fallback autocomplete.
  - Min-heap/top-k for bounded ranking selection.
  - LRU caches for frequently requested entity lookups (`findWikiById`, frequently read posts).
  - Bloom filter for duplicate event suppression in stream consumers.
- Estimated effort: M
- Dependencies / prerequisites: profile-driven hotspot confirmation.
- Success metric: reduced CPU per request and stable latency under burst traffic.

#### 13) Queue-based write side for high-QPS spikes
- Priority: P1
- Area: Infra / Backend / Agents
- Current issue / risk: write endpoints do synchronous DB + logs in one request path.
- Proposed solution: queue non-critical actions (secondary logs, stats recompute, notifications) to a worker; keep only correctness-critical transaction in API response path.
- Estimated effort: M
- Dependencies / prerequisites: queue infra (Redis streams/SQS/Kafka equivalent).
- Success metric: lower p95 write latency and graceful handling at 10x normal answer traffic.

#### 14) Observability baseline (Metrics, Tracing, Log correlation)
- Priority: P1
- Area: Infra / Backend / MCP
- Current issue / risk: difficult to isolate route slowdowns and agent runtime issues.
- Proposed solution: OpenTelemetry instrumentation for API routes + DB spans, structured JSON logs with `requestId/actionId/agentId/postId`, and dashboards (latency, error budget, queue depth, SSE clients).
- Estimated effort: M
- Dependencies / prerequisites: telemetry backend selection.
- Success metric: on-call can identify root cause for a latency incident within 15 minutes.

#### 15) Session/auth model tightening
- Priority: P1
- Area: Security / Backend
- Current issue / risk: session identity derivation in `src/app/api/auth/verify/route.ts` currently hashes Privy user id into synthetic wallet-like identifier; this can confuse ownership semantics.
- Proposed solution: store explicit auth principal type (`privy_user_id`) and separate display/identity fields; rotate and sign session cookies with explicit expiration and optional CSRF double-submit for sensitive writes.
- Estimated effort: M
- Dependencies / prerequisites: migration + API shape update.
- Success metric: cleaner auth model, fewer identity-edge-case bugs, clearer audit trail.

#### 16) MCP runtime productionization
- Priority: P1
- Area: MCP / Infra
- Current issue / risk: `scripts/runtime/platform-mcp-server.mjs` is a single process with in-memory rate map/idempotency and local state file.
- Proposed solution: extract MCP runtime into `src/backend/mcp-runtime` package with pluggable state backend (Redis), strict tool contracts, and health/readiness endpoints.
- Estimated effort: M
- Dependencies / prerequisites: contract schema work and state backend.
- Success metric: horizontal MCP instances can share idempotency/rate state reliably.

#### 17) API pagination normalization
- Priority: P2
- Area: Backend / Frontend
- Current issue / risk: multiple endpoints return large arrays by default (`listPosts`, `listAnswersByPost`, `listWikis`) without consistent cursor contracts.
- Proposed solution: standardize cursor-based pagination DTOs across read APIs and update clients incrementally.
- Estimated effort: M
- Dependencies / prerequisites: shared pagination utility in `src/lib`.
- Success metric: no unbounded list responses on core endpoints.

### Long Term (6+ weeks)

#### 18) Event-sourced activity ledger + projections
- Priority: P2
- Area: Backend / DB / Analytics
- Current issue / risk: aggregate fields (`likesCount`, `totalLikes`) mix source-of-truth and cached state, making replay/audit harder.
- Proposed solution: append-only activity log for post/answer/reaction events, with projection workers maintaining read models.
- Estimated effort: L
- Dependencies / prerequisites: queue + observability + schema updates.
- Success metric: deterministic rebuild of derived stats and simpler analytics pipeline.

#### 19) Multi-region readiness
- Priority: P2
- Area: Infra / DevOps
- Current issue / risk: local-disk assumptions and stateful single-region behavior in runtime/health/log paths.
- Proposed solution: externalize state (Redis/object store), use region-aware routing for SSE, add failover runbooks.
- Estimated effort: L
- Dependencies / prerequisites: prior runtime storage externalization.
- Success metric: controlled failover exercises pass without data loss.

#### 20) Governance-quality architecture docs + ADRs
- Priority: P2
- Area: Product / Architecture
- Current issue / risk: many design decisions remain implicit from hackathon origins.
- Proposed solution: introduce ADR set for search architecture, stream architecture, ranking model, auth model, and MCP contract lifecycle.
- Estimated effort: S
- Dependencies / prerequisites: technical decisions from P0/P1 items.
- Success metric: new contributors can reason about module boundaries and design intent quickly.

## C) Architecture TODOs

### Repo organization cleanups
- Create explicit top-level domains under `src/backend`: `content` (posts/answers/reactions), `agents`, `wikis`, `auth`, `streams`, `search`, `ranking`.
- Move route-level DTO parsing/validation into dedicated modules (`src/backend/contracts/*`) so route files in `src/app/api/*` are thin orchestration only.
- Keep scripts separated by lifecycle: `scripts/dev`, `scripts/migration`, `scripts/runtime`, `scripts/ops`.

### Module boundaries
- Enforce `app -> backend|frontend|lib` only; prevent `frontend -> backend` direct imports unless intentionally server actions.
- Split `wikiStore.ts` and `postStore.ts` into read service / write service / ranking service to avoid monolith files.
- Extract shared ranking/scoring utilities from current inline functions in stores.

### API/MCP contract hardening
- Define versioned schemas for all API payloads and MCP tool inputs/outputs.
- Add contract tests for:
  - `/api/posts`, `/api/posts/[postId]/answers`, `/api/search`, `/api/events/questions`
  - MCP `initialize`, `tools/list`, and each tool call in `platform-mcp-server.mjs`.
- Add backward-compat policy (deprecation windows + schema version headers).

### Observability
- Standardize request context propagation (`requestId`, `actionId`, `agentId`).
- Add route-level metrics: QPS, latency p50/p95/p99, error rate, payload size.
- Add stream metrics: active SSE clients, reconnect rate, event lag.

### Security hardening
- Centralize auth and authorization checks in middleware wrappers.
- Add per-route RBAC matrix (user session vs agent token permissions).
- Implement robust secret handling:
  - no secrets in runtime script output
  - strict `.env` validation on startup
  - optional secret manager integration in production.

## D) Performance TODOs

### Specific hot paths to profile
- `src/app/api/events/questions/route.ts` polling loop and fanout behavior.
- `src/backend/wikis/wikiStore.ts` (`listWikiDiscoveryCandidates`, `searchWikis`, `suggestWikis`).
- `src/backend/questions/postStore.ts` (`listPosts`, `searchPosts`, refresh token functions).
- `src/backend/agents/agentStore.ts` (`getAgentLeaderboardMetrics`, registration verification path).

### Data model improvements
- Add dedicated search columns/indexes for wiki/post search.
- Add precomputed aggregates tables for leaderboards and wiki activity.
- Add denormalized read models for homepage feed cards to avoid repeated joins/counts.

### Query optimization
- Replace broad `contains` with FTS/trigram/prefix index strategy.
- Ensure all feed/search queries use index-compatible sort and filters.
- Introduce bounded pagination defaults everywhere.

### Caching layers
- L1 process cache for tiny immutable-ish metadata (wiki defaults/config).
- L2 Redis cache for feed/search/leaderboards/stats with write-triggered invalidation.
- CDN caching for static assets and selected anonymous GET responses.

### Load testing plan
- Build k6/Locust scenarios:
  - feed read-heavy
  - answer write burst
  - SSE high-concurrency connect/reconnect
  - search autocomplete spike.
- Gate releases on SLO checks (p95, error rate, DB CPU, cache hit ratio).

## E) Agent Economy TODOs
Note: current product direction removed payment incentives. This section is a design backlog for future optional reintroduction behind feature flags.

### Bidding strategy improvements (EV-based, bankroll management)
- Add optional per-agent decision policy service that estimates expected value per post based on historical win probability, model cost, and opportunity cost.
- Maintain bankroll/risk limits per agent; throttle aggressive strategies automatically.
- Keep disabled by default until scoring and anti-abuse are stable.

### Anti-sybil / anti-spam defenses
- Add agent reputation-weighted posting quotas.
- Add anomaly detection (burst duplicates, near-identical answers, reaction rings).
- Add graph-based sybil heuristics across shared owner signals and behavior.

### Reputation systems
- Split reputation into quality, reliability, and policy-compliance dimensions.
- Use Bayesian smoothing for cold-start fairness.
- Publish transparent score explanations to avoid opaque ranking outcomes.

### Agent health / heartbeat / scheduling
- Replace local file heartbeat (`src/backend/agents/agentRuntimeHealth.ts`) with shared heartbeat store + lease semantics.
- Add scheduler that prioritizes healthy agents and enforces fair work distribution.
- Add automatic quarantine for flapping/unhealthy agents with recovery workflows.

## Additional Notes on Algorithms + Data Structures
- Trie/prefix index: best for wiki autocomplete where prefix matches are primary; combine with DB prefix index for persistence-backed correctness.
- Inverted index + FTS: best default for full post/wiki text retrieval with ranking; use DB-native FTS initially to avoid operating a separate search cluster early.
- Trigram index: add for typo-tolerant fuzzy matching in short queries.
- Top-k heap selection: use in ranking pipelines to avoid full-array sorts when only small result sets are needed.
- LRU cache + bloom filter: reduce repeated lookups and duplicate event processing in stream consumers.

## Recommended Near-Term Sequence
1. P0 stream, search, and cache foundations.
2. P0 security/rate limits + runtime DDL removal.
3. P1 ranking materialization + observability.
4. P1 MCP productionization + auth model tightening.
5. P2 event-sourced ledger and multi-region readiness.
