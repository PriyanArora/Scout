# Scout — Decision Log (research findings → architectural decisions)

**Date:** 2026-06-12 · **Companion:** `.claude/INTEGRATION_PLAN.md`, `.claude/PLANNING_RECONCILIATION.md`

Every candidate from `findings.md`, `findings-expansion.md`, and `findings-deepdive.md` is recorded
below — **de-duplicated across the three passes** — with verdict, critique, and the **anticipated
downstream effect** if shipped. Verdicts: **ADOPT** (land it), **PROTOTYPE** (spike behind a flag /
optional), **DEFER** (not now; with a named revisit trigger), **REJECT** (do not pursue).
Reversible calls get a lighter bar; one-way-door calls get a heavier one. Where my call **diverges
from the findings**, it's flagged `▲`.

Tally at the bottom (§13).

---

## Track 1 — Discovery depth (`scrape_site`, `profile_business`, `identify_opportunities`)

Thesis: deepen discovery by moving work **off the model** (deterministic extraction, breadth, caching).

### Extraction libraries

| Candidate | Source | License | Verdict | Critique & downstream |
|---|---|---|---|---|
| **defuddle** | kepano/defuddle (8.0k★) | MIT | **ADOPT** | Cleaner main-content markdown than the naive `html.replace(/<[^>]+>/g," ")` Edge fallback → **fewer junk tokens to Opus** (helps the token budget, not just quality). Downstream: better `profile_business` grounding. Risk: **Node/JSDOM, Deno-Edge compat unverified** — run in Vercel/Node layer or build step, or verify `npm:` import first. Keep Jina primary. |
| **@extractus/article-extractor** | extractus (1.9k★) | MIT | **DEFER** | Viable alternate to defuddle; no reason to run two extractors. Revisit only if defuddle fails Deno compat. |
| **mozilla/readability** | mozilla (11k★) | Apache-2.0 | **DEFER** | The classic, but defuddle is newer/cleaner and is the pick. Fallback option. |
| **dom-to-semantic-markdown** | romansky (978★) | MIT | **DEFER** | Preserves tables/JSON-LD (good for pricing/spec pages) — a real differentiator *if* table fidelity becomes a gap. Trigger: profiles missing pricing tables. |
| **turndown** | mixmark-io (11k★) | MIT | **DEFER** | Generic HTML→markdown; no body isolation. defuddle already owns the slot. |
| **metascraper** | microlinkhq (2.7k★) | MIT | **PROTOTYPE** | Deterministic **firmographic metadata** (publisher, logo, schema.org address) off-model — complements defuddle (body) vs metadata. Node-only → Vercel/offline. Flag-gated; structured fields into `business_profile` at zero LLM cost. |
| **extractus/feed-extractor** | extractus (191★) | MIT | **DEFER** | RSS/Atom press signal — niche. Trigger: clients want recent-news context. |
| **Crawl4AI** | unclecode (68k★) | Apache-2.0 | **DEFER** | **Python** — can't run in the Edge node; only a hosted service (breaks $0) or offline build. Overkill for Scout's page-cap. Trigger: anti-bot crawling at scale. |
| **trafilatura** | adbar (6.1k★) | Apache-2.0 | **DEFER** | Best-in-class extraction F1, but **Python**. Remember only if a Python extraction microservice is ever stood up. |
| **apify/crawlee** | apify (24k★) | Apache-2.0 | **DEFER** | Node-native (answers the Python rejects) but a Playwright/Cheerio crawler is the **wrong shape for a 110s Edge node**. Offline/Vercel-layer only. |
| **Scrapy** | scrapy (62k★) | BSD-3 | **REJECT** | Python heavy-crawler framework; wrong runtime and wrong shape. |
| **ScrapeGraphAI** | ScrapeGraphAI (27k★) | MIT | **REJECT** | **LLM-driven extraction = more tokens** — the exact opposite of this track's thesis. Great project, wrong goal. |

### $0 source breadth (search + firmographics)

