# Scout Research Findings — Expansion (New Areas) — 2026-06-12

> Research-only deliverable. No project code was changed; the only file created is this one.
> Every GitHub metric (stars, last-push date, license) was pulled from the live GitHub
> API on **2026-06-12**; free-tier limits and Anthropic API facts were fetched from the
> respective docs the same day. Where I could not verify something, I say so explicitly.
> Star counts and dates drift — treat them as "as of 2026-06-12."

---

## 0. Current-state recap + what's already covered in prior findings

**Runtime map (verified by reading the repo).** Scout is a durable AI agent on free-tier
infra: a Next.js 15 / React 19 app on **Vercel Hobby** fronts a **Supabase Edge Function
(Deno/TypeScript)** that self-chains node-by-node (`supabase/functions/agent/index.ts`),
leasing one node per invocation (~100 s wall budget, `WALL_BUDGET_MS = 100_000`,
`LEASE_SECONDS = 120`). Durability = atomic `acquire_run_lease` + `node_execution_id`
stale-write guard + `langgraph_checkpoints` JSONB snapshots + a **`pg_cron` 1-min
heartbeat** (via `pg_net`) that reclaims expired leases. Postgres tables: `runs ·
run_steps · langgraph_checkpoints · reports · scrape_pages · tools · agent_invocations`,
all under RLS, on **Supabase Free (500 MB DB, 500K Edge invocations/mo)**. Entry points:
auth'd `/api/discover` and **HMAC-signed `/api/webhook/scout`** (`v0:ts:body`, 5-min
window). The editable `reports` row drives the viewer; share links are 32-byte tokens
stored only as SHA-256 hashes. An MCP stdio server (`mcp/`, `@modelcontextprotocol/sdk
^1.29.0`) exposes 5 tools; an n8n companion loop exists as JSON. Validation stack: **Zod
4.4.3**; LLM calls go to `claude-opus-4-8` (judgement nodes) and `claude-haiku-4-5`
(structured nodes), with token/cost telemetry already captured per step in `run_steps`
(`input/output/cache_read/cache_creation_tokens`, `cost_usd`).

**Out of scope (already in `findings.md`, do not re-litigate):** discovery-depth
extraction (defuddle, Jina, deep-research patterns), reference architectures (EIP / Azure
patterns for `solution_design`), the real-n8n-template corpus (`api.n8n.io`, Zie619), and
the **cost/latency track** — Anthropic **prompt caching** (shared cached prefix), **native
`Supabase.ai` gte-small + pgvector semantic cache**, the **Batch API**, model routing, and
content-hash scrape dedupe. This expansion deliberately covers the *other* surfaces:
**storage efficiency, orchestration reliability, security hardening, observability/evals,
structured output, MCP tooling, and report generation.** Where an item touches something
prior findings named (e.g. pgvector), I only add the *new* refinement (e.g. `halfvec`
storage), never the original recommendation.

**The single most important new realization:** Scout's LLM nodes still rely on *prompt-only*
JSON ("Output ONLY valid JSON") + a regex `extractJson` + one bounded retry. Anthropic now
offers **first-party structured outputs** on exactly the two models Scout uses — this is the
highest-leverage change in this entire document because it *removes* a class of failed/retried
calls (which also saves tokens), at **$0 and no new dependency**.

---

## 1. Top recommendations (ranked across all areas)

Ranked by leverage-per-unit-effort under Scout's hard constraints ($0 infra, 30–60K tok/run,
110 s/node, Deno+Node/TS, MIT/Apache pref).

