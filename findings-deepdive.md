# Scout Research Findings — Deep Dive (Different Tools) — 2026-06-12

> Research-only deliverable. No project code was changed; the only file created is this one.
> Every GitHub metric (stars, last-push date, license) was pulled from the **live GitHub API
> on 2026-06-12** via authenticated `gh api`. Free-tier/API behaviours were exercised **live**
> where possible (GLEIF, SEC EDGAR, Wikidata, the n8n template API were all hit directly and
> their responses are quoted). Anthropic facts come from the in-repo `claude-api` skill docs
> fetched the same day. Where I could **not** verify something live, I say so explicitly.
> Star counts and dates drift — treat them as "as of 2026-06-12."
>
> **This is the third research pass. Its only job is *new, different* options.** Everything
> already recommended in `findings.md` and `findings-expansion.md` is deliberately excluded
> (full list in §0). Where a new candidate is adjacent to a prior pick, I state precisely how
> it differs and why it might be the better choice.

---

## 0. Current-state recap + list of what's already in prior findings (excluded here)

**Runtime (re-confirmed from the repo).** Scout is a durable AI agent on $0 infra: Next.js 15 on
**Vercel Hobby** fronts a **Supabase Edge Function (Deno/TS)** that self-chains one graph node per
invocation (`WALL_BUDGET_MS = 100_000`, `LEASE_SECONDS = 120`), checkpointing `ScoutGraphState`
to Postgres, with a `pg_cron` 1-min heartbeat reclaiming dropped leases. 12 nodes:
`scrape_site → profile_business → identify_opportunities → score_and_rank → map_tools →
draft_requirements → solution_design → generate_workflow → discovery_questions → write_playbook →
critique → finalize`. Opus 4.8 on nodes 2/3/11, Haiku 4.5 on 5–10, no LLM on 1/4/12. Scrape =
Jina Reader → SSRF-checked fetch + custom HTML-to-text → optional Firecrawl, `maxPages=1`. Tool
mapping is constrained to a **43-tool `catalog.yaml`** (Microsoft 365 / Copilot / Power Platform /
Dataverse / Fabric / Snowflake / n8n + key SaaS) as an in-context prefix. n8n generation =
archetype-select + placeholder-fill + structural validate over **5 pinned templates**; **the live
n8n import smoke test (P8) is still an open TODO.** Supabase Free = 500 MB DB / 500K Edge
invocations/mo.

**Constraints filtered on every candidate below:** $0/mo infra; ~30–60K tokens/run (anything that
*adds* net model load is a regression); ~110s/node wall; Deno (Edge) + Node (Vercel) TS runtime
(Python tools must justify a separate service or an offline build step); MIT/Apache/BSD preferred;
recent + maintained.

**Already recommended in prior findings — DO NOT re-recommend (excluded from this pass):**

| Track | Excluded (prior findings) |
|---|---|
| **1 — Discovery** | defuddle, @extractus/article-extractor, mozilla/readability, Crawl4AI, trafilatura, Scrapy, ScrapeGraphAI, dzhng/deep-research, gpt-researcher, langchain-ai/open_deep_research, stanford-oval/storm, SearXNG, Tavily, Exa, Serper, Brave Search API, OpenCorporates, Common Crawl (as offline firmographic build), Jina Reader, Firecrawl, sitemap multi-page breadth |
| **2 — Reference arch** | Enterprise Integration Patterns / Apache Camel, Azure Cloud Design Patterns / mspnp/cloud-design-patterns, stn1slv/awesome-integration, mehdihadeli/awesome-software-architecture, binhnguyennus/awesome-scalability, donnemartin/system-design-primer, the proposed `patterns.yaml` |
| **3 — n8n templates** | Official n8n template **search** API (`api.n8n.io/.../search`), Zie619/n8n-workflows, enescingoz/awesome-n8n-templates, Danitilahun/n8n-workflow-templates |
| **4 — Cost/compute** | Anthropic prompt caching (shared prefix, 1h TTL), native `Supabase.ai` gte-small + pgvector semantic cache, Anthropic Batch API, model routing, content-hash scrape dedupe, GPTCache (reject), RAG-trim-catalog (reject), Transformers.js, pgvector `halfvec`, Postgres LZ4, checkpoint claim-check slimming, Anthropic structured outputs, jsonrepair, Zod `toJSONSchema`, promptfoo/Helicone/Langfuse, cockatiel/p-retry, rate-limiter-flexible, react-markdown/@react-pdf, tokenlens (reject) |

**The single most important new realization this pass:** the highest-leverage *different* tool is
**`czlonkowski/n8n-mcp`** (21,704★, MIT, active) — it gives `generate_workflow` real **n8n node
schemas + a workflow validator + a 2,352-template search**, which is exactly the grounding the
current "fill 5 hand-rolled archetypes" path lacks and the thing that finally lets you close the
still-open **P8 import smoke test**. Prior Track 3 only sourced *raw template JSON*; this adds the
*validation and node-grounding layer* on top of it.

---

## 1. Top NEW recommendations (ranked across the four tracks)

Ranked by leverage-per-unit-effort under Scout's hard constraints. None of these appear in prior findings.