| Candidate | Source | License/terms | Verdict | Critique & downstream |
|---|---|---|---|---|
| **GLEIF + SEC EDGAR + Wikidata trio** | api.gleif.org / data.sec.gov / wikidata | CC0 / public-domain / CC0 | **PROTOTYPE** | **Keyless, $0, structured** firmographics (SIC code, jurisdiction, ticker, HQ) → one cheap Haiku summarize, not a freeform snippet that costs Opus. Better than keyed search for $0. Flag-gated (`SCOUT_ENRICH_ENABLED`), default off, **must cite**. EDGAR needs `SCOUT_EDGAR_USER_AGENT`. Only enrich when a legal name/ticker/domain resolves. |
| **Tavily** | tavily | 1k/mo free | **PROTOTYPE** | Best keyed drop-in for bounded enrich, but **1k/mo cap = non-$0 at scale**. Keep behind the keyless trio; flag it. |
| **Exa** | exa | 1k/mo free | **DEFER** | Alt to Tavily; same quota concern. |
| **OpenCorporates** | opencorporates | share-alike + attribution | **DEFER** ▲ | Findings "downgrade"; I defer. Share-alike attribution is awkward in a **paid consulting report**. Opt-in, attributed enrichment only. |
| **Common Crawl** (offline firmographics) | commoncrawl | open corpus | **DEFER** | Querying it is a big-data offline job, not a per-run call. Offline pre-build only. (CDX index returned a live 504 — unreliable even offline.) |
| **Serper** | serper | scraped Google | **REJECT** | Built on scraped Google data — ToS/legal exposure; inappropriate for a client-facing tool. |
| **Brave Search API** | brave | metered | **REJECT** | **Free tier retired ~Feb 2026** → no longer a $0 option. |
| **SearXNG** | searxng (32k★) | AGPL-3.0 | **REJECT** | **AGPL + needs its own always-on host** — breaks both $0 and the MIT/Apache preference for a deliverable. |
| **duck-duck-scrape / Marginalia** | (227★ / 1.8k★) | MIT / AGPL+key | **REJECT** | DDG HTML scraping is ToS-grey and stale; Marginalia is AGPL+key/self-host. The keyless trio is the clean $0 story. |

### Multi-page breadth & incremental crawl (techniques)

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **Deterministic multi-page breadth** (sitemap/robots + raise `maxPages`) | **ADOPT** | Deeper grounding with **zero extra LLM tokens**. `agent/src` already has `discoverHighSignalLinks` + `maxPages`; the **Edge path scrapes one page** and needs parity. Must stay **page-capped** for the wall budget. |
| **HTTP conditional requests + sitemap `lastmod`** | **ADOPT** | Stronger than content-hash dedupe (which still fetches): `If-None-Match`/`If-Modified-Since` `304` skips **fetch *and* LLM** on unchanged pages. Needs new `scrape_pages` columns (migration). Fall back to content-hash where sites omit `ETag`/`lastmod`. |
| **"compress before Opus" pass** (cheap Haiku digest of gathered pages) | **PROTOTYPE** | The deep-research *compress* pattern within Scout's budget — broadens discovery while *lowering* Opus input. Risk: one extra cheap call; gate it so it only fires when multi-page evidence is large. |

### Deep-research orchestrators (study the pattern; never run the multi-minute job)

| Candidate | License | Verdict | Critique |
|---|---|---|---|
| **dzhng/deep-research** | MIT (TS) | **PROTOTYPE** (read-only) | TS, tiny; fan-out→dedupe→compress reads 1:1 onto a node. Borrow the **bounded** loop, not the recursion. |
| **jina-ai/node-DeepResearch** | Apache-2.0 (TS) | **PROTOTYPE** (read-only) | TS **and Jina-native** (Scout already uses Jina); steal the **token-budget hard-stop ("Beast Mode")** for any future enrich loop. |
| **gpt-researcher / open_deep_research / storm / btahir / u14app / deep-searcher** | Apache-2.0 / MIT | **DEFER** (reference) | Python or redundant with the two TS picks. Pattern references only; not drop-ins. |

---

## Track 2 — Reference architectures (`solution_design` → `generate_workflow`)

Goal: classify an opportunity into a **named pattern** so the design is a lookup + light fill, not
free-form generation (lowers tokens, kills a hallucination class). **The deliverable is Scout's own
hand-curated `agent/patterns.yaml`** grounded in these vocabularies.