| # | Recommendation | Area | Link | Impact (axis) | Effort | License | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **Anthropic Structured Outputs** (`output_config.format` + strict tool use) | E | [docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | High — guaranteed schema-valid JSON on opus-4-8 + haiku-4-5; kills parse-fail retries → **fewer tokens**, fewer failures | S (SDK paths) / M (Edge) | first-party | **adopt** |
| 2 | **Postgres LZ4 column compression** on big TOAST columns | A | [PG14 LZ4](https://www.dbi-services.com/blog/postgresql-14-lz4-compression-for-toast/) | Med-High — ~30–40% less disk on `scrape_pages.markdown`, `reports.*` jsonb, checkpoints; faster decompress; **$0** | S | n/a (PG) | **adopt** |
| 3 | **Checkpoint slimming (claim-check) + report de-dup** | A/B | (pattern) | High — stops storing the 60 KB `scrapeMarkdown` in **every** checkpoint row (~12×/run) and the duplicate `opportunities`/`ranked`; biggest single storage win | S/M | n/a | **adopt** |
| 4 | **Zod 4 `z.toJSONSchema()` as the one schema source** | E/F | [Zod](https://github.com/colinhacks/zod) (42,946★) | Med-High — derive Anthropic *and* MCP tool schemas from `agent/src/schemas/index.ts`; removes hand-written JSON Schema duplication | S | MIT | **adopt** |
| 5 | **MCP `McpServer` + `registerTool` (same SDK)** | F | [typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) (12,652★) | Med — replaces low-level `Server`+`setRequestHandler`+~100 lines hand-JSON-Schema; validated I/O, `outputSchema`→`structuredContent` | M | MIT (v1.x) | **adopt** |
| 6 | **react-markdown + @react-pdf/renderer** | G | [react-markdown](https://github.com/remarkjs/react-markdown) (15,763★) · [react-pdf](https://github.com/diegomura/react-pdf) (16,628★) | Med-High — playbook is currently rendered in raw `<pre>`; adds real markdown + $0 client-side PDF export (closes deferred P13) | S / M | MIT | **adopt** |
| 7 | **cockatiel** (retry + backoff + jitter + circuit breaker) | B | [cockatiel](https://github.com/connor4312/cockatiel) (1,789★) | Med — replace fixed 30 s retry with exp-backoff+jitter; circuit-break Jina/Anthropic | S/M | MIT | **prototype** |
| 8 | **promptfoo** eval/regression harness in CI | D | [promptfoo](https://github.com/promptfoo/promptfoo) (22,152★) | Med — fills the **empty** `evals.yml`; declarative asserts + model-graded; $0 in GH Actions | M | MIT | **adopt** |
| 9 | **jsonrepair** repair-on-invalid fallback | E | [jsonrepair](https://github.com/josdejong/jsonrepair) (2,361★) | Med — salvages truncated/malformed JSON before the retry; tiny, Deno-friendly; complements #1 | S | ISC* | **adopt** |
| 10 | **Helicone** (or Langfuse) free-tier LLM tracing | D | [helicone](https://github.com/Helicone/helicone) (5,809★) | Med — $0 traces + cost dashboards replacing optional LangSmith; Helicone = proxy URL swap | S / M | Apache-2.0 | **prototype** |
| 11 | **rate-limiter-flexible (Postgres store)** | C | [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) (3,555★) | Med — closes the unimplemented P10 "rate-limit caller"; $0, no new vendor (uses Supabase) | M | ISC | **prototype** |
| 12 | **jsondiffpatch** report-version diffing | G | [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) (5,319★) | Med — "what changed since last run" on `reports.version`; real value for re-engagements | M | MIT | **prototype** |

\* jsonrepair: GitHub API reports `NOASSERTION`; the repo's own license is **ISC** — verify before redistribution.

**Deliberate non-adoptions (full reasons §9):** instructor-js (stale + made redundant by #1),
BAML (heavy DSL/runtime, redundant once #1 lands), Valibot (not worth a Zod migration), DBOS
Transact & graphile-worker (need a long-lived process — breaks the Edge model), pgmq/Supabase
Queues as a *core-loop* replacement (lateral move, not strictly better than self-chain+heartbeat),
puppeteer/chromium PDF (cold-start on Hobby), ajv & tokenlens (Zod / the hardcoded price table
already cover them).

---

## 2. Persistence & storage efficiency

*Targets `scrape_pages · reports · langgraph_checkpoints · run_steps`, Supabase Free 500 MB.*
This area is mostly **Postgres-native patterns**, not libraries — which is the right shape for a
$0 single-Postgres deployment.

### 2.1 The big finding — checkpoint bloat (claim-check)

`saveCheckpoint()` persists the **entire** `ScoutGraphState` as the `checkpoint` JSONB on
**every node** (12 writes/run). That state includes `scrapeMarkdown`, which `scrape_site`
fills with up to **60,000 chars** (`markdown.slice(0, 60_000)`). So a single run writes the
same ~60 KB blob ~10–12× into `langgraph_checkpoints` — **and the same markdown already lives
in `scrape_pages`**. That's roughly **0.5–0.7 MB of duplicated text per run**, so a few hundred
runs can exhaust the 500 MB free disk from checkpoints alone.

- **Fix (claim-check pattern):** the state already carries `scrapePageIds: string[]`. Store the
  IDs in the checkpoint, **not** the markdown; rehydrate `scrapeMarkdown` from `scrape_pages`
  on resume (cheap PostgREST read). Net: checkpoint rows shrink ~20–50×.
- **Secondary de-dup:** `runFinalize` writes `opportunities` **and** `ranked` to the same array
  (`reports.opportunities = reports.ranked = state.opportunities`) — an exact duplicate column.
  Pick one (or store `ranked` as an order array of ids).
- Impact on axis: **less storage, faster checkpoint writes/reads, $0.** Caveat: touches the
  durable runtime — sequence behind the P9 lease/recovery tests.

### 2.2 LZ4 TOAST compression (verified)

`text`/`jsonb` use TOAST `EXTENDED` storage and are compressed automatically — Scout's defaults
likely use **pglz**. Postgres 14+ (Supabase runs ≥15) supports **LZ4**:
`ALTER TABLE public.scrape_pages ALTER COLUMN markdown SET COMPRESSION lz4;` (likewise the big
`reports.*` jsonb columns and `langgraph_checkpoints.checkpoint`). LZ4 is **faster** to
de/compress than pglz and yields ~**30–40%** smaller TOAST on JSONB/text per the PG community
benchmarks. Existing rows aren't recompressed (safe to change; future writes pick it up — backfill
with a no-op `UPDATE` if you want immediate effect). **$0, one migration, near-zero risk.**
Sources: [dbi-services PG14 LZ4](https://www.dbi-services.com/blog/postgresql-14-lz4-compression-for-toast/),
[TigerData compression guide](https://www.tigerdata.com/learn/postgresql-compression).
*(Note: the correct DDL is `SET COMPRESSION lz4` — not `SET STORAGE` — one blog conflates them.)*

### 2.3 Smarter TTL / pruning

`prune_scout_data()` already deletes `run_steps`/`agent_invocations` > 30 d, expired
`scrape_pages`, and expired checkpoints (`expires_at` default **14 days**). Improvements, all $0:
- **Drop terminal-run checkpoints eagerly** — once `runs.status ∈ (completed, failed)` the
  checkpoints are dead weight; delete them at finalize (or a tighter cron) instead of waiting 14 d.
- **Shorten `scrape_pages` TTL** — 30 days is generous for a demo; 7–14 d trims the cache table.
- Autovacuum on Supabase handles bloat; no `pg_repack` needed at this size.

### 2.4 Indexes & vectors (light touch)

- Indexes are already good (`runs_active_idempotency_key_idx`, `runs_due_work_idx`,
  `scrape_pages_cache_idx` are partial/unique where it counts). A small win: a **covering index**
  (`INCLUDE (cost_usd, input_tokens, output_tokens)`) on `run_steps (run_id, created_at)` for the
  RUNBOOK cost query. Minor; only if the dashboard query shows up hot.
- **`pgvector halfvec`** (pgvector ≥ 0.7, on Supabase) — **only relevant if/when you build the
  prior-findings gte-small semantic cache.** Storing the 384-dim vectors as `halfvec` (float16)
  **halves** vector + index storage and speeds HNSW builds with negligible recall loss. Forward-looking
  storage note, not a new cache recommendation.
  Sources: [pgvector 0.7 on Supabase](https://supabase.com/blog/pgvector-0-7-0),
  [Neon halfvec](https://neon.com/blog/dont-use-vector-use-halvec-instead-and-save-50-of-your-storage-cost).

**Verdict for area A:** adopt §2.1 (claim-check + de-dup) and §2.2 (LZ4) now — both pure $0
wins; §2.3 next; §2.4 is opportunistic.

---

## 3. Orchestration reliability & idempotency

*Self-chaining Edge Functions + `pg_cron` heartbeat + lease + checkpoint.*

**Honest assessment first:** Scout's durability design is already strong and well-matched to the
constraints — atomic lease (`acquire_run_lease` with `lease_until`/`locked_by`/`node_execution_id`),
a stale-write guard (`complete_run_node`/`fail_run_node` match on `node_execution_id`), idempotent
side effects (`Prefer: resolution=merge-duplicates` on checkpoint, report, and scrape inserts;
content-based `idempotency_key` with a partial unique index on active runs), and a `pg_cron`
heartbeat that recovers dropped self-chains. **Most "durable execution" tooling would be a lateral
move or would break the serverless/$0 model.** The genuinely-better-at-$0 changes are small:

| Candidate | Link | Fit | Runtime | License | Stars · last push | Verdict |
|---|---|---|---|---|---|---|
| **cockatiel** | [connor4312/cockatiel](https://github.com/connor4312/cockatiel) | Exp-backoff **+ jitter**, circuit breaker, timeout, bulkhead — pure TS | Node ✓ / Deno (pure TS, no Node built-ins in core — **verify under `npm:`**) | MIT | 1,789★ · 2026-05-26 | **prototype** |
| **p-retry** | [sindresorhus/p-retry](https://github.com/sindresorhus/p-retry) | Minimal retry+backoff if you don't want the breaker | Node/Deno | MIT | 1,019★ · 2026-03-26 | watch |
| **pgmq / Supabase Queues** | [tembo-io/pgmq](https://github.com/tembo-io/pgmq) · [Supabase Queues](https://supabase.com/docs/guides/queues) | Postgres-native durable queue, exactly-once-ish, RLS | Postgres extension | PostgreSQL (permissive) | 4,946★ · 2026-05-20 | **watch** |
| **DBOS Transact (TS)** | [dbos-inc/dbos-transact-ts](https://github.com/dbos-inc/dbos-transact-ts) | Durable workflows/steps on Postgres, idempotency keys | **Needs a long-lived Node process** + recovery loop | MIT | 1,239★ · 2026-06-11 | watch (study only) |
| **graphile-worker** | [graphile/worker](https://github.com/graphile/worker) | Postgres job queue (LISTEN/NOTIFY) | **Needs a persistent worker** | MIT | 2,293★ · 2026-06-12 | **reject** (runtime) |

**Concrete recommendations:**
1. **Exponential backoff + jitter** — `fail_run_node` currently sets `lease_until = now() +
   interval '30 seconds'` for *every* retry. A flat 30 s plus the 1-min heartbeat can thunder on a
   transient Anthropic `429/529`. Make the backoff a function of `attempts` (e.g. `30·2^attempts`
   ± jitter) — trivially in SQL, or use **cockatiel/p-retry** for the in-node external calls
   (Jina, Anthropic). **Strictly better at $0.**
2. **Circuit breaker** on Jina/Anthropic via **cockatiel** — stop hammering a down dependency
   inside the 110 s budget; fail fast to the next attempt. Medium value.
3. **pgmq is a *watch*, not an adopt.** It's light and $0 (just an extension) and would shine for
   *fan-out* work (parallel multi-page scraping, the n8n inbound-triage loop), but for the **core
   self-chain it isn't strictly better** — it still needs a cron/`pg_net`-driven consumer on
   serverless, i.e. the same machinery you already have. Don't swap a working elegant loop for a
   queue without a fan-out reason. *(Could not confirm Queues' dashboard availability on the Free
   plan specifically, but pgmq is a standard enableable Postgres extension — verify in the dashboard.)*
4. **DBOS/Temporal/graphile-worker:** all assume a persistent process; they contradict the Edge
   per-invocation model and/or $0. Study DBOS's step-idempotency design as a reference; don't adopt.

---

## 4. Security hardening

*HMAC `/api/webhook/scout`, share links, auth, SSRF.*

Current posture is good: `verifyWebhookSignature` (Slack-style `v0:ts:body`, 5-min drift,
SHA-256), 32-byte share tokens stored as SHA-256 hashes with expiry + revocation enforced inside
`get_public_report_by_share_token_hash`, RLS everywhere, SSRF checks at every redirect hop. Gaps
and hardening:

| Topic | Current state | Recommendation | Effort |
|---|---|---|---|
| **Constant-time compare** | hand-rolled `timingSafeEqual` (char-XOR, early-return on length mismatch) | Low severity (hex is fixed-length) but harden: prefer a platform primitive (Deno `@std`/Node `crypto.timingSafeEqual`) **or** double-HMAC the candidate before compare so length/content never leaks timing | S |
| **Replay / nonce** | 5-min timestamp window, **no nonce** | Mostly mitigated already: the content-based `idempotency_key` makes a replayed identical body collapse to the *same run*. For belt-and-suspenders, add a short-TTL `seen_signatures(jti, expires_at)` table and reject repeats inside the window | S |
| **Rate limiting** | **P10 left "rate-limit caller" unimplemented** | Add to `/api/webhook/scout` + `/api/discover`. Two $0 options below | M |
| **SSRF robustness** | Edge `isSafeUrl` is a **hostname regex** (`127.|10.|192.168.|…`) — misses decimal/octal/hex IPs, IPv4-mapped IPv6, `0.0.0.0/8`; web path uses `assertSsrfSafe` (stronger — verify coverage) | Parse + classify IPs with **ipaddr.js** (`.range()` → private/reserved/loopback/linklocal) instead of regex. DNS-rebinding can't be fully fixed in Edge `fetch` (no resolved-IP pinning) — document the residual risk | M |
| **Schema hardening** | Zod on webhook/input; `data: z.record(z.string(), z.unknown())` is permissive | Add `.strict()` to reject unexpected top-level keys (defense-in-depth) | S |
| **Share-link safety** | 32-byte token, hash-only storage, expiry+revoke, indexed lookup | **No change needed** — this is already best-practice | — |

**Rate-limit options ($0):**

| Option | Link | Free-tier reality | Fit |
|---|---|---|---|
| **rate-limiter-flexible** (Postgres store) | [animir/node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) · 3,555★ · ISC · 2026-06-08 | **$0, no new vendor** — uses your Supabase Postgres as the counter store | **Recommended** — keeps everything in-stack |
| **@upstash/ratelimit** + Upstash Redis | [upstash/ratelimit-js](https://github.com/upstash/ratelimit-js) · 2,038★ · MIT | Upstash Redis free = **500K commands/mo, 256 MB, 10 GB egress, 1 DB**, works on Vercel edge | Use only if you want edge-latency limiting and accept a 2nd free-tier vendor |

**ipaddr.js:** [whitequark/ipaddr.js](https://github.com/whitequark/ipaddr.js) · 638★ · MIT · 2026-05-08 — pure JS, Deno/Node, the standard for robust IPv4/IPv6 range classification.

---

## 5. Observability, evals & cost tracking

*LangSmith is currently optional/paid-ish; `evals.yml` is a placeholder.*

**Foundation is already there:** `run_steps` records per-node `input/output/cache_read/
cache_creation` tokens + `cost_usd` (`cost.ts` hardcodes accurate `claude-opus-4-8 $5/$25` and
`claude-haiku-4-5 $1/$5` tables with prefix-matched model lookup). The gaps are (a) an **eval
harness** wired into the empty `evals.yml`, and (b) optional **tracing** to replace LangSmith.

| Tool | Link | What it gives Scout | $0 path | License | Stars · last push | Verdict |
|---|---|---|---|---|---|---|
| **promptfoo** | [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | Declarative YAML evals + deterministic & model-graded asserts + red-team; runs in CI | **GH Actions ($0)** — fills `evals.yml` | MIT | 22,152★ · 2026-06-12 | **adopt** |
| **evalite** | [mattpocock/evalite](https://github.com/mattpocock/evalite) | **Vitest-native** TS evals + watch UI; Scout already uses Vitest + `deterministic-evals.test.ts` | local/CI, $0 | MIT | 1,590★ · 2026-04-28 | **prototype** (in-repo TS evals alongside promptfoo) |
| **Helicone** | [Helicone/helicone](https://github.com/Helicone/helicone) | Proxy → instant traces + cost/latency dashboards by changing the Anthropic base URL | Cloud free = **10K req/mo, 1 GB, 7-day** ; self-host (Apache-2.0) | Apache-2.0 | 5,809★ · 2026-06-11 | **prototype** |
| **Langfuse** | [langfuse/langfuse](https://github.com/langfuse/langfuse) | Richer traces + datasets + prompt mgmt; TS SDK instrument per node | Cloud Hobby = **50K units/mo, 30-day, 2 users**; self-host free (MIT core) | NOASSERTION (MIT core + EE) | 28,988★ · 2026-06-12 | **prototype** |
| **OpenLLMetry-js** | [traceloop/openllmetry-js](https://github.com/traceloop/openllmetry-js) | OTel-native instrumentation → any OTel backend (Grafana Cloud free, etc.) | $0 via free OTel backend | Apache-2.0 | 403★ · 2026-06-08 | watch (more setup; small project) |

**Recommendations:**
- **promptfoo into `evals.yml`** — Scout already has golden fixtures (`northbound-example.json`)
  and structural invariants (`deterministic-evals.test.ts`); promptfoo adds *regression* gating
  (assert citations map to source text, tool IDs ∈ catalog, no hallucinated tools) on PRs at $0.
  Pair with the **Batch API** (prior findings) for any model-graded judge to halve that cost.
- **Tracing is optional for the demo** — the DB telemetry already answers "what did each run cost."
  If you want a dashboard, **Helicone** is the lowest-effort ($0, URL swap, works with the raw
  `fetch` Edge path) — but note it's a **proxy hop** in the request path; use its async-logging mode
  or self-host to avoid added latency. **Langfuse** is richer (datasets, eval scores) but needs SDK
  instrumentation per node.
- **Cost accounting:** keep the hardcoded `cost.ts` table — it's correct and dependency-free. A
  pricing-table npm (tokenlens/llm-cost) would add a dep for no real gain → reject.

---

## 6. Structured output & validation

*Zod 4.4.3 is in the stack; every LLM node emits JSON via prompt + regex `extractJson` + one retry.*
**This is the highest-value area in the document.**

### 6.1 Anthropic Structured Outputs — adopt (verified for Scout's exact models)

Confirmed via the Claude API reference: structured outputs are supported on **`claude-opus-4-8`
and `claude-haiku-4-5`** (and Sonnet 4.6 / Fable 5). Two mechanisms on the Messages API:
- **`output_config: { format: { type: "json_schema", schema } }`** — constrains the whole response
  to your schema (SDK: `messages.parse()` + `zodOutputFormat(schema)`).
- **Strict tool use (`strict: true`)** — guarantees a tool call's `input` matches its schema; the
  natural fit for `map_tools` (return a validated mapping).

Why this is the top pick: Scout's nodes today *prompt* for JSON, then `extractJson` (strip fences,
find first `{`/`[`), `JSON.parse`, and on failure run a bounded retry. Structured outputs makes the
output **schema-valid by construction**, eliminating the parse-failure branch and its retry — which
**also saves tokens** (fewer reissued calls) and removes a hallucination/format-drift class.
**$0, no new dependency** — it's a request-body field on the API Scout already calls.

**Integration & caveats:**
- **JSON Schema subset** (per docs): no `minimum/maximum/multipleOf`, no `minLength/maxLength`, no
  recursion; `additionalProperties: false` required on every object. Scout's Zod schemas use
  `.min()/.max()/.max(200)/.url()` heavily — these must be dropped from the *wire* schema (validate
  them client-side after).
- **SDK paths (local graph + MCP)** use `client.messages.create` via `NodeDeps.createMessage`, so
  they get this almost free: `messages.parse()` + `zodOutputFormat()` **auto-strip** the unsupported
  keywords and validate client-side. **Effort S.**
- **Edge path** (`supabase/functions/agent/index.ts`) deliberately uses raw `fetch` ("no SDK") to
  keep the bundle small. Two choices: (a) add `output_config` to the body by hand with a schema from
  `z.toJSONSchema()` **+ a small strip-unsupported-keywords helper**, or (b) pull
  `@anthropic-ai/sdk` (already an `agent/` dep) into the Edge bundle (cold-start cost). **Recommend
  (a)** to preserve the small bundle. **Effort M.**
- Composes with the prior-findings cached-prefix plan; works with streaming, token counting, and
  thinking. Incompatible with **prefilling** and **citations** — Scout uses neither.
- First request per schema pays a one-time compile, then a 24-hour schema cache — fine for Scout's
  fixed node schemas.

### 6.2 Zod 4 `z.toJSONSchema()` — one schema, three consumers — adopt

Scout is on **Zod 4.4.3**, which ships **native `z.toJSONSchema()`**. Make
`agent/src/schemas/index.ts` the single source of truth and *derive*: (1) the Anthropic
`output_config`/tool schemas (§6.1), (2) the MCP `inputSchema` (§7, removing the ~100 lines of
hand-written JSON Schema in `mcp/src/index.ts`), and (3) the existing TS types. Also kills the
duplicated `CATALOG_IDS` array that's hand-copied between the Edge function, `catalog.ts`, and the
MCP layer (derive it once). **No new dep** (Zod is already in `agent`, `web`). **Effort S.**

### 6.3 jsonrepair — repair-on-invalid fallback — adopt

[josdejong/jsonrepair](https://github.com/josdejong/jsonrepair) · 2,361★ · **ISC*** · 2026-04-16 —
pure-ESM, Deno/Node/browser, tiny. Repairs malformed/**truncated** JSON (missing quotes/brackets,
trailing commas, `max_tokens` cutoffs) before `JSON.parse`. Even with §6.1, keep it as the safety
net for any path that still free-gens (and for `stop_reason: "max_tokens"` truncations). Drop it
into `parser.ts` between `extractJson` and `JSON.parse`. **Effort S.** *(License: GitHub API reports
`NOASSERTION`; repo is ISC — verify.)*

### 6.4 Rejected / not-worth-it here (see §9 for full reasons)
- **instructor-js** (796★, MIT, last push **2025-01-27 ≈ 17 mo stale**) — structured extraction
  over Zod with retries, but stale and **made redundant** by §6.1 + `zodOutputFormat`.
- **BAML** (8,355★, Apache-2.0) — excellent schema-aligned parser, but adds a **DSL + codegen build
  step + native/WASM runtime**; overkill once first-party structured outputs exist.
- **Valibot** (8,753★, MIT) — lighter than Zod and good for Edge cold-start, but Scout is deeply
  invested in Zod 4 and MCP's Standard-Schema accepts Zod directly; migrating isn't worth the churn.
  Revisit *only* if Edge bundle/cold-start becomes a measured problem.

---

## 7. MCP & agent tooling

*`mcp/src/index.ts` uses the low-level `Server` + `setRequestHandler` + hand-written JSON Schema.*

The win is **using the high-level API of the SDK Scout already depends on** — no new runtime dep.

| Item | Link | What it does | Verdict |
|---|---|---|---|
| **`McpServer` + `registerTool`** | [typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) · 12,652★ · MIT (v1.x) | Confirmed in **^1.29.0** (Scout's version): high-level server with `registerTool(name, {description, inputSchema, outputSchema})` taking **Standard Schema (Zod v4)**; auto-validates inputs, supports `outputSchema → structuredContent`. Replaces the 5 hand-written `inputSchema` blocks + the manual `switch` dispatch | **adopt** |
| **MCP Inspector** | [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector) · 10,061★ · MIT | Official interactive dev tool to list/call tools against the running stdio server — the protocol-level test harness Scout lacks (it has unit tests on handlers, no round-trip test) | **adopt** (dev-time) |
| **InMemoryTransport** (in the SDK) | (same SDK) | Pair `McpServer` with an in-memory client transport in Vitest for `list_tools`/`call_tool` round-trips without spawning a process | **adopt** (verify export name in 1.29) |
| **FastMCP** | [punkpeye/fastmcp](https://github.com/punkpeye/fastmcp) · 3,190★ · MIT | Higher-level TS framework (Zod tools, sessions, auth, SSE) atop the SDK | **watch** — only if Scout adds HTTP transport / auth / sessions; the official `McpServer` is enough for 5 stdio tools |

**Recommendations:** migrate to `McpServer` + `registerTool` with **Zod schemas derived per §6.2**
(so MCP and the agent share one schema), add `outputSchema`/`structuredContent` to the tools, and
wire an **InMemoryTransport** integration test + the **Inspector** into the dev loop. **Stay on SDK
1.x** — the repo's **v2 is pre-alpha** (Apache-2.0 for new code, MIT for existing). **Effort M.**

---

## 8. Report generation, export & viewing (features only where necessary)

*Editable `reports`, share links, `reports.version` + unique `(run_id, version)`, unused
`export_path` column; P13 export was deferred.*

Two of these are **necessary fixes**, not nice-to-haves — the current viewer renders the
markdown playbook in a raw `<pre>` and dumps `requirements`/`solution_design` as
`JSON.stringify` in `<pre>`, which is not a client-ready consulting deliverable.

| Library | Link | Use in Scout | Runtime | License | Stars · last push | Verdict |
|---|---|---|---|---|---|---|
| **react-markdown** (+ remark-gfm) | [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown) | Render `report.playbook` as real markdown (it's generated as markdown but shown in `<pre>`); render requirements/design structured | Node/Next.js | MIT | 15,763★ · 2025-04-21 (mature/stable) | **adopt** |
| **@react-pdf/renderer** | [diegomura/react-pdf](https://github.com/diegomura/react-pdf) | $0 PDF export of the report — **client-side or Vercel serverless, no headless browser** (avoids `@sparticuz/chromium` cold-start on Hobby); closes deferred P13 + uses `export_path` | Node/browser | MIT | 16,628★ · 2026-06-09 | **adopt** |
| **docx** | [dolanmiu/docx](https://github.com/dolanmiu/docx) | Generate editable **Word .docx** deliverables (pure JS, serverless-safe) — consulting clients often want Word | Node | MIT | 5,789★ · 2026-06-02 | **prototype** (after PDF, if clients ask) |
| **jsondiffpatch** | [benjamine/jsondiffpatch](https://github.com/benjamine/jsondiffpatch) | Diff `reports` across versions → "what changed on re-run" (real value for re-engagements); `version` + unique index already exist | Node/browser | MIT | 5,319★ · 2026-05-14 | **prototype** |
| **jsdiff** | [kpdecker/jsdiff](https://github.com/kpdecker/jsdiff) | Text/markdown-level diff of the **playbook** between versions (jsondiffpatch is for the structured JSON) | Node/browser | BSD-3-Clause | 9,161★ · 2026-06-02 | watch |
| **CSS `@media print`** | (no dep) | The $0 floor: a print stylesheet → browser "Save as PDF" before adding a PDF lib | — | — | — | **baseline** |

**Recommendations (features only where necessary):**
1. **react-markdown** — necessary; the playbook render is currently broken (raw `<pre>`). **S.**
2. **@react-pdf/renderer** — necessary for a consulting deliverable; closes P13 export at $0 without
   a serverless browser. (Verify Deno/Edge compat if you ever render PDF in the Edge function;
   simplest is to render in the Next.js/Vercel layer.) **M.**
3. **jsondiffpatch** version-diff — high-value, optional; ship once re-runs are common. **M.**
4. **docx** — only if clients ask; **slides (marp/reveal) = reject** as scope creep.

---

## 9. Rejected / not worth it (with reasons)

- **instructor-js** — MIT but **last push 2025-01-27 (~17 mo stale)**, and Anthropic structured
  outputs + `zodOutputFormat` now do its job natively (§6). Reject.
- **BAML** — strong schema-aligned parsing, but a **DSL + codegen + native/WASM runtime** is heavy;
  first-party structured outputs make it redundant for Scout. Reject (watch the idea).
- **Valibot** — fine library; not worth migrating off Zod 4 (Scout's whole validation layer + MCP
  Standard-Schema rely on Zod). Reject unless Edge cold-start forces a smaller validator.
- **DBOS Transact (TS)** — conceptually aligned (durable Postgres workflows) but needs a **long-lived
  Node process** + recovery loop; contradicts the per-invocation Deno-Edge + $0 model. Watch as a
  design reference; don't adopt.
- **graphile-worker** — Postgres job queue but requires a **persistent worker**; wrong shape for
  serverless. Reject.
- **pgmq / Supabase Queues as a core-loop replacement** — light and $0, but **not strictly better**
  than the existing self-chain + heartbeat for the linear pipeline (still needs a cron/`pg_net`
  consumer). Watch for *fan-out* only. (Also: Free-plan dashboard availability unverified.)
- **puppeteer / @sparticuz/chromium for PDF** — heavy cold start on Vercel Hobby; `@react-pdf/renderer`
  or print-CSS get there at lower cost. Reject for this deployment.
- **ajv** (JSON-Schema validation between nodes) — Zod already validates TS-side; adding ajv
  duplicates it. Reject.
- **tokenlens / llm-cost** pricing libs — the hardcoded `cost.ts` table is correct and dep-free.
  Reject.
- **OpenLLMetry-js** — not rejected, just **watch**: more setup than Helicone/Langfuse and only
  403★; pick it only if you specifically want vendor-neutral OTel export.
- **Upstash for tracing** — Upstash is recommended *only* as an optional rate-limit store (§4), not
  for observability.

---

## 10. Open questions & suggested sequencing

**Decisions to make before implementation:**
1. **Structured outputs in the Edge runtime** — hand-roll `output_config` + a schema-strip helper
   (keeps the small bundle) **vs** pull `@anthropic-ai/sdk` into Deno (cold-start cost)?
   *Recommended: hand-roll for Edge; use `messages.parse()`/`zodOutputFormat` on the SDK-based local
   graph + MCP paths.*
2. **Tracing vendor** — Helicone (least effort, proxy hop) vs Langfuse (richer, SDK instrumentation)
   vs none (DB telemetry already answers cost)? *Recommended: skip for the demo; add Helicone
   async-logging if a dashboard is wanted.*
3. **Rate-limit store** — Postgres (rate-limiter-flexible, $0, no new vendor) vs Upstash (edge
   latency, 2nd free tier)? *Recommended: Postgres.*
4. **Checkpoint slimming** touches the durable runtime — must be sequenced behind the P9
   lease/recovery tests (`supabase/tests/p9_lease_tests.sql`).

**Suggested sequencing (each independently shippable):**
1. **LZ4 compression migration** (§2.2) — one line per column, instant $0 storage win, ~zero risk.
2. **Structured outputs on the SDK paths** (§6.1) — removes parse-fail retries + saves tokens; lowest
   risk, immediate quality/token win.
3. **Zod → JSON Schema single source** (§6.2) → **migrate MCP to `McpServer`/`registerTool`** (§7).
4. **Checkpoint slimming + report de-dup** (§2.1) — biggest storage win; do with the P9 tests green.
5. **react-markdown + @react-pdf/renderer** (§8) — fixes the broken playbook render + closes P13 export.
6. **Backoff+jitter / circuit breaker** (§3, cockatiel) + **rate limiting** (§4).
7. **promptfoo into `evals.yml`** (§5) + **jsonrepair** safety net (§6.3) + optional **Helicone** (§5).
8. **SSRF hardening (ipaddr.js) + constant-time/nonce review** (§4) — defense-in-depth.

Items 1–3 are the high-ROI cluster: a storage win, a token+reliability win, and a
schema-deduplication win — all $0, all low-to-medium effort, none requiring new infra.

---

## 11. Source log (URLs fetched/searched on 2026-06-12)

**Anthropic structured outputs (area E/F)**
- Claude API skill (`claude-api`) — structured outputs (`output_config.format`, strict tool use)
  confirmed on `claude-opus-4-8` + `claude-haiku-4-5`; JSON-Schema subset limitations; `messages.parse()`
  + `zodOutputFormat`. Live doc: https://platform.claude.com/docs/en/build-with-claude/structured-outputs

**Persistence & storage (area A)**
- https://www.dbi-services.com/blog/postgresql-14-lz4-compression-for-toast/
- https://www.tigerdata.com/learn/postgresql-compression
- https://www.enterprisedb.com/blog/configurable-lz4-toast-compression
- https://supabase.com/blog/pgvector-0-7-0 · https://neon.com/blog/dont-use-vector-use-halvec-instead-and-save-50-of-your-storage-cost

**Orchestration (area B)** — GitHub API (stars/last-push/license, 2026-06-12)
- https://github.com/connor4312/cockatiel (1,789★, MIT, 2026-05-26)
- https://github.com/sindresorhus/p-retry (1,019★, MIT) · https://github.com/sindresorhus/p-queue (4,216★, MIT)
- https://github.com/dbos-inc/dbos-transact-ts (1,239★, MIT, 2026-06-11)
- https://github.com/tembo-io/pgmq (4,946★, PostgreSQL lic, 2026-05-20) · https://supabase.com/docs/guides/queues
- https://github.com/graphile/worker (2,293★, MIT)

**Security (area C)**
- https://github.com/animir/node-rate-limiter-flexible (3,555★, ISC, 2026-06-08)
- https://github.com/upstash/ratelimit-js (2,038★, MIT) · https://upstash.com/pricing (free: 500K cmd/mo, 256 MB, 10 GB egress, 1 DB, Vercel-compatible)
- https://github.com/whitequark/ipaddr.js (638★, MIT, 2026-05-08)

**Observability & evals (area D)**
- https://github.com/promptfoo/promptfoo (22,152★, MIT, 2026-06-12)
- https://github.com/mattpocock/evalite (1,590★, MIT, 2026-04-28)
- https://github.com/Helicone/helicone (5,809★, Apache-2.0) · https://www.helicone.ai/pricing (free: 10K req/mo, 1 GB, 7-day)
- https://github.com/langfuse/langfuse (28,988★, MIT core) · https://langfuse.com/pricing (Hobby: 50K units/mo, 30-day, 2 users; self-host free)
- https://github.com/traceloop/openllmetry-js (403★, Apache-2.0, 2026-06-08)

**Structured output (area E)**
- https://github.com/colinhacks/zod (42,946★, MIT) — Zod 4 native `z.toJSONSchema()`
- https://github.com/josdejong/jsonrepair (2,361★, ISC*/NOASSERTION, 2026-04-16) · npm page returned HTTP 403 (license to verify)
- https://github.com/instructor-ai/instructor-js (796★, MIT, last push 2025-01-27 — stale)
- https://github.com/boundaryml/baml (8,355★, Apache-2.0) · https://github.com/fabian-hiller/valibot (8,753★, MIT)

**MCP & agent tooling (area F)**
- https://github.com/modelcontextprotocol/typescript-sdk (12,652★, MIT v1.x / Apache-2.0 v2; v1.29.0 stable; `McpServer`/`registerTool`/Standard-Schema confirmed; v2 pre-alpha)
- https://github.com/punkpeye/fastmcp (3,190★, MIT) · https://github.com/modelcontextprotocol/inspector (10,061★, MIT)

**Report generation (area G)**
- https://github.com/remarkjs/react-markdown (15,763★, MIT, 2025-04-21)
- https://github.com/diegomura/react-pdf (16,628★, MIT, 2026-06-09)
- https://github.com/dolanmiu/docx (5,789★, MIT, 2026-06-02)
- https://github.com/benjamine/jsondiffpatch (5,319★, MIT, 2026-05-14) · https://github.com/kpdecker/jsdiff (9,161★, BSD-3-Clause, 2026-06-02)

**Unverified / flagged:** jsonrepair license (`NOASSERTION` via API; repo is ISC — confirm) ·
MCP `InMemoryTransport` export name in 1.29 (known SDK export — confirm) · Supabase Queues/pgmq
availability on the **Free** plan dashboard (pgmq is a standard enableable extension — confirm) ·
`@react-pdf/renderer` under Deno/Edge if rendered server-side (render in the Next.js layer to avoid).
A `WebSearch` session-quota limit was hit late in the session; the two affected lookups (Supabase
Queues free-plan UI, a second pgvector confirmation) are flagged above rather than asserted.