| # | New recommendation | Link | Track | How it DIFFERS from the prior pick | Impact (axis) | Effort | License | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | **`czlonkowski/n8n-mcp`** — node schemas + workflow validator + template search | [github.com/czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp) | 3 | Prior Track 3 sourced raw template JSON only; this adds **node-property schemas (1,851 nodes), connection/expression validation, and auto-fix** — grounds generation and **closes the P8 import smoke test** | High — fewer invalid workflows, real validation, less hallucinated `typeVersion`/node drift | M | MIT | **adopt** |
| 2 | **Anthropic `count_tokens` pre-flight budgeting** | [token-counting docs](https://platform.claude.com/docs/en/build-with-claude/token-counting) | 4 | Prior cost work is the **post-hoc** `cost.ts` table; this is a **free pre-flight** check that enforces the 30–60K budget *before* a node fires (trim/guard, avoid 413 + truncation retries) | Med-High — prevents over-budget runs and `max_tokens` truncation retries; $0 (free utility endpoint, no generation tokens) | S | first-party | **adopt** |
| 3 | **Keyless firmographic trio: GLEIF + SEC EDGAR + Wikidata** | [api.gleif.org](https://www.gleif.org/en/lei-data/gleif-api) · [data.sec.gov](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) · [wikidata.org](https://www.wikidata.org/w/api.php) | 1 | Prior breadth was **keyed/quota'd** (Tavily/Exa 1k/mo) or **share-alike** (OpenCorporates). These are **keyless, $0, structured** firmographics — verified live this session | Med — deeper grounding, bounded tokens (deterministic JSON → 1 cheap summarize) | S/M | open data (see notes) | **prototype** (flag-gated) |
| 4 | **HTTP conditional requests + sitemap `lastmod` incremental crawl** | (technique; RFC 9110 conditional requests) | 4/1 | Prior content-hash dedupe avoids re-charging the **model** but still **fetches**; conditional `If-Modified-Since`/`ETag` + `lastmod` skip the **fetch *and* the model** on unchanged pages | Med — on re-runs, near-zero scrape + zero LLM for unchanged sites; $0, deterministic | S | n/a | **adopt** |
| 5 | **Workflow Patterns (van der Aalst control-flow vocabulary)** | [Workflow patterns (Wikipedia)](https://en.wikipedia.org/wiki/Workflow_patterns) | 2 | Prior Track 2 = **messaging** (EIP) and **cloud** (Azure) patterns; this is **workflow control-flow** (Sequence / Parallel-Split / Synchronization / Exclusive-Choice / Simple-Merge) that maps **1:1 onto n8n graph structure** — the missing bridge from `solution_design` to `generate_workflow` | Med-High — gives the n8n archetype a deterministic control-flow skeleton | M | concept/vocabulary (free) | **adopt** |
| 6 | **`microlinkhq/metascraper`** — deterministic firmographic/metadata extractor | [github.com/microlinkhq/metascraper](https://github.com/microlinkhq/metascraper) | 1 | Prior extractor (defuddle) pulls **main body content**; metascraper deterministically pulls **firmographic metadata** (publisher, logo, author, date, schema.org **address**) off-model | Med — structured profile fields with **zero** LLM tokens | S | MIT | **prototype** |
| 7 | **n8n `collections` API + `restyler/awesome-n8n` node index** | [api.n8n.io/api/templates/collections](https://api.n8n.io/api/templates/collections) · [github.com/restyler/awesome-n8n](https://github.com/restyler/awesome-n8n) | 3 | Prior used the flat `/search` endpoint; **collections** are human-curated groupings (higher signal), and **awesome-n8n** maps *which catalog tools even have an n8n node* (5,834 community nodes ranked by npm downloads) | Med — better template recall + a catalog→node feasibility map | S/M | n8n SUL / index (no license — metadata use) | **prototype** |
| 8 | **Next.js ISR / Vercel data cache on `/share/[token]`** | [Next.js caching](https://nextjs.org/docs/app/building-your-application/caching) | 4 | Prior cost work is all **model-side**; this is **frontend caching** — public report pages render once and serve from cache, cutting Edge/DB hits and TTFB | Med — fewer DB reads + faster public reports; $0 on Hobby | S/M | n/a | **prototype** |
| 9 | **`jina-ai/node-DeepResearch`** — TS deep-research pattern | [github.com/jina-ai/node-DeepResearch](https://github.com/jina-ai/node-DeepResearch) | 1 | Prior pattern ref was `dzhng/deep-research`; this is **also TS** but **token-budget-bounded ("Beast Mode" hard stop) and Jina-Reader-native** — Scout already uses Jina, so the loop reads 1:1 | Med — bounded fan-out→dedupe→synthesize without multi-minute recursion | S (read only) | Apache-2.0 | **prototype (pattern)** |
| 10 | **`microservices.io` pattern catalog (Richardson)** | [microservices.io/patterns](https://microservices.io/patterns/index.html) | 2 | Different vocabulary from EIP/Azure: **Saga, CQRS, Transactional Outbox, API Composition, Strangler, Anti-corruption layer** — for data-sync / integration opportunity types | Med — better coverage of "system integration / data sync" opportunities | M | **names usable; text © "all rights reserved"** | **prototype** (names only) |

**Deliberate non-adoptions (full reasons §6):** Crawlee (Node-native but too heavy for a 110s Edge
node; offline/Vercel-layer only), turndown (defuddle already covers extraction), LLMLingua-2
(Python + a model — the prior cheap-Haiku compress is the $0 in-runtime path), DuckDuckGo
scraping / Marginalia (ToS-grey / AGPL+key — the keyless trio in #3 is cleaner), Common Crawl CDX
(504'd live; offline-only), `gpt-tokenizer`/`tiktoken` (wrong tokenizer for Claude — use #2),
`upstash/semantic-cache` (2nd vendor + stale; native pgvector from prior wins), Vercel AI SDK as a
dependency (conflicts with the deliberate small-bundle raw-`fetch` Edge path — steal the
middleware-cache *pattern* instead), `wassupjay/n8n-free-templates` & `Sairyss/domain-driven-hexagon`
(license-unclear / stale).

---

## 2. Track 1 — Discovery depth (new/different options)

*Plugs into `scrape_site`, `profile_business`, `identify_opportunities`.* The prior pass's thesis
still holds — **deepen discovery by moving work off the model**. This pass finds *different* levers:
(a) deterministic **firmographic/metadata** extraction (not body content), (b) **keyless structured
firmographic APIs** (not keyed search), and (c) a **different, Jina-native** deep-research pattern.

### 2.1 Extraction libraries (different from defuddle / readability / article-extractor)

| Tool | Link | Node it touches | Runtime fit | License | Stars · last push | How it DIFFERS / net token impact | Effort | Verdict |
|---|---|---|---|---|---|---|---|---|
| **metascraper** | [microlinkhq/metascraper](https://github.com/microlinkhq/metascraper) | `profile_business` (firmographics) | **Node** (got/jsdom deps) — run in Vercel/Node layer or offline build, **not Deno Edge** | **MIT** | 2,686★ · 2026-06-10 | defuddle = body content; metascraper = **deterministic metadata** (publisher, logo, author, date, lang; community **address** bundle via schema.org/Microdata/RDFa/JSON-LD fallbacks). **↓↓ off-model** structured profile fields | S | **prototype** |
| **dom-to-semantic-markdown** | [romansky/dom-to-semantic-markdown](https://github.com/romansky/dom-to-semantic-markdown) | `scrape_site` (fallback) | **Node/browser** (JSDOM); Deno unverified | **MIT** | 978★ · 2025-05-21 (slower cadence) | defuddle strips to main content; this preserves **tables (with column IDs for LLM correlation), links as refs, and JSON-LD** in token-efficient markdown — better for pricing/spec tables Scout needs | S | **watch** |
| **turndown** | [mixmark-io/turndown](https://github.com/mixmark-io/turndown) | `scrape_site` (fallback) | **Node/browser**; Deno via `npm:` likely | **MIT** | 11,243★ · 2026-05-09 | A lighter deterministic HTML→markdown alt to defuddle's fallback; mature/stable. No body-isolation — pair with a content selector | S | **watch** |
| **apify/crawlee** | [apify/crawlee](https://github.com/apify/crawlee) | `scrape_site` (breadth) | **Node** crawler (Cheerio/Playwright) — **wrong shape for a 110s Edge node**; viable only as offline build or a Vercel-layer crawl | **Apache-2.0** | 23,749★ · 2026-06-12 | The **Node-native** answer to prior's Python rejects (Scrapy/Crawl4AI) — runs in Scout's language. Still heavy; only worth it if you need real multi-page anti-bot crawling | M/L | **watch** |
| **extractus/feed-extractor** | [extractus/feed-extractor](https://github.com/extractus/feed-extractor) | `profile_business` (news) | Node/Deno | **MIT** | 191★ · 2026-05-03 | Niche: parse a company's **RSS/Atom** feed for recent press/news as bounded firmographic signal | S | **watch** |

### 2.2 $0 keyless firmographic enrichment (different from Tavily/Exa/Serper/Brave/OpenCorporates)

All three were **exercised live this session** (responses quoted), and all are **keyless** ($0, no quota tier to blow):

| Source | Verified live (2026-06-12) | What it returns | License / terms | Verdict |
|---|---|---|---|---|
| **GLEIF LEI API** (`api.gleif.org`) | ✅ `?filter[entity.legalName]=Apple Inc` → `legalName`, `jurisdiction: US-CA`, `status: ACTIVE`, `legalAddress.city` | Legal entity name, registered/HQ address, jurisdiction, entity status, **parent/child ownership**, BIC/ISIN mapping; fuzzy name search | **Open data**, CC0-style LEI dataset; keyless | **prototype** — best for legally-named entities |
| **SEC EDGAR** (`data.sec.gov`) | ✅ `/submissions/CIK….json` → `name: Apple Inc.`, `sic: 3571 Electronic Computers`, `tickers: [AAPL]`, `city: CUPERTINO` | **SIC industry code**, ticker, addresses, filing history; full-text search at `efts.sec.gov` | **Public domain**; keyless but **requires a descriptive `User-Agent`** (bot-gated — bare fetch 403s) | **prototype** — US public companies only |
| **Wikidata** (`wikidata.org/w/api.php`) | ✅ `wbsearchentities?search=Stripe` → `Q7624104` "Irish-American payment technology company" | Industry, HQ, founders, employee count, parent org, official site — all as structured claims | **CC0**; keyless | **prototype** — notable entities only |

**Why this beats the prior breadth picks:** Tavily/Exa cap at 1k searches/mo (a non-$0 dependency at
scale) and OpenCorporates was downgraded for share-alike+attribution. This trio is **keyless, $0,
permissively licensed, and returns *structured* fields** (SIC code, jurisdiction, ticker) that go
straight into `business_profile` with **one** cheap Haiku summarize — not a freeform web snippet that
costs Opus tokens to digest. **Net token impact: small and bounded** (deterministic JSON in, a few
profile fields out). Gate behind a flag so the keyless Jina core path stays the default; only
enrich when a legal name / ticker / domain resolves.

### 2.3 Deep-research orchestration (different from dzhng/gpt-researcher/open_deep_research/storm)

| Repo | Link | Why look (vs the prior TS pick, `dzhng/deep-research`) | Runtime | License | Stars · last push |
|---|---|---|---|---|---|
| **jina-ai/node-DeepResearch** | [jina-ai/node-DeepResearch](https://github.com/jina-ai/node-DeepResearch) | **TS, and Jina-Reader-native** (Scout already uses Jina). Loop = search→read→reason with a **hard token budget** ("Beast Mode" forces a final answer at the cap) + dedupe + URL-tracking + content cache + bad-attempt context resets. Steal the **token-budget hard-stop** | TS/Node | **Apache-2.0** | 5,187★ · 2026-05-01 |
| **btahir/open-deep-research** | [btahir/open-deep-research](https://github.com/btahir/open-deep-research) | TS/Next.js (same stack as Scout's web layer); shows a lightweight, UI-driven research loop you could mirror in the Vercel layer | TS/Next.js | **MIT** | 2,141★ · 2025-12-15 |
| **u14app/deep-research** | [u14app/deep-research](https://github.com/u14app/deep-research) | TS/Next.js, multi-provider; another 1:1-readable reference for a bounded fan-out | TS | **MIT** | 4,608★ · 2026-04-22 |
| **zilliztech/deep-searcher** | [zilliztech/deep-searcher](https://github.com/zilliztech/deep-searcher) | Python — **reference only** (RAG-over-private-docs deep search); pattern, not a drop-in | Python | Apache-2.0 | 7,861★ · 2025-11-19 |

**Recommended Track-1 design delta (concrete):** keep Jina primary (prior). Add **(a)** a `metascraper`
pass in the **Node/Vercel layer** (or offline) to lift firmographic metadata off-model; **(b)** a
**flag-gated keyless enrich** that, when a legal name/ticker resolves, pulls GLEIF/EDGAR/Wikidata JSON
and Haiku-summarizes 4–6 fields into `business_profile` with citations; **(c)** borrow
node-DeepResearch's **token-budget hard-stop** for any future external-research loop. Net: broader,
*structured*, grounded discovery whose only added model cost is one bounded summarize.

---

## 3. Track 2 — Reference architectures (new/different options)

*Plugs into `solution_design` → `generate_workflow`.* Prior gave Scout **messaging** (EIP) and **cloud**
(Azure) pattern vocabularies. The gap they leave is the **control-flow / process** layer — the part
that actually dictates the n8n node graph. This pass fills exactly that.

| Source | Link | What it adds (vs EIP/Azure) | License / reuse | Stars · last push | Verdict |
|---|---|---|---|---|---|
| **Workflow Patterns** (van der Aalst control-flow) | [Wikipedia](https://en.wikipedia.org/wiki/Workflow_patterns) · seminal: *Distributed and Parallel Databases* 14(1):5–51 (2003) | **The missing layer.** Sequence, Parallel Split, Synchronization, Exclusive Choice, Simple Merge, Multi-Choice, Discriminator → map **1:1 onto n8n graph primitives** (linear chain, multiple outgoing connections, Merge node, IF/Switch node). Lets `solution_design` emit a control-flow skeleton the n8n archetype fills | Academic **vocabulary** — names/concepts freely citable | n/a (Initiative; `workflowpatterns.com` was **unreachable during research** — cite Wikipedia + the paper) | **adopt** (vocabulary) |
| **microservices.io patterns** (Chris Richardson) | [microservices.io/patterns](https://microservices.io/patterns/index.html) | Saga, CQRS, **Transactional Outbox**, API Composition, Strangler, Anti-corruption layer, Idempotent Consumer — strong fit for "system integration / data sync / migration" opportunity types | **Pattern *names* usable; site text is © "All rights reserved"** — do **not** copy descriptions | website (Richardson) | **prototype** (names only) |
| **AWS ServerlessLand patterns** | [serverlessland.com/patterns](https://serverlessland.com/patterns) · repo [aws-samples/serverless-patterns](https://github.com/aws-samples/serverless-patterns) | Real, **deployable** event-driven blueprints (EventBridge/SQS/Lambda/Step Functions) with IaC source — good *design references* for event-driven opportunity types | **MIT-0** (confirmed by reading the repo LICENSE; GitHub API mislabels it `NOASSERTION`) | 1,804★ · 2026-06-12 | **watch** — AWS-centric, off-brand vs NorthBound's Microsoft stack |
| **DovAmir/awesome-design-patterns** | [DovAmir/awesome-design-patterns](https://github.com/DovAmir/awesome-design-patterns) | Broad cross-domain pattern index (cloud, integration, microservices, data) for research breadth | **no license declared** · index | 47,711★ · **2024-10-25 (stale)** | **watch** (index only) |
| **Sairyss/domain-driven-hexagon** | [Sairyss/domain-driven-hexagon](https://github.com/Sairyss/domain-driven-hexagon) | DDD/hexagonal reference for app-internal structure | MIT | 14,701★ · **2024-06-11 (stale)** | **reject** — too app-internal/hyperscale; not SMB-automation shaped |

**How it extends the deterministic catalog:** the prior `patterns.yaml` proposal mapped *opportunity →
messaging pattern → n8n archetype*. Add a **`control_flow:` field** drawn from Workflow Patterns
(e.g. `exclusive-choice` → emit an n8n IF/Switch; `parallel-split + synchronization` → fan-out + Merge),
and an optional **`integration_pattern:`** from microservices.io for data-sync opportunities (Saga /
Transactional Outbox). This makes `solution_design`'s output a *control-flow graph spec*, which
`generate_workflow` (now grounded by n8n-mcp, §4 of Track 3) can validate node-by-node.

---

## 4. Track 3 — n8n templates & tooling (new/different options)

*Plugs into `generate_workflow`.* Prior sourced **raw template corpora** (api.n8n.io `/search`,
Zie619). The different, higher-leverage surfaces this pass found are **(a) an MCP server that exposes
n8n node *schemas* + a *validator*, (b) the curated *collections* index, and (c) a community-node
index** — i.e. the *grounding and validation* layer, not just more JSON.

### 4.1 The headline: `czlonkowski/n8n-mcp` (verified via its README)

| Capability (confirmed) | Why it matters for Scout |
|---|---|
| **1,851 n8n nodes** with property/parameter schemas (99% property, 63.6% operation coverage) | `generate_workflow` can ground node selection in **real node schemas** instead of 5 hand-rolled archetypes — kills "node/parameter doesn't exist" failures |
| **Workflow validation** — node-config + full-workflow (connections + expressions) + **automated fix** of common errors | Directly **closes the still-open P8 import smoke test**: validate the generated JSON *before* claiming it imports |
| **Template search** over **2,352** workflow templates (keyword / node-type / task / metadata) | A second, schema-aware corpus alongside prior's `/search` + Zie619 |
| **Offline-capable** (npx/Docker/Railway; n8n instance optional; free cloud tier 100 calls/day) | Runs in Scout's **Node/MCP** layer at $0; no runtime dependency on a live n8n |
| **TypeScript**, **MIT** | Same stack; permissive; Scout already ships an MCP server, so this composes naturally |

- Metrics (live): **21,704★ · push 2026-06-10 · MIT** — by far the most active, highest-signal n8n
  tooling found. **Verdict: adopt.** Use its node schemas to ground generation and its validator to
  gate `generate_workflow`'s output; keep the 5 archetypes as the guaranteed fallback.

### 4.2 Other new template surfaces

| Source | Link | What it adds (vs prior) | Importable JSON? | License | Stars · last push | Verdict |
|---|---|---|---|---|---|---|
| **n8n `collections` API** | `https://api.n8n.io/api/templates/collections` (verified live: returns curated groupings e.g. "Advanced AI", "n8n Key Concepts" with workflow-id lists) | **Human-curated groupings** = higher signal than the flat `/search` prior used; good for "show me the canonical AI/automation workflow set" | Yes (via `/workflows/{id}`) | n8n SUL | — (official) | **prototype** |
| **restyler/awesome-n8n** | [restyler/awesome-n8n](https://github.com/restyler/awesome-n8n) | Index of **5,834 community *nodes*** (not templates) ranked by npm downloads → answers "**which catalog tools actually have an n8n node**" (a feasibility map prior lacked) | n/a (node index) | **no license** (use as metadata) | 2,912★ · 2026-01-20 | **prototype** |
| **wassupjay/n8n-free-templates** | [wassupjay/n8n-free-templates](https://github.com/wassupjay/n8n-free-templates) | Additional AI-stack template collection (vector DBs, embeddings) | Yes | **no license** (flag) | 5,868★ · 2025-08-01 | **watch** |
| **oxbshw/Open-Workflow-Library** | [oxbshw/Open-Workflow-Library](https://github.com/oxbshw/Open-Workflow-Library) | Smaller curated MIT-licensed library (formerly "ultimate-n8n-ai-workflows") | Yes | **MIT** | 541★ · 2026-05-24 | **watch** |

### 4.3 Honest coverage check (n8n templates vs NorthBound's catalog) — live counts

I queried `api.n8n.io/.../search` per tool (2026-06-12, `totalWorkflows`):

| Catalog tool | n8n templates | | Catalog tool | n8n templates |
|---|---:|---|---|---:|
| Slack | **1,478** | | Microsoft Teams | 45 |
| Notion | **341** | | SharePoint | 29 |
| Outlook | **100** | | Snowflake | 6 |
| Salesforce | 45 | | Copilot | 4 |
| | | | Power Automate / Power BI / Dynamics 365 | **~1 each** |

**Key takeaway for Track 3:** n8n template coverage is **deep for the SaaS-adjacent catalog tools**
(Slack/Notion/Outlook/Salesforce/HubSpot) and **thin for the core Power Platform** (Power
Automate/Power BI/Dynamics ≈ 1 each — n8n has no dedicated nodes for those; they go via HTTP/Graph).
This *reinforces the architecture*: **n8n is the delivery substrate Scout generates, while Power
Automate/Power BI/Dynamics are *recommendations* in the report, not artifacts n8n emits.** Filter the
template index to the SaaS-mappable subset and don't expect importable n8n JSON for Microsoft-native
recommendations.

---

## 5. Track 4 — Cost / compute / latency / storage (new/different options)

*Whole pipeline.* Prior owned model-side caching (prompt cache, gte-small/pgvector), Batch, LZ4,
checkpoint slimming. The *different* levers here are **pre-flight token budgeting**, **incremental
crawl that skips the fetch**, and **frontend response caching**.

### 5.1 Anthropic `count_tokens` — free pre-flight budget enforcement (effort S) — **adopt**

The `claude-api` skill docs confirm token counting is a **model-specific** endpoint
(`POST /v1/messages/count_tokens`) and is the correct way to size a prompt against `claude-opus-4-8` /
`claude-haiku-4-5` (it explicitly warns **against** `tiktoken`/`gpt-tokenizer`, which under-count
Claude by 15–20%). It is a **free utility endpoint** — no generation tokens billed.

- **Different from prior:** Scout's `cost.ts` records spend **after** a call. `count_tokens` lets each
  node check the assembled prompt **before** firing — trim/compress when the scraped evidence would
  blow the ~30–60K/run budget, and avoid `413 request_too_large` and `stop_reason: "max_tokens"`
  truncation-retries (each truncation today costs a full re-issued call).
- **Where it pays:** in front of the Opus nodes (`profile_business`, `identify_opportunities`,
  `critique`) where `scrapeMarkdown.slice(0, 60_000)` can dominate input. **$0, no new dependency.**
- *(Adjacent refinement, not a new recommendation since caching is prior-owned: the same docs note a
  `max_tokens: 0` **cache pre-warm** to remove first-request cache-miss latency on the shared prefix —
  worth a one-line note when you implement prior's cached-prefix plan, not a separate adopt.)*

### 5.2 Incremental crawl — conditional requests + sitemap `lastmod` (effort S) — **adopt**

Prior's content-hash dedupe avoids **re-charging Claude** on identical scrapes — but it still **fetches
the bytes first**. A stronger, $0, deterministic lever:

- Store the `ETag` / `Last-Modified` from each `scrape_pages` row; on re-run send
  `If-None-Match` / `If-Modified-Since`. A `304 Not Modified` skips the body download entirely, and
  (because the content is unchanged) the whole downstream LLM chain for that page can be skipped.
- For multi-page breadth (prior's sitemap idea), read `sitemap.xml`'s `<lastmod>` and only
  re-scrape URLs whose `lastmod` advanced since the cached scrape. **Net: on re-engagements, near-zero
  scrape and zero LLM for unchanged sites** — directly relevant to Scout's "re-runs create a new
  version" model. Caveat: many SMB sites omit `ETag`/`lastmod`; fall back to the existing content-hash.

### 5.3 Frontend response caching — Next.js ISR / Vercel data cache (effort S/M) — **prototype**

All prior cost work is model-side. A different surface: the **public `/share/[token]` report pages**
are read-mostly. Serve them with **ISR / `Cache-Control` / the Vercel data cache** so a popular shared
report renders once and is served from cache instead of re-querying Supabase on every view.

- Net: fewer Edge invocations + DB reads against the Free-tier quotas, faster TTFB; **$0 on Hobby**.
- Caveat: reports are **editable**, so use a **short revalidate window or tag-based revalidation** on
  edit/revoke so a stale or revoked report isn't served. Honors the existing hash-only share-token
  model (revocation must purge the cache tag).

### 5.4 Considered and contrasted (not adopted)

| Tool / technique | Link | Why it loses vs the prior pick / constraints | Verdict |
|---|---|---|---|
| **Vercel AI SDK** (`wrapLanguageModel` cache/guardrail middleware) | [ai-sdk.dev](https://ai-sdk.dev/docs/ai-sdk-core/middleware) (24,827★ · Apache-2.0) | The **middleware-cache pattern** is genuinely nice (cache/retry/guardrail wrappers, Zod structured output) — but adopting the whole SDK **conflicts with the deliberate small-bundle raw-`fetch` Edge path**, and prior already builds the cache natively on pgvector. **Steal the thin-wrapper pattern, not the dependency** | **watch** |
| **LLMLingua-2** (prompt compression) | [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) (6,284★ · MIT) | Up to ~20× compression, but it's **Python + a small model (BERT-based)** → a separate service/offline step. Prior's **cheap-Haiku compress** does the same job **in-runtime at $0** | **reject** (runtime); watch as concept |
| **gpt-tokenizer / tiktoken** (local token counting) | [niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (809★) · [dqbd/tiktoken](https://github.com/dqbd/tiktoken) (1,052★) | **Wrong tokenizer for Claude** — the `claude-api` docs explicitly say these under-count by 15–20%. Use `count_tokens` (§5.1) | **reject** |
| **upstash/semantic-cache** | [upstash/semantic-cache](https://github.com/upstash/semantic-cache) (296★ · MIT · **2024-11-21 stale**) | Adds a **2nd free-tier vendor** (Upstash Vector) and is stale; prior's native gte-small + pgvector is strictly better at $0 | **reject** |
| **Common Crawl CDX index** (per-domain URL discovery) | `index.commoncrawl.org/...` | **504 Gateway Time-out when hit live this session** — operationally unreliable for a 110s node; offline-only at best | **reject** (runtime) |

---

## 6. Rejected / not worth it (with reasons)

- **apify/crawlee** — the Node-native crawler that answers prior's Python rejects, but a
  Playwright/Cheerio crawler is the **wrong shape for a 110s leased Edge node**. Only viable as an
  offline build or a Vercel-layer crawl; revisit only if you genuinely need anti-bot multi-page
  crawling at scale. **watch**, not adopt.
- **turndown** — fine HTML→markdown, but defuddle (prior) already owns the extraction-fallback slot;
  turndown adds nothing differentiating. **watch**.
- **DuckDuckGo (`duck-duck-scrape`, 227★, 2025-03-20) / Marginalia (1,842★, AGPL+key)** — keyless
  search breadth, but DDG HTML scraping is ToS-grey and the lib is stale; Marginalia is AGPL and needs
  a key/self-host. The **keyless GLEIF/EDGAR/Wikidata trio (§2.2)** is the cleaner $0 breadth story.
- **LLMLingua-2 / gpt-tokenizer / tiktoken / upstash-semantic-cache / Common Crawl CDX** — see §5.4.
- **microservices.io descriptions** — pattern *names* are usable, but the site text is © "all rights
  reserved"; **do not mirror its prose**. Names/vocabulary only.
- **Sairyss/domain-driven-hexagon** — DDD/hexagonal app-internal structure, stale (2024-06), not
  SMB-automation shaped. **reject** for Scout's `solution_design`.
- **DovAmir/awesome-design-patterns / wassupjay templates** — license-unclear and/or stale; use only
  as research indices, never redistribute.
- **Vercel AI SDK as a dependency** — conflicts with the small-bundle raw-`fetch` Edge choice; adopt
  the *pattern* not the package (§5.4).

---

## 7. Open questions & suggested sequencing

**Decisions before implementation:**
1. **Keyless enrichment scope (§2.2)** — enrich only when a legal name/ticker/domain resolves, behind
   a flag (keep the keyless Jina path as default)? *(Recommended: yes; GLEIF for legal entities,
   EDGAR for US public co's, Wikidata for notable brands — one Haiku summarize, with citations.)*
2. **n8n-mcp integration shape (§4.1)** — run it as a **build-time validator** over generated
   workflows (hermetic, simplest) vs a **live MCP dependency** of `generate_workflow`?
   *(Recommended: build-time/offline validation first — it closes P8 without adding a runtime dep;
   adopt its node-schema export to ground generation next.)*
3. **`count_tokens` placement (§5.1)** — pre-flight only the three Opus nodes, or every node?
   *(Recommended: Opus nodes first — they carry the 60K scrape blob and the truncation risk.)*
4. **`/share` cache invalidation (§5.3)** — short revalidate window vs tag-based revalidation on
   edit/revoke? *(Recommended: tag-based, keyed to the report id, purged on edit and on share-revoke.)*

**Suggested sequencing (each independently shippable):**
1. **`count_tokens` pre-flight budget guard** (§5.1) — smallest change, removes truncation-retries,
   de-risks the token budget for everything else. Do first.
2. **Conditional-request / `lastmod` incremental crawl** (§5.2) — $0, deterministic, big win on re-runs.
3. **metascraper firmographic pass + keyless enrich trio** (§2.1–2.2) — deeper *structured* discovery
   off-model; flag-gated.
4. **Workflow-Patterns `control_flow` field on the pattern catalog** (§3) — the bridge that makes
   `generate_workflow` a control-flow lookup.
5. **`n8n-mcp` validation + node-schema grounding** (§4.1) — finally closes the open **P8 import smoke
   test** and grounds generation; then layer the **collections** index + **awesome-n8n** feasibility map.
6. **Next.js ISR on `/share`** (§5.3) — frontend caching; opportunistic.

**Coupling note:** Track 2 (Workflow Patterns control-flow) → Track 3 (n8n-mcp validation) is one chain
— the control-flow skeleton from `solution_design` becomes a node graph that n8n-mcp validates. Doing
the small Track-2 vocabulary first makes the Track-3 generation *checkable* rather than hopeful.

---

## 8. Source log (every URL fetched/searched on 2026-06-12, grouped by track)

**Tooling:** GitHub metrics via authenticated `gh api repos/<owner>/<repo>` (stars / `pushed_at` /
`license.spdx_id`); free APIs exercised with `curl`; Anthropic facts from the in-repo `claude-api`
skill (`shared/token-counting.md`, `shared/prompt-caching.md`).

**Track 1 — discovery depth**
- https://github.com/microlinkhq/metascraper (2,686★, 2026-06-10, MIT) — README fetched (deterministic OG/Microdata/RDFa/JSON-LD; address bundle; Node)
- https://github.com/romansky/dom-to-semantic-markdown (978★, 2025-05-21, MIT) — README fetched (tables/JSON-LD, token-efficient, JSDOM)
- https://github.com/mixmark-io/turndown (11,243★, 2026-05-09, MIT)
- https://github.com/apify/crawlee (23,749★, 2026-06-12, Apache-2.0)
- https://github.com/extractus/feed-extractor (191★, 2026-05-03, MIT)
- https://github.com/jina-ai/node-DeepResearch (5,187★, 2026-05-01, Apache-2.0) — README fetched (Beast-Mode token budget, Jina Reader, dedupe)
- https://github.com/btahir/open-deep-research (2,141★, 2025-12-15, MIT)
- https://github.com/u14app/deep-research (4,608★, 2026-04-22, MIT)
- https://github.com/nickscamara/open-deep-research (6,251★, 2025-05-07, NOASSERTION)
- https://github.com/zilliztech/deep-searcher (7,861★, 2025-11-19, Apache-2.0)
- https://www.gleif.org/en/lei-data/gleif-api + **live** `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=Apple Inc` → keyless ✓ (legalName/jurisdiction/status/address)
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces (WebFetch 403 — bot-gated) + **live** `https://data.sec.gov/submissions/CIK0000320193.json` with descriptive UA → keyless ✓ (name/SIC 3571/AAPL/Cupertino)
- **live** `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Stripe` → keyless ✓ (Q7624104)
- `https://index.commoncrawl.org/CC-MAIN-2025-05-index?url=stripe.com/*` → **504 Gateway Time-out** (unreliable)
- https://github.com/Snazzah/duck-duck-scrape (227★, 2025-03-20, MIT)
- https://github.com/MarginaliaSearch/MarginaliaSearch (1,842★, 2026-06-12, NOASSERTION/AGPL)

**Track 2 — reference architectures**
- https://en.wikipedia.org/wiki/Workflow_patterns — fetched (van der Aalst control-flow patterns; seminal *Distributed and Parallel Databases* 14(1):5–51, 2003; `workflowpatterns.com` ECONNREFUSED during research)
- https://microservices.io/patterns/index.html — fetched (Saga/CQRS/Transactional Outbox/Strangler/Anti-corruption; © "All rights reserved" — names usable, text not)
- https://serverlessland.com/patterns + https://github.com/aws-samples/serverless-patterns (1,804★, 2026-06-12) — LICENSE read = **MIT-0** (GitHub API says NOASSERTION)
- https://github.com/DovAmir/awesome-design-patterns (47,711★, 2024-10-25, no license)
- https://github.com/Sairyss/domain-driven-hexagon (14,701★, 2024-06-11, MIT)

**Track 3 — n8n templates & tooling**
- https://github.com/czlonkowski/n8n-mcp (21,704★, 2026-06-10, MIT) — README fetched (1,851 nodes, validation+auto-fix, 2,352 templates, offline npx/Docker)
- **live** `https://api.n8n.io/api/templates/collections` → curated groupings (Advanced AI, n8n Key Concepts) ✓
- **live** `https://api.n8n.io/api/templates/search?search=...` coverage counts: Slack 1478, Notion 341, Outlook 100, Salesforce 45, Teams 45, SharePoint 29, Snowflake 6, Copilot 4, Power Automate/Power BI/Dynamics ≈1
- https://github.com/restyler/awesome-n8n (2,912★, 2026-01-20, no license) — README fetched (5,834 community nodes ranked by npm downloads)
- https://github.com/wassupjay/n8n-free-templates (5,868★, 2025-08-01, no license)
- https://github.com/oxbshw/Open-Workflow-Library (541★, 2026-05-24, MIT)

**Track 4 — cost / compute / latency / storage**
- `claude-api` skill — `shared/token-counting.md` (free model-specific `count_tokens`; do **not** use tiktoken/gpt-tokenizer) + `shared/prompt-caching.md` (`max_tokens:0` pre-warm) — live doc: https://platform.claude.com/docs/en/build-with-claude/token-counting
- RFC 9110 conditional requests (`If-None-Match`/`If-Modified-Since`) + sitemap `<lastmod>` (technique)
- https://nextjs.org/docs/app/building-your-application/caching (ISR / data cache / `Cache-Control`)
- https://ai-sdk.dev/docs/ai-sdk-core/middleware — fetched (`wrapLanguageModel` cache/guardrail middleware) · https://github.com/vercel/ai (24,827★, 2026-06-12, Apache-2.0)
- https://github.com/microsoft/LLMLingua (6,284★, 2026-04-08, MIT) — README fetched (≤20× compression, Python + small model)
- https://github.com/niieani/gpt-tokenizer (809★, 2026-02-10, MIT) · https://github.com/dqbd/tiktoken (1,052★, 2025-08-09, MIT)
- https://github.com/upstash/semantic-cache (296★, 2024-11-21, MIT)

**Unverified / flagged:** `workflowpatterns.com` unreachable (ECONNREFUSED) — Workflow Patterns grounded
via Wikipedia + the 2003 paper instead · metascraper & dom-to-semantic-markdown **Deno-Edge** compat
unverified (both are Node/JSDOM — run in the Vercel/Node layer or offline) · `aws-samples/serverless-patterns`
license read as MIT-0 from the LICENSE file though the GitHub API reports `NOASSERTION` · `restyler/awesome-n8n`,
`wassupjay/n8n-free-templates` carry **no declared license** (treat as metadata/reference, don't redistribute) ·
Common Crawl CDX returned a live 504 · `count_tokens` is a free utility endpoint (no generation tokens) but is
subject to ordinary request rate limits — confirm headroom before wiring it in front of every node.