| Candidate | Source | License/reuse | Verdict | Critique & downstream |
|---|---|---|---|---|
| **Enterprise Integration Patterns (EIP)** | enterpriseintegrationpatterns.com / Apache Camel docs | names free; Camel docs Apache-2.0 | **ADOPT** (vocabulary) | The canonical messaging vocabulary (Content-Based Router, Aggregator, Splitter, Content Enricher…). Maps ~1:1 onto opportunity types. Camel docs are Apache-2.0 → wording may be mirrored **with attribution**. |
| **Workflow Patterns (van der Aalst)** | Wikipedia + 2003 paper | concept/vocabulary | **ADOPT** (vocabulary) | **The missing control-flow layer.** Sequence / Parallel-Split / Synchronization / Exclusive-Choice / Simple-Merge map **1:1 onto n8n graph primitives** (linear chain, multiple outgoing connections, Merge node, IF/Switch). Add a `control_flow:` field to `patterns.yaml` so `solution_design` emits a control-flow skeleton `generate_workflow` can validate node-by-node. (`workflowpatterns.com` was unreachable — cite Wikipedia + paper.) |
| **Azure Cloud Design Patterns** | learn.microsoft.com / mspnp/cloud-design-patterns | docs CC-BY-4.0; samples MIT | **DEFER** ▲ (names folded in) | On-brand MS names (Publisher-Subscriber, Claim-Check, Scheduler-Agent-Supervisor). Findings say adopt/prototype; I **fold the relevant names into `patterns.yaml`** and defer deeper adoption — a separate Azure pattern set would duplicate EIP coverage. Cite docs (CC-BY-4.0). |
| **microservices.io patterns (Richardson)** | microservices.io | **names usable; text © all-rights-reserved** | **DEFER** (names only) ▲ | Saga / CQRS / Transactional Outbox / Strangler / Anti-corruption fit "system integration / data sync" opportunities. **Hard line: do NOT mirror its prose.** Add a `integration_pattern:` field using **names only** when a data-sync opportunity appears. |
| **stn1slv/awesome-integration** | CC0-1.0 | **ADOPT** (research index) | Public-domain curated index of EIP/iPaaS resources — clean input for authoring `patterns.yaml`. Not shipped. |
| **AWS ServerlessLand patterns** | aws-samples/serverless-patterns | MIT-0 | **DEFER** | Deployable event-driven blueprints, but **AWS-centric** — off-brand vs NorthBound's Microsoft/n8n stack. |
| **mehdihadeli/awesome-software-architecture** | CC0 | **DEFER** (reference) | Broad index; research breadth only. |
| **binhnguyennus/awesome-scalability** | MIT | **DEFER** (reference) | Real eng-blog architectures, but **skews hyperscale** vs Scout's SMB automations. |
| **DovAmir/awesome-design-patterns** | no license | **DEFER** (reference) | Broad index, **stale (2024-10)**. Reference only; never redistribute. |
| **donnemartin/system-design-primer** | LICENSE reads CC-BY-4.0 (historically NC-ND) | **REJECT** | Hyperscale system design, **not SMB-automation**; license needs verifying before reusing diagrams. EIP + Workflow Patterns are the right vocabulary. |
| **Sairyss/domain-driven-hexagon** | MIT | **REJECT** | DDD/hexagonal **app-internal** structure, **stale (2024-06)**; not SMB-automation shaped. |

**Deliverable shape (illustrative — implementer authors the real file):**

```yaml
# agent/patterns.yaml — Scout-authored, grounded in EIP / Workflow Patterns / (names) microservices.io
- id: intake-triage
  name: Intake & Triage                       # EIP: Content-Based Router + Message Filter
  opportunity_types: [lead routing, support triage, form intake]
  pillars: [Customer Experience & Marketing, Operations & Efficiency]
  control_flow: exclusive-choice               # Workflow Patterns -> n8n IF/Switch
  data_flow: trigger -> classify -> route -> notify
  n8n_archetype: form-to-crm | inbound-email-triage
  catalog_tools: [power-automate, dynamics-365, hubspot, microsoft-teams, n8n]
```

> Note: pillar strings in `patterns.yaml` must match the **canonical catalog** spelling
> (`Cybersecurity & Risk Management`), which currently **differs** from the Zod enum
> (`Cybersecurity & Risk`). See reconciliation follow-up F-7.

---

## Track 3 — n8n templates & tooling (`generate_workflow`)

Today: 5 pinned archetypes + placeholder-fill; **P8 import smoke test still open**. The Edge node
doesn't even merge/validate. Two leverage points: real template **corpus** and a node-schema
**validator**.

| Candidate | Source | License | Verdict | Critique & downstream |
|---|---|---|---|---|
| **czlonkowski/n8n-mcp** | czlonkowski (22k★) | MIT | **ADOPT** | The highest-leverage Track-3 item: **1,851 node schemas + workflow validator + auto-fix + 2,352-template search**. Adopt as a **build-time / CI validator** (hermetic, $0, no runtime dep) — **closes the open P8 import smoke test**. Optionally export node schemas to ground selection. **Not** a runtime dependency of a 110s leased node. |
| **Official n8n template API** (10,072) | api.n8n.io | n8n SUL | **ADOPT** (offline build) | Source of truth for a local index. **Offline build step**, then runtime lookup — runtime must **not** depend on `api.n8n.io`. Filter to the catalog-mappable subset; bundle only the dozen actually shipped. |
| **Zie619/n8n-workflows** | Zie619 (55k★) | MIT (tooling) | **ADOPT** (offline corpus) | Bundle/index offline so the demo is hermetic. MIT covers *tooling*, not every author's workflow → **index metadata, ship only the handful you fill**, attribute. |
| **n8n `collections` API** | api.n8n.io/.../collections | n8n SUL | **PROTOTYPE** | Human-curated groupings (higher signal than flat `/search`). Use to seed the canonical AI/automation set. |
| **restyler/awesome-n8n** | restyler (2.9k★) | no license | **PROTOTYPE** (metadata) | Index of 5,834 community **nodes** ranked by npm downloads → a **catalog-tool→n8n-node feasibility map**. Reinforces the key finding below. Metadata use only. |
| **enescingoz/awesome-n8n-templates** | (23k★) | NOASSERTION | **DEFER** (reference) | License-unclear → reference index only; do not redistribute. |
| **Danitilahun / wassupjay / oxbshw libraries** | (685★ / 5.9k★ / 541★) | none / none / MIT | **DEFER** (reference) | Extra corpora; license-unclear except oxbshw (MIT, small). Reference only unless a specific gap appears. |

**Key architectural finding to honor (deepdive §4.3):** n8n template coverage is **deep for SaaS**
(Slack 1478, Notion 341, Outlook 100) and **~1 each for Power Platform** (Power Automate/Power BI/
Dynamics — n8n has no dedicated nodes). Downstream consequence: **n8n is the delivery substrate Scout
*generates*; Power Platform/Dynamics stay *recommendations in the report*, not n8n artifacts.** Filter
the template index to the SaaS-mappable subset and don't expect importable JSON for MS-native picks.

**Licensing line (n8n SUL):** fine for NorthBound — self-host n8n and hand clients workflows *to
run*. The line not to cross: don't turn "Scout + hosted n8n" into a paid SaaS where n8n is the core
value.

---

## Track 4 — Cost / compute / latency (whole pipeline)

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **Shared cached system prefix** (Anthropic prompt caching) | **ADOPT** | The biggest, cheapest win — but **not yet implemented** (no `cache_control` anywhere in the Edge function today; `map_tools` sends the catalog as plain system). Real work: refactor all 9 LLM call sites to share an identical cacheable prefix + `cache_control`, append node-specific instructions after. Self-chained nodes are seconds apart → one cache-write amortizes over ~8–12 reads at 0.10×. **Gotchas:** sub-minimum prefix caches nothing; Opus/Haiku caches are separate; default TTL is now 5m. Measure via existing `cache_read/creation` columns (red line: *don't assume savings without telemetry*). |
| **Native `Supabase.ai` gte-small + pgvector** | **ADOPT** (capability, for Track-3 retrieval) ▲ | $0, on-device, ~100–200ms, in the 2s CPU budget. **Adopt the embedding capability primarily to power Track-3 template retrieval.** ▲ Findings push the broader semantic cache; I split it (next two rows). |
| → semantic cache for **n8n template retrieval** | **PROTOTYPE** | "Find the closest real workflow" — clean fit, low risk, $0. |
| → semantic cache for **business-profile / tool-mapping reuse** | **DEFER** ▲ | **Correctness risk:** serving a cached profile for a *similar* site can return wrong analysis for a different client — a deliverable-correctness problem in a paid report. Plus low demo ROI (repeats are rare in an interview). Keep the **exact content-hash** scrape cache (already live, safe); defer the embedding-similarity profile/mapping cache until there's a measured repeat-run need. |
| **Anthropic Message Batches API (50% off)** | **ADOPT** (evals/triage only) | Incompatible with interactive latency, **ideal for the two non-interactive paths**: nightly LLM-judge evals + inbound n8n triage. Pair with caching there. |
| **Anthropic `count_tokens` pre-flight** | **ADOPT** | Free utility endpoint; enforce the 30–60K budget **before** a node fires — trims the 60K scrape blob, avoids `413` and `max_tokens` truncation-retries (each truncation = a full re-issued call today). Put it in front of the three Opus nodes. Subject to ordinary rate limits — confirm headroom. |
| **RAG-trim over the 43-tool catalog** | **REJECT** | At 43 tools the catalog is tiny and, once cached, costs 0.10× to send whole. RAG-trimming risks **dropping the correct tool** → undermines the strict-enum grounding (red line). Cache the whole catalog instead. Revisit only if the catalog grows into the hundreds. |
| **Model routing** (Haiku 5–10, Opus 2/3/11) | **ADOPT** (already done; keep) | Sanity-check whether requirements/n8n-fill/questions even need Haiku vs a templated/no-LLM path. |
| **Streaming on long Opus nodes / cold-start bundle tuning** | **DEFER** | Minor TTFT lever; Realtime already streams node progress. Note and move on. |
| **GPTCache** | **REJECT** | **Python + ~11mo stale**; pgvector + `Supabase.ai` give the same natively. Learn the idea, don't adopt. |
| **Transformers.js** | **DEFER** | ONNX-in-Deno alt to gte-small; native path is simpler/lighter. Fallback only if a non-gte-small model is needed. |
| **gpt-tokenizer / tiktoken** | **REJECT** | **Wrong tokenizer for Claude** (under-counts 15–20%). Use `count_tokens`. |
| **upstash/semantic-cache** | **REJECT** | Adds a **2nd free-tier vendor** (Upstash Vector) and is stale; native pgvector is strictly better at $0. |
| **LLMLingua-2** (prompt compression) | **REJECT** | ~20× compression but **Python + a model** → separate service/offline. The cheap-Haiku compress does the same in-runtime at $0. |
| **Vercel AI SDK** (as a dependency) | **REJECT** ▲ | The `wrapLanguageModel` cache/guardrail **pattern** is nice, but the SDK conflicts with the deliberate **small-bundle raw-`fetch` Edge path**, and caching is already native on pgvector. **Steal the thin-wrapper pattern, not the dependency.** |

---

## Area A — Persistence & storage (Supabase Free 500 MB)

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **Checkpoint slimming (claim-check) + report de-dup** | **ADOPT** (sequence last) | **Fixes an existing red-line violation:** the Edge `saveCheckpoint` stores the full 60K `scrapeMarkdown` in **every** checkpoint (~10–12×/run) — the SPEC red line forbids exactly this, and ProjectSummary claims checkpoints hold page IDs. Store `scrapePageIds`, rehydrate from `scrape_pages` on resume. De-dup `reports.opportunities` vs `reports.ranked`. **One-way door** (durable-state contract) → ship only behind green P9 tests + a mid-pipeline resume test. Biggest single storage win. |
| **Postgres LZ4 TOAST compression** | **ADOPT** | `SET COMPRESSION lz4` on `scrape_pages.markdown`, big `reports.*` jsonb, `langgraph_checkpoints.checkpoint`. ~30–40% smaller, faster de/compress, **$0, near-zero risk** (future writes; backfill for immediate effect). Correct DDL is `SET COMPRESSION`, not `SET STORAGE`. |
| **Smarter TTL / pruning** | **ADOPT** | Drop terminal-run checkpoints at finalize (dead weight once `completed`/`failed`); shorten `scrape_pages` TTL (30d→7–14d for a demo). All $0 in `prune_scout_data()`. |
| **pgvector `halfvec`** (float16 vectors) | **DEFER** | Halves vector storage — **only relevant once the gte-small semantic cache exists** (Track 4). Forward-looking storage note, not a standalone adopt. |
| **Covering index on `run_steps`** | **DEFER** | `INCLUDE (cost_usd, …)` for the RUNBOOK cost query — opportunistic; only if that query shows up hot. |

---

## Area B — Orchestration reliability & idempotency

Honest baseline: Scout's durability (atomic lease, stale-write guard via `node_execution_id`,
idempotent merge-duplicates, `pg_cron` heartbeat) is **already strong and well-matched**. Most
"durable execution" tooling would be a lateral move or break the serverless/$0 model.

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **Exponential backoff + jitter** (in `fail_run_node` SQL) | **ADOPT** | `fail_run_node` sets a flat `now()+30s` for every retry; with the 1-min heartbeat this can thunder on a transient `429/529`. Make `lease_until` a function of `attempts` (`30·2^attempts` ± jitter) — trivial in SQL, **no dependency, strictly better at $0**. |
| **cockatiel** (circuit breaker + retry) | **PROTOTYPE** | Circuit-break Jina/Anthropic inside the 110s budget; fail fast. Pure TS — **verify under Deno `npm:`** before Edge use. Medium value. |
| **p-retry** | **DEFER** | Minimal retry if cockatiel's breaker isn't wanted. cockatiel is the pick. |
| **pgmq / Supabase Queues** | **DEFER** | Light, $0, would shine for **fan-out** (parallel multi-page scrape, inbound triage) — but **not strictly better** than the existing self-chain for the linear pipeline (still needs a cron/`pg_net` consumer). Don't swap a working loop without a fan-out reason. (Free-plan dashboard availability unverified.) |
| **DBOS Transact (TS)** | **REJECT** (study only) | Durable Postgres workflows, but **needs a long-lived Node process** + recovery loop — contradicts per-invocation Edge + $0. Study its step-idempotency design; don't adopt. |
| **graphile-worker** | **REJECT** | Postgres job queue requiring a **persistent worker** — wrong shape for serverless. |

---

## Area C — Security hardening

Baseline is good (HMAC `v0:ts:body` 5-min window, 32-byte hash-only share tokens with expiry+revoke,
RLS, SSRF at redirect hops). Gaps:

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **ipaddr.js SSRF range classification** | **ADOPT** (web path) | Edge `isSafeUrl` is a **hostname regex** that misses decimal/octal/hex IPs, IPv4-mapped IPv6, `0.0.0.0/8`. Replace the web-path check with `ipaddr.js` `.range()`. **Document the Edge residual:** Edge `fetch` can't pin the resolved IP → DNS-rebinding can't be fully closed there. |
| **Zod `.strict()` on webhook payload** | **ADOPT** | `data: z.record(...)` is permissive; `.strict()` rejects unexpected top-level keys (defense-in-depth). Effort S. |
| **rate-limiter-flexible (Postgres store)** | **PROTOTYPE** | Closes the **unimplemented P10 "rate-limit caller"** on `/api/webhook/scout` + `/api/discover`. **$0, no new vendor** (uses Supabase Postgres). |
| **`seen_signatures` replay/nonce table** | **PROTOTYPE** | Belt-and-suspenders over the 5-min window (the content-based idempotency key already collapses replays to the same run). Short-TTL `(jti, expires_at)`. |
| **Constant-time compare hardening** | **DEFER** | Low severity (hex is fixed-length); prefer the platform `crypto.timingSafeEqual` or double-HMAC when touched. Not urgent. |
| **@upstash/ratelimit** | **DEFER** | Edge-latency limiting but **2nd free-tier vendor**. Use rate-limiter-flexible (in-stack) unless edge latency is measured to matter. |

---

## Area D — Observability & evals

Foundation exists: `run_steps` records per-node tokens + `cost_usd`; `cost.ts` has correct hardcoded
pricing. Gaps: empty `evals.yml`, optional tracing.

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **promptfoo into `evals.yml`** | **ADOPT** | Declarative YAML + deterministic & model-graded asserts in GH Actions at **$0**. Gate regressions on PRs: citations map to source text, tool ids ∈ catalog, no hallucinated tools, n8n importability. Pair model-graded judge with the **Batch API** (Track 4) to halve cost. |
| **evalite** | **PROTOTYPE** | Vitest-native TS evals alongside promptfoo (Scout already uses Vitest + `deterministic-evals.test.ts`). |
| **Helicone** | **PROTOTYPE** | Lowest-effort tracing ($0, URL swap, works with raw `fetch`). **Proxy hop in the request path** — use async-logging or self-host to avoid latency. **Optional for the demo** (DB telemetry already answers cost). |
| **Langfuse** | **PROTOTYPE** (alt) | Richer (datasets, eval scores) but needs **per-node SDK instrumentation**. Pick over Helicone only if datasets are wanted. |
| **OpenLLMetry-js** | **DEFER** | More setup, small project; only for vendor-neutral OTel export. |
| **tokenlens / llm-cost** pricing libs | **REJECT** | `cost.ts` is correct and dep-free. A pricing npm adds a dependency for no gain. |

---

## Area E — Structured output & validation

**The highest-value area in the expansion findings.** Nodes today prompt for JSON + regex
`extractJson` + one bounded retry.

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **Anthropic Structured Outputs** (`output_config.format` + strict tool use) | **ADOPT** | Supported on **`claude-opus-4-8` + `claude-haiku-4-5`** (Scout's exact models). Output **schema-valid by construction** → removes the parse-failure branch + its retry (**also saves tokens**) and a format-drift class. $0, no new dep. **Caveats:** JSON-Schema **subset** (no `min/max/format/url`, `additionalProperties:false` required) → strip from the wire schema, full-Zod validate client-side. Edge = hand-roll `output_config` + strip helper (keep small bundle); SDK paths = `messages.parse()`+`zodOutputFormat`. `map_tools` is the natural strict-tool-use fit. |
| **Zod 4 `z.toJSONSchema()` — one schema, three consumers** | **ADOPT** | Make `agent/src/schemas/index.ts` the single source → derive Anthropic `output_config`, MCP `inputSchema`, and the duplicated `CATALOG_IDS`. Removes ~100 lines of hand-written JSON Schema and 4-way catalog drift. No new dep (Zod already present). |
| **jsonrepair** | **ADOPT** | Repairs truncated/malformed JSON (`max_tokens` cutoffs) before `JSON.parse` — the safety net even with structured outputs. Drop into `parser.ts` between `extractJson` and `JSON.parse`, and the Edge `extractJson`. ISC license — **verify (API reports NOASSERTION)**. |
| **instructor-js** | **REJECT** | Structured extraction over Zod, but **~17mo stale** and **made redundant** by structured outputs + `zodOutputFormat`. |
| **BAML** | **REJECT** | Excellent parser but adds a **DSL + codegen + native/WASM runtime** — overkill once first-party structured outputs exist. |
| **Valibot** | **REJECT** | Lighter than Zod, but Scout is deeply invested in Zod 4 + MCP Standard-Schema; migration churn isn't worth it. Revisit only if Edge cold-start is a *measured* problem. |
| **ajv** | **REJECT** | Zod already validates TS-side; ajv duplicates it. |

---

## Area F — MCP & agent tooling

`mcp/src/index.ts` uses the low-level `Server` + `setRequestHandler` + hand-written JSON Schema for 5
tools.

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **`McpServer` + `registerTool`** (same SDK `^1.29.0`) | **ADOPT** | High-level API takes **Standard Schema (Zod v4)**; auto-validates inputs; `outputSchema → structuredContent`. Replaces 5 hand-written `inputSchema` blocks + the manual `switch`. **No new runtime dep.** Pair with Zod single-source (Area E). Stay on SDK **1.x** (v2 is pre-alpha). |
| **MCP Inspector** | **ADOPT** (dev-time) | Official interactive harness to list/call tools against the stdio server — the protocol-level test Scout lacks. |
| **InMemoryTransport** (in SDK) | **ADOPT** (test) | `McpServer` + in-memory client in Vitest → `list_tools`/`call_tool` round-trips with no spawned process. Verify export name in 1.29. |
| **FastMCP** | **DEFER** | Only if Scout adds HTTP transport / auth / sessions; the official `McpServer` is enough for 5 stdio tools. |

---

## Area G — Report generation, export & viewing

Per findings, the viewer renders the markdown playbook in raw `<pre>` and dumps requirements/design
as `JSON.stringify` — not a client-ready deliverable. (**Confirm in `report-viewer.tsx` during
implementation.**)

| Candidate | Verdict | Critique & downstream |
|---|---|---|
| **react-markdown (+ remark-gfm)** | **ADOPT** | Necessary — the playbook is generated as markdown but shown in `<pre>`. Render it properly + structure requirements/design. Effort S. |
| **@react-pdf/renderer** | **ADOPT** | **$0 PDF export, no headless browser** (avoids `@sparticuz/chromium` cold-start on Hobby) — closes deferred **P13 export** and uses the unused `export_path` column. Render in the Next.js/Vercel layer. |
| **jsondiffpatch** | **PROTOTYPE** | "What changed since last run" on `reports.version` (unique `(run_id, version)` already exists) — real value for re-engagements. |
| **jsdiff** | **DEFER** | Text-level playbook diff; jsondiffpatch covers the structured JSON. Add only if prose-diff is wanted. |
| **docx** | **PROTOTYPE** (after PDF) | Editable Word deliverable — only if clients ask. |
| **CSS `@media print`** | **ADOPT** (baseline) | The $0 floor — a print stylesheet → browser "Save as PDF" before/without the PDF lib. |
| **Next.js ISR / Vercel data cache on `/share/[token]`** | **PROTOTYPE** | Public report pages are read-mostly → serve from cache, cut DB hits + TTFB, $0 on Hobby. **Must be tag-revalidated keyed to report id and purged on edit + share-revoke** — else a stale/revoked report is served (security regression). |
| **puppeteer / @sparticuz/chromium** (PDF) | **REJECT** | Heavy cold start on Vercel Hobby; react-pdf / print-CSS get there cheaper. |
| **marp / reveal (slides)** | **REJECT** | Scope creep. |

---

## 13. Tally

| Verdict | Count | Notable items |
|---|---:|---|
| **ADOPT** | 24 | prompt caching · structured outputs · count_tokens · Batch API (evals/triage) · defuddle · multi-page breadth · conditional requests · `patterns.yaml` (EIP + Workflow Patterns) · n8n-mcp (CI validator) · offline n8n index (official API + Zie619) · LZ4 · checkpoint slimming · TTL pruning · Zod single-source · McpServer (+Inspector/InMemoryTransport) · react-markdown · react-pdf · promptfoo · jsonrepair · SQL backoff+jitter · `.strict()` webhook · ipaddr.js · gte-small (for Track-3 retrieval) · awesome-integration (authoring) · print-CSS baseline |
| **PROTOTYPE** | ~14 | template-retrieval semantic cache · cockatiel · rate-limiter-flexible · Helicone/Langfuse · jsondiffpatch · keyless firmographic trio · Tavily · metascraper · `/share` ISR · n8n collections + awesome-n8n · evalite · seen_signatures nonce · deep-research patterns (dzhng/jina) · docx · compress-pass |
| **DEFER** | ~22 | profile/mapping semantic cache ▲ · halfvec · OpenCorporates · Common Crawl · Azure/microservices.io beyond names · article-extractor/readability/turndown/dom-to-semantic-markdown · feed-extractor · Crawl4AI/trafilatura/crawlee · AWS ServerlessLand · pgmq · FastMCP · @upstash/ratelimit · constant-time hardening · covering index · streaming · reference indices (awesome-* / template libs) · Python deep-research refs |
| **REJECT** | ~22 | ScrapeGraphAI · Scrapy · SearXNG · Serper · Brave · duck-duck-scrape/Marginalia · GPTCache · RAG-trim catalog · system-design-primer · domain-driven-hexagon · LLMLingua-2 · gpt-tokenizer/tiktoken · upstash/semantic-cache · Common-Crawl-CDX-at-runtime · Vercel AI SDK (as dep) · instructor-js · BAML · Valibot · ajv · tokenlens · DBOS · graphile-worker · puppeteer-PDF · slides |

> Counts are approximate at the margins because a few items appear under multiple framings across the
> three passes (e.g., gte-small as "capability ADOPT" + "profile cache DEFER" + "template cache
> PROTOTYPE"); each distinct framing is recorded once above. Nothing from the findings is silently
> dropped — see `.claude/PLANNING_RECONCILIATION.md` for the line-by-line confirmation.
