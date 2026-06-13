# Scout Research Findings — 2026-06-12

> Research-only deliverable. No project code was changed. Every repo metric below
> (stars, last-commit date, license) was pulled from the live GitHub API or the
> tool's own docs on 2026-06-12; where I could not verify something I say so.
> Star counts and dates drift — treat them as "as of 2026-06-12."

## 0. Current-state recap

Scout is at **P17 (deploy + rehearsed demo)** — the whole 12-node pipeline
(`scrape_site → profile_business → identify_opportunities → score_and_rank →
map_tools → draft_requirements → solution_design → generate_workflow →
discovery_questions → write_playbook → critique → finalize`) is implemented and
green in CI; what remains is live deployment (Supabase + Vercel) and a rehearsed
run. The agent is **Deno/TypeScript on Supabase Edge Functions** (one leased node
per invocation, ~100s wall budget, 2s CPU, 500K free invocations/mo, 500 MB DB),
with a thin Next.js/Vercel front door. Scrape today = **Jina Reader (keyless) →
SSRF-checked direct fetch + a custom HTML-to-text extractor → optional Firecrawl**,
`maxPages` defaulting to **1**. Tool mapping is constrained to a **43-tool
`catalog.yaml`** passed in-context. n8n generation is **archetype-select +
placeholder-fill + merge + structural validate** over **5 pinned (v1.88.0)
templates** — no live import test yet. Models: `claude-opus-4-8` ($5/$25 per MTok)
on judgement nodes, `claude-haiku-4-5` ($1/$5) on the cheap ones.

The constraints that shaped this research: **$0/month infra**, **~30–60K tokens/run**
(anything that *adds* model load is a regression unless it removes more than it
adds), **~110s/node wall**, **Deno/Node runtime** (Python tools must justify a
separate hosted service / offline build step), **MIT/Apache/BSD preferred**, and
**recent + maintained**. The most important filter throughout was Track 1's thesis:
*deepen discovery by moving work OFF the model (deterministic extraction, indexing,
caching), not by calling the LLM more.*

---

## 1. Top recommendations (the short list)

Ranked by leverage-per-unit-effort under Scout's constraints.

| # | Name | Link | Track | Impact | Effort | License | Verdict |
|---|------|------|-------|--------|--------|---------|---------|
| 1 | **Shared cacheable system prefix across all nodes** | [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | 4 | High — turns 1 cache-write into ~8–12 cache-reads/run (90%-off input on the shared NorthBound+pillars+catalog prefix) | **S** | n/a | **adopt** |
| 2 | **`Supabase.ai.Session('gte-small')`** (native Edge embeddings) | [Supabase AI inference](https://supabase.com/blog/ai-inference-now-available-in-supabase-edge-functions) | 4/1 | High — $0, on-device, ~100–200ms CPU; unlocks a pgvector semantic cache + any RAG with zero API/token cost | **S/M** | Apache-2.0 (platform) | **adopt** |
| 3 | **Official n8n template API** (10,072 templates, fully indexable) | [api.n8n.io/api/templates](https://api.n8n.io/api/templates/search?page=1&rows=2) · [n8n.io/workflows](https://n8n.io/workflows/) | 3 | High — replaces 5 hand-rolled archetypes with a searchable corpus of real, importable workflows | **M** | n8n SUL (use OK; see notes) | **adopt** |
| 4 | **`kepano/defuddle`** (TS content extractor → markdown) | [github.com/kepano/defuddle](https://github.com/kepano/defuddle) | 1 | Med-High — cleaner extraction than the custom HTML-to-text fallback → *fewer* input tokens; native TS | **S** | MIT | **adopt** |
| 5 | **Enterprise Integration Patterns vocabulary** (via Apache Camel docs) | [camel.apache.org EIPs](https://camel.apache.org/components/4.18.x/eips/enterprise-integration-patterns.html) | 2 | High — gives `solution_design` a deterministic pattern catalog; bridges Track 2→3 (pattern→archetype→template) | **M** | Apache-2.0 (Camel docs) | **adopt** |
| 6 | **`Zie619/n8n-workflows`** (offline-bundleable index, ~2k JSON) | [github.com/Zie619/n8n-workflows](https://github.com/Zie619/n8n-workflows) | 3 | Med-High — 55k★ MIT tooling + workflow corpus to bundle/index without hitting api.n8n.io at runtime | **S/M** | MIT (tooling) | **adopt** |
| 7 | **Deterministic multi-page breadth** (sitemap + existing link-discovery, raise `maxPages`) | [trafilatura sitemap docs](https://trafilatura.readthedocs.io/) (pattern) | 1 | Med — deeper grounding with **zero** extra LLM tokens (it's deterministic crawling) | **S** | n/a | **adopt** |
| 8 | **`dzhng/deep-research`** (TS deep-research pattern reference) | [github.com/dzhng/deep-research](https://github.com/dzhng/deep-research) | 1 | Med — borrow the bounded fan-out→dedupe→compress loop; it's TS so it reads 1:1 onto Scout | **S** (read only) | MIT | **prototype** |
| 9 | **Anthropic Message Batches API** (50% off, async) | [batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing) | 4 | Med — halve cost on the **non-interactive** paths (nightly LLM-judge evals, inbound n8n triage) | **S** | n/a | **adopt (evals/triage only)** |
| 10 | **Azure Cloud Design Patterns** (named pattern set + samples) | [learn.microsoft.com patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/) · [mspnp/cloud-design-patterns](https://github.com/mspnp/cloud-design-patterns) | 2 | Med — Microsoft-native pattern names (Publisher-Subscriber, Claim-Check, Scheduler-Agent-Supervisor) that match NorthBound's stack | **M** | Docs CC-BY-4.0 / samples MIT | **prototype** |

**Deliberate non-adoptions** (full reasons in §6): ScrapeGraphAI (LLM-driven
extraction = *more* tokens), Crawl4AI / trafilatura / Scrapy (Python, can't run in
the Deno node — only as a separate service or offline build), GPTCache (Python +
~11-months stale; build the cache natively on pgvector instead), RAG-trimming the
catalog (not worth it at 43 tools; caching the whole catalog is simpler and keeps
the strict enum grounding), SearXNG (AGPL + needs its own host), Brave Search API
(free tier retired Feb 2026).

---

## 2. Track 1 — Discovery depth (without token bloat)

*Plugs into `scrape_site`, `profile_business`, `identify_opportunities`.*

The single most important framing: Scout's current path already does the right
thing (Jina Reader is keyless, JS-rendering, returns markdown — deterministic and
$0). The wins are **(a) a better fallback extractor, (b) more deterministic
breadth, (c) a bounded external-enrichment step, and (d) borrowing the
fan-out→compress *pattern*** — not swapping the whole scraper for a heavier one.

### 2.1 Extraction / scraping libraries

| Tool | Link | Node it touches | Runtime fit | License | Stars · last commit | Net token impact | Effort | Verdict |
|---|---|---|---|---|---|---|---|---|
| **defuddle** | [kepano/defuddle](https://github.com/kepano/defuddle) | `scrape_site` (fetch fallback) | **TS — browser+Node** (jsdom/linkedom/happy-dom); Deno-likely via linkedom (not officially stated) | **MIT** | 8,076★ · 2026-06-06 | **↓ reduces** — cleaner main-content markdown than custom HTML-to-text → fewer junk tokens into Opus | S | **adopt** |
| **@extractus/article-extractor** | [extractus/article-extractor](https://github.com/extractus/article-extractor) | `scrape_site` (fetch fallback) | JS — Node-native, also has Deno usage notes | **MIT** | 1,895★ · 2026-05-03 | ↓ reduces | S | **watch** (defuddle alt) |
| **mozilla/readability** | [mozilla/readability](https://github.com/mozilla/readability) | `scrape_site` (fetch fallback) | JS — needs a DOM (jsdom) | Apache-2.0 (GH shows NOASSERTION) | 11,269★ · 2026-01-21 | ↓ reduces | S | **watch** (defuddle is newer/cleaner) |
| **Crawl4AI** | [unclecode/crawl4ai](https://github.com/unclecode/crawl4ai) | `scrape_site` | **Python** — can't run in the Deno node; only as a separate hosted service (it ships a Docker server) or an offline build step | **Apache-2.0** | 68,335★ · 2026-06-04 | neutral/↓ if used to pre-build markdown offline; **↑ infra** if hosted | M/L | **watch** (overkill for Scout's page-cap; revisit only if you need anti-bot crawling at scale) |
| **trafilatura** | [adbar/trafilatura](https://github.com/adbar/trafilatura) | `scrape_site` | **Python** — separate service or offline build only | **Apache-2.0** | 6,104★ · 2026-06-10 | ↓ best-in-class extraction quality (highest F1 in its own eval vs Readability/newspaper/goose) | M | **watch** (only if you stand up a Python extraction microservice) |
| **Scrapy** | [scrapy/scrapy](https://github.com/scrapy/scrapy) | `scrape_site` | **Python** — heavy crawler framework, wrong shape for a 110s leased node | BSD-3-Clause | 62,216★ · 2026-06-12 | n/a | L | **reject** for this runtime |
| **ScrapeGraphAI** | [ScrapeGraphAI/Scrapegraph-ai](https://github.com/ScrapeGraphAI/Scrapegraph-ai) | `scrape_site`/`profile` | Python + **LLM-driven extraction** | MIT | 27,130★ · 2026-06-11 | **↑ INCREASES tokens** — it calls an LLM to extract, the opposite of this track's goal | M | **reject** |

Note on trafilatura's quality claim: the "F1 ≈ 0.958, ahead of Mozilla Readability
≈ 0.947" figure is from trafilatura's own evaluation page / the author's benchmark,
so it's directionally useful but author-run — see
[trafilatura evaluation](https://trafilatura.readthedocs.io/en/latest/evaluation.html)
and [Barbaresi's benchmark](https://adrien.barbaresi.eu/blog/evaluating-text-extraction-python.html).

### 2.2 Deep-research orchestrators (study the pattern, don't run the hour-long job)

These all converge on the same loop — **Plan → Search → Read → Reflect → Iterate →
Synthesize**, with fan-out across many sources, dedupe, and *compress* before the
final synthesis. Scout should steal the **compress** step (gather pages
deterministically, then one cheap pass distills them) and a **bounded** fan-out,
never the multi-minute recursion.

| Repo | Link | Why look | Runtime | License | Stars · last commit |
|---|---|---|---|---|---|
| **dzhng/deep-research** | [dzhng/deep-research](https://github.com/dzhng/deep-research) | **Best fit — it's TypeScript and tiny.** Depth/breadth params, fan-out + dedupe + compress read 1:1 onto a Scout node | TS | MIT | 19,107★ · 2026-04-11 |
| **gpt-researcher** | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | Canonical planner→executors→publisher architecture; good prompts to mirror | Python | Apache-2.0 | 27,664★ · 2026-05-28 |
| **langchain-ai/open_deep_research** | [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) | LangGraph reference; closest to Scout's graph mental model | Python | MIT | 11,681★ · 2026-06-07 |
| **stanford-oval/storm** | [stanford-oval/storm](https://github.com/stanford-oval/storm) | Outline-first, multi-perspective synthesis — relevant to structuring the business profile | Python | MIT | 28,356★ · 2025-09-30 |

### 2.3 $0 source breadth (search + firmographics)

| Source | Free-tier reality (verified 2026-06-12) | Verdict for Scout |
|---|---|---|
| **Tavily** | 1,000 searches/mo free; clean snippet/extract API, TS SDK | **prototype** — best drop-in for a bounded external-enrich call; flag the 1k/mo cap |
| **Exa** | 1,000 searches/mo free | watch (alt to Tavily) |
| **Serper** | ~2,500 free queries; but depends on scraped Google data (ToS/legal risk; Google has litigated this) | reject for a client deliverable |
| **Brave Search API** | **Free tier retired ~Feb 2026** → now metered ($5 credit ≈ ~1k searches) | reject as a "$0" option |
| **SearXNG** | [searxng/searxng](https://github.com/searxng/searxng) self-host meta-search; 31,956★ · 2026-06-12, **AGPL-3.0** | reject inline — AGPL + needs its own always-on host (breaks $0 + the consulting-license preference) |
| **OpenCorporates** | Free only for open-data/journalism/NGO use; standard API 500 calls/mo & 200/day; **share-alike attribution** data license | downgrade — attribution/share-alike is awkward in a paid consulting report; use only for opt-in enrichment with attribution |
| **Common Crawl** | Free corpus, but querying it is an offline/big-data job, not a per-run call | watch — only as an offline firmographics pre-build |

### 2.4 Recommended discovery design (concrete)

1. **Keep Jina Reader primary.** It's already the best $0 default.
2. **Swap the custom HTML-to-text fallback for `defuddle`** (`scrape_site`). Net:
   cleaner markdown → *fewer* tokens reach `profile_business`. Effort S.
3. **Add deterministic breadth, off-model:** read `sitemap.xml` / `robots.txt`,
   keep the existing high-signal link regex, and raise `maxPages` to grab
   home/about/services/pricing/careers. This deepens grounding with **zero** extra
   LLM tokens (it's just more deterministic fetches, page-capped for the wall
   budget).
4. **Insert a cheap "compress" pass before Opus:** a Haiku call (or even
   deterministic dedupe by content-hash, already present) condenses the gathered
   pages into a signal digest so the **Opus** `profile_business`/`identify` nodes
   see compressed evidence, not raw pages. This is the deep-research *compress*
   pattern applied within Scout's budget — it can make discovery broader while
   *lowering* Opus input tokens.
5. **Optional bounded external enrich:** one Tavily call (free 1k/mo) for 3–5
   external snippets (recent news, firmographics) → Haiku-summarized into the
   profile with citations. Net token cost is small and bounded; net grounding gain
   is real. Gate it behind a flag so the core path stays keyless/$0.

Net effect: deeper, multi-source, **grounded** discovery where the only added model
cost is one small compress/enrich call — and extraction quality *reduces* tokens
elsewhere. That satisfies the track's "offload work off the model" thesis.

---

## 3. Track 2 — Reference architectures (make `solution_design` semi-deterministic)

*Plugs into `solution_design` (and feeds `generate_workflow`).* The goal is for
Scout to **classify an opportunity into a named pattern** and let the pattern
dictate the data-flow skeleton, integration points, and the n8n archetype — rules,
not improvisation.

### 3.1 Candidate source repos

| Source | Link | What it gives | License / reuse | Stars · last commit | Verdict |
|---|---|---|---|---|---|
| **Enterprise Integration Patterns (EIP)** | [enterpriseintegrationpatterns.com](https://www.enterpriseintegrationpatterns.com/patterns/messaging/) · impl + docs in [Apache Camel](https://camel.apache.org/components/4.18.x/eips/enterprise-integration-patterns.html) | The canonical 65-pattern vocabulary (Content-Based Router, Message Filter, Aggregator, Splitter, Content Enricher, Publish-Subscribe, Scatter-Gather, Pipes-and-Filters…). Maps almost 1:1 onto Scout's opportunity types | Pattern **names/vocabulary** are freely usable; Apache **Camel's** docs/impl are **Apache-2.0** (safe to mirror wording from) | n/a (Camel is a top-level ASF project) | **adopt** as the pattern vocabulary |
| **Azure Cloud Design Patterns** | [learn.microsoft.com/azure/architecture/patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/) | Microsoft-native named patterns (Publisher-Subscriber, Claim-Check, Competing Consumers, Gateway Aggregation, Scheduler-Agent-Supervisor, Async Request-Reply). On-brand for NorthBound's MS/Power Platform stack | Docs repo [MicrosoftDocs/architecture-center] is **CC-BY-4.0**; samples [mspnp/cloud-design-patterns](https://github.com/mspnp/cloud-design-patterns) (847★ · 2026-06-10, C#) MS-samples MIT | — | **adopt** the names; cite docs |
| **stn1slv/awesome-integration** | [stn1slv/awesome-integration](https://github.com/stn1slv/awesome-integration) | Curated index of integration software, EIP resources, iPaaS patterns | **CC0-1.0** (public domain) | 535★ · 2026-06-12 | **adopt** as a research index |
| **mehdihadeli/awesome-software-architecture** | [mehdihadeli/awesome-software-architecture](https://github.com/mehdihadeli/awesome-software-architecture) | Broad pattern/architecture link library | **CC0-1.0** | 11,212★ · 2026-06-12 | watch (index) |
| **binhnguyennus/awesome-scalability** | [binhnguyennus/awesome-scalability](https://github.com/binhnguyennus/awesome-scalability) | Real mid/large-company eng-blog architectures (data sync, pipelines, notifications) | **MIT** | 71,680★ · 2026-01-04 | watch — great for "real architecture" citations, but skews hyperscale vs Scout's SMB automations |
| **donnemartin/system-design-primer** | [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) | Famous learning resource | LICENSE.txt reads **CC-BY-4.0** (historically described as CC-BY-NC-ND — **verify exact terms before reusing diagrams**) | 352,775★ · 2026-03-20 | **watch** — learning ref, not a direct SMB-automation fit |

### 3.2 Proposed pattern-catalog shape (the deliverable)

A small, hand-curated `agent/patterns.yaml` (~10–15 entries) — Scout's own
deterministic pattern store, grounded in EIP/Azure, each entry mapping an
**opportunity type → pattern → n8n archetype → likely catalog tools**:

```yaml
- id: intake-triage
  name: Intake & Triage (Content-Based Router + Message Filter)   # EIP
  opportunity_types: [lead routing, support triage, form intake]
  pillars: [Customer Experience & Marketing, Operations & Efficiency]
  data_flow: trigger -> classify -> route -> notify
  integration_points: [webhook/form, classifier (Claude), CRM/helpdesk, Teams/Slack]
  n8n_archetype: form-to-crm | inbound-email-triage          # -> Track 3 template
  catalog_tools: [power-automate, dynamics-365, hubspot, microsoft-teams, n8n]
- id: scheduled-monitor-report
  name: Scheduled Monitor & Report (Pipes-and-Filters + Aggregator)
  opportunity_types: [competitive monitoring, KPI reporting, alerting]
  pillars: [Data & Decision Intelligence, Cybersecurity & Risk Management]
  data_flow: cron -> fetch -> summarize -> aggregate -> notify/store
  n8n_archetype: scheduled-scrape-summarize-notify
  catalog_tools: [power-bi, snowflake, microsoft-teams, slack, n8n]
- id: event-enrich-sync
  name: Event Enrich & Sync (Content Enricher + Channel Adapter)
  opportunity_types: [data sync, system integration, enrichment]
  data_flow: webhook -> enrich (Claude) -> upsert
  n8n_archetype: webhook-enrich-store
  catalog_tools: [supabase, dataverse, airtable, postgres, n8n]
- id: knowledge-qa
  name: Grounded Q&A (RAG / Scatter-Gather)
  opportunity_types: [internal knowledge, FAQ, doc search]
  n8n_archetype: rag-faq-skeleton
  catalog_tools: [copilot-studio, sharepoint, pgvector, azure-ai, claude-api]
# ...document-approval (Claim-Check), notification-fanout (Publisher-Subscriber), etc.
```

This makes `solution_design` a **lookup + light LLM fill** instead of free-form
generation: `identify_opportunities` already classifies into one of the four
NorthBound pillars; add a deterministic **opportunity→pattern** classifier (rules
or a tiny Haiku call), and the pattern supplies the design skeleton **and** the n8n
archetype for Track 3. It also lowers tokens (the design is mostly templated) and
kills a class of hallucination (the design can only reference catalog tools the
pattern lists).

---

## 4. Track 3 — Real n8n templates (replace the 5 hand-rolled archetypes)

*Plugs into `generate_workflow`.* Today Scout has 5 pinned templates + a
placeholder map. There is a far richer, **importable, programmatically searchable**
corpus available.

### 4.1 The libraries

| Source | Link | Size | Importable JSON? | License | Stars · last commit | Verdict |
|---|---|---|---|---|---|---|
| **Official n8n template API** | `https://api.n8n.io/api/templates/search` + `.../workflows/{id}` · [n8n.io/workflows](https://n8n.io/workflows/) | **10,072** templates (verified live) | **Yes** — `/workflows/{id}` returns the full `nodes[]`+`connections{}` blueprint | n8n templates / SUL (see 4.3) | — (official) | **adopt** — the source of truth |
| **Zie619/n8n-workflows** | [Zie619/n8n-workflows](https://github.com/Zie619/n8n-workflows) | ~2,000+ JSON files + fast search/doc tool | **Yes** (JSON files in-repo) | **MIT** (repo tooling) | 55,096★ · 2026-05-31 | **adopt** — bundle/index offline so runtime never depends on api.n8n.io |
| **enescingoz/awesome-n8n-templates** | [enescingoz/awesome-n8n-templates](https://github.com/enescingoz/awesome-n8n-templates) | 280+, category-organized | Yes | **NOASSERTION** (no clear license — flag before redistribution) | 22,948★ · 2026-06-01 | watch |
| **Danitilahun/n8n-workflow-templates** | [Danitilahun/n8n-workflow-templates](https://github.com/Danitilahun/n8n-workflow-templates) | 2,053, organized + search | Yes | **none declared** | 685★ · 2025-07-11 | watch |

### 4.2 How to index them (the actionable bit)

The official API exposes everything Scout needs to build a local index — verified
live on 2026-06-12:

- `GET https://api.n8n.io/api/templates/search?page=&rows=` →
  `{ totalWorkflows: 10072, workflows: [{ id, name, description, totalViews,
  user, nodes:[…], createdAt, price }], filters: [...] }`. The `filters` block
  gives ready-made facets: **31 categories, 420 apps, 484 node types**.
- `GET https://api.n8n.io/api/templates/workflows/{id}` → the single template with
  the importable `workflow` object (`nodes` + `connections`).

**Proposed pipeline (offline build step, then runtime lookup):**
1. Paginate `/search`, store `{id, name, description, node_types[], apps[],
   category, trigger_type, totalViews}` in a `n8n_templates` table.
2. Derive **trigger type** (cron / webhook / form / email / chat) and **integration
   set** from `node_types`.
3. **Filter to Scout's catalog**: keep templates whose nodes intersect the 43-tool
   catalog (Microsoft 365 / Teams / SharePoint / Power Automate, Slack, Supabase /
   Postgres, HTTP, HubSpot / Dynamics, OpenAI/Claude, pgvector…). This shrinks 10k
   → a few hundred *relevant, on-stack* templates.
4. Tag each with a **Track-2 pattern id** and one of Scout's 5 archetypes.
5. At runtime, `generate_workflow` does: opportunity → pattern → query the index by
   (pattern, trigger, integration ∩ recommended catalog tools) → pick top template
   by relevance×views → fetch its importable JSON → run the **existing** merge +
   `typeVersion`-pinned validator. Keep the current 5 archetypes as the guaranteed
   fallback.
6. **Embed** template `name+description` with `Supabase.ai gte-small` (Track 4) into
   pgvector for semantic "find the closest real workflow" — $0, on-device.

This keeps Scout's hard-won safety (template-fill not free-gen, structural
validation, pinned `typeVersion`, generic credential placeholders) while grounding
generation in **real** workflows. Caveat to engineer around: community templates
use varied `typeVersion`s and many third-party nodes — the existing validator and
the **import smoke test that's still a manual TODO (P8)** become *more* important;
prefer templates whose nodes are core/verified, and re-pin or down-convert
`typeVersion` to the demo's n8n version during the offline build.

### 4.3 Licensing (read before shipping)

- **n8n itself** is **fair-code under the Sustainable Use License (SUL)** — *source-
  available, not OSI-open*. SUL permits **internal business use** and **non-commercial
  distribution**; it forbids selling a product/service whose value *substantially
  depends* on n8n or hosting n8n-as-a-service for a fee
  ([SUL](https://docs.n8n.io/sustainable-use-license/)). For Scout this is **fine**:
  NorthBound self-hosts n8n and generates workflows *for clients to run* — that's
  the intended use. The line you must not cross: don't turn "Scout + hosted n8n"
  into a paid SaaS where n8n is the core value.
- **Template content**: importing/filling a community template and handing it to a
  client is the templates' intended use. Mirroring thousands of them into Scout's
  own repo for redistribution is a grey area — `Zie619` (MIT) covers its *tooling*,
  not necessarily every workflow author's intent. Safest: **index metadata**, fetch
  importable JSON on demand (or bundle only the handful you actually ship), and
  attribute. Flag `enescingoz`/`Danitilahun` as license-unclear.

---

## 5. Track 4 — Cost / compute / latency

*Whole pipeline.* Ranked by savings-per-effort.

### 5.1 Prompt caching — the biggest, cheapest win (effort S)

Mechanics (verified): cache **write** = 1.25× input (5-min TTL) or 2.0× (1-hour
TTL); cache **read** = **0.10× input** (90% off). Breaks even after one read (5-min)
or two reads (1-hour)
([prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)).
Heads-up: the **default TTL silently regressed from 1h to 5m around March 2026**,
so don't assume an hour
([issue #46829](https://github.com/anthropics/claude-code/issues/46829)).

Where Scout already wins and where to extend it:
- SPEC §6.5 already marks the catalog as a cacheable prefix for `map_tools`. But a
  run only calls `map_tools` once, so within a single run that prefix is read ~once
  — limited benefit.
- **The lever: make one shared stable prefix** = (NorthBound context + 4 pillars +
  output conventions + the 43-tool catalog) and attach `cache_control` to it on
  **every** Opus/Haiku node (profile, identify, map, requirements, design, n8n-fill,
  questions, playbook, critique). The nodes self-chain seconds apart, comfortably
  inside the 5-min TTL, so **one cache-write is amortized over ~8–12 reads per
  run**, each at 0.10×. On a stable prefix of a few thousand tokens that's a large,
  reliable input-token cut — and it's the highest-ROI change here.
- For long demo runs (or when a node stalls and cron wakes it >5 min later), opt
  into `ttl:"1h"` (2.0× write) as SPEC already anticipates. Keep recording
  `cache_read_input_tokens` / `cache_creation_input_tokens` (Scout already has the
  columns) so the savings are *measured*, not assumed.
- **Other stable prefixes**: the n8n template/pattern context (Track 2/3) and the
  critique rubric are also static → cache them too.

### 5.2 Native $0 embeddings → semantic/result cache (effort S/M)

**`Supabase.ai.Session('gte-small')` runs embeddings natively inside the Edge
runtime** (ONNX via a Rust binding), **no external API, ~100–200ms CPU, <1s, 384-dim,
free-tier**
([Supabase AI inference](https://supabase.com/blog/ai-inference-now-available-in-supabase-edge-functions),
[example fn](https://github.com/supabase/supabase/blob/master/examples/ai/edge-functions/supabase/functions/generate-embedding/index.ts)).
This is a near-perfect fit: it's already in Scout's runtime, costs $0, adds **no LLM
tokens**, and sits inside the 2s CPU budget.

Use it to build a **native pgvector cache** on the existing Supabase Postgres:
- **Scrape cache** by content-hash — *already implemented* (`scrape_pages`). Keep.
- **Business-profile cache** keyed by normalized domain + content-hash → re-runs of
  the same site skip the Opus profile entirely.
- **Tool-mapping / pattern cache** keyed by opportunity-embedding similarity → near-
  duplicate opportunities reuse a prior mapping (skip a Haiku call).
- **n8n template retrieval** (Track 3) via the same embeddings.

Don't adopt **GPTCache** ([zilliztech/GPTCache](https://github.com/zilliztech/GPTCache),
8,065★, MIT, **Python, last commit 2025-07-11 ≈ 11 months stale**) — it's a Python
service that duplicates what pgvector + `Supabase.ai` already give you natively.
Learn the semantic-cache idea from it; implement it in-stack. (If you ever need a
model other than gte-small, **Transformers.js** runs ONNX models in Deno/Node, but
the native `Supabase.ai` path is simpler and lighter.)

### 5.3 RAG over the catalog — **not worth it yet** (honest reject-for-now)

The intuitive move ("embed the catalog, retrieve top-k tools, stop sending the whole
thing") **loses** here: at **43 tools** the catalog is small, and once it's in the
cached stable prefix (5.1) the marginal cost of sending all of it is only 0.10×.
RAG-trimming risks dropping the *correct* tool from the candidate set, which
directly undermines the strict-enum grounding that prevents hallucinated
recommendations (F4). Verdict: **keep the full cached catalog**; revisit RAG only if
the catalog grows into the hundreds.

### 5.4 Model routing & Batch API (effort S)

- Routing is **already done** (Haiku on nodes 5–10, Opus on 2/3/11) — good. Sanity-
  check that the deterministic-ish nodes (requirements, n8n-fill, questions) really
  need Haiku vs a templated/no-LLM path.
- **Message Batches API = 50% off**, async ≤24h (usually <1h), no quality
  difference ([batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)).
  Incompatible with the interactive single-run latency, but **ideal for the two
  non-interactive paths**: the **nightly LLM-judge evals** (`evals.yml`) and the
  **inbound n8n lead-triage loop** (a Slack ping a few minutes later is fine). Apply
  caching + batch together there.

### 5.5 Edge cold-start & streaming (effort S, modest payoff)

- Keep the Edge bundle small (cold start scales with bundle size); the `pg_cron`
  1-min heartbeat already keeps the function from going fully cold during a run.
- Supabase **Realtime** already streams node progress to the UI — the perceived-
  latency problem is largely solved. Add Anthropic **streaming** on the long Opus
  nodes if you want faster time-to-first-token in the report view. Minor lever; note
  and move on.

### 5.6 Quantified summary

| Technique | Expected saving | Effort | Constraint fit |
|---|---|---|---|
| Shared cached prefix across all nodes | ~90% off input tokens on the shared prefix, ~8–12×/run | S | ✅ pure win |
| Native gte-small + pgvector cache (profile/mapping reuse) | Skips whole Opus/Haiku calls on repeats; $0 embeddings | S/M | ✅ in-runtime, $0, <2s CPU |
| Batch API on evals + inbound triage | 50% off those paths | S | ✅ (async-tolerant only) |
| Content-hash scrape dedupe | already live — avoids re-charging Claude on re-runs | — | ✅ |
| defuddle cleaner extraction (Track 1) | fewer junk input tokens to Opus | S | ✅ |
| RAG-trim catalog | small token save, **hurts grounding** | M | ❌ not yet |

---

## 6. Rejected / not worth it (so you don't re-investigate)

- **ScrapeGraphAI** — LLM-driven extraction *increases* token load; the exact
  opposite of Track 1's thesis. (Great project, wrong goal.)
- **Crawl4AI / trafilatura / Scrapy** — Python; cannot run in a Deno Edge node.
  Only viable as a separate hosted service (breaks $0 / adds infra) or an offline
  build step. trafilatura is worth remembering *if* you ever stand up a Python
  extraction microservice (best extraction quality). Crawl4AI/Scrapy are overkill
  for Scout's small page-cap.
- **SearXNG** — AGPL-3.0 **and** needs its own always-on host; breaks both the $0
  constraint and the MIT/Apache preference for a consulting deliverable.
- **Brave Search API** — free tier **retired ~Feb 2026**; no longer a $0 option.
- **Serper** — cheap/large free tier but built on scraped Google data (ToS/legal
  exposure); inappropriate for a client-facing consultancy tool.
- **OpenCorporates** — downgraded, not rejected: free tier is open-data/journalism-
  only, 500 calls/mo, and the data is share-alike+attribution — awkward to embed in
  a paid report. Use only as opt-in, attributed enrichment.
- **GPTCache** — Python + ~11-months stale; replaced natively by `Supabase.ai`
  embeddings + pgvector.
- **RAG over the 43-tool catalog** — not worth it at this size and it weakens enum
  grounding; prompt-cache the whole catalog instead.
- **donnemartin/system-design-primer** — fantastic learning resource, but it's
  hyperscale system design, not SMB-automation patterns; and its license needs
  checking. EIP + Azure integration patterns are the right vocabulary for Scout.

---

## 7. Open questions & suggested next steps

**Decisions to make before implementation:**
1. **External enrichment yes/no?** Adding a Tavily call deepens grounding but
   introduces a free-tier quota (1k/mo) and a non-$0 dependency. Keep the keyless
   Jina path as default and gate enrichment behind a flag? (Recommended: yes.)
2. **Track-3 indexing: live API vs bundled corpus?** Querying `api.n8n.io` at
   runtime is simplest but adds an external dependency to a node; bundling
   `Zie619`'s JSON makes the demo hermetic. (Recommended: **offline build** an index
   + bundle the ~dozen on-stack templates you'll actually ship; fall back to the
   existing 5 archetypes.)
3. **Pattern catalog ownership** — hand-curate `patterns.yaml` (~12 entries) now, or
   generate it from EIP/Azure? (Recommended: hand-curate; it's small and it's the
   grounding layer — worth being deliberate.)
4. **n8n SUL comfort** — confirm NorthBound is fine using fair-code n8n for client
   delivery (it is, for self-host/internal/deliverable use). Don't position Scout as
   reselling hosted n8n.

**Suggested sequencing (each independently shippable):**
1. **Track 4 prompt caching (shared prefix)** — smallest change, biggest cost win,
   no new deps. Do it first; it also de-risks the token budget for everything else.
2. **Track 1 defuddle swap + deterministic multi-page breadth** — improves grounding
   *and* tokens; low risk.
3. **Track 4 native gte-small + pgvector cache** (profile + mapping reuse) — builds
   the embedding substrate Track 3 also needs.
4. **Track 2 `patterns.yaml`** — the grounding layer that makes Track 3 deterministic.
5. **Track 3 n8n template index** — offline build, map to patterns, reuse the
   existing validator; finally close the still-open **n8n import smoke test (P8)**.
6. **Batch API** on evals + inbound triage — last, opportunistic.

Tracks 2 and 3 are tightly coupled — **pattern → archetype → real template** is one
chain. Doing Track 2 first makes Track 3 a lookup instead of a guess, which is why
the spec's own instruction to "prioritize Track 3 if architecture schemas will be
the basis for the templates" points at doing the small Track 2 catalog first.

---

## 8. Source log (URLs actually fetched/searched on 2026-06-12)

**Track 1 — discovery depth**
- https://github.com/unclecode/crawl4ai · https://api.github.com/repos/unclecode/crawl4ai (68,335★, 2026-06-04, Apache-2.0)
- https://github.com/adbar/trafilatura · https://api.github.com/repos/adbar/trafilatura (6,104★, 2026-06-10, Apache-2.0)
- https://trafilatura.readthedocs.io/en/latest/evaluation.html · https://adrien.barbaresi.eu/blog/evaluating-text-extraction-python.html
- https://github.com/scrapy/scrapy · https://api.github.com/repos/scrapy/scrapy (62,216★, 2026-06-12, BSD-3-Clause)
- https://github.com/ScrapeGraphAI/Scrapegraph-ai · https://api.github.com/repos/ScrapeGraphAI/Scrapegraph-ai (27,130★, 2026-06-11, MIT)
- https://github.com/kepano/defuddle · https://api.github.com/repos/kepano/defuddle (8,076★, 2026-06-06, MIT) · https://www.npmjs.com/package/defuddle · https://defuddle.md/docs
- https://github.com/extractus/article-extractor · https://api.github.com/repos/extractus/article-extractor (1,895★, 2026-05-03, MIT)
- https://github.com/mozilla/readability · https://api.github.com/repos/mozilla/readability (11,269★, 2026-01-21)
- https://github.com/assafelovic/gpt-researcher · https://api.github.com/repos/assafelovic/gpt-researcher (27,664★, 2026-05-28, Apache-2.0) · https://deepwiki.com/assafelovic/gpt-researcher/4.3-deep-research-mode
- https://github.com/dzhng/deep-research · https://api.github.com/repos/dzhng/deep-research (19,107★, 2026-04-11, MIT)
- https://github.com/langchain-ai/open_deep_research · https://api.github.com/repos/langchain-ai/open_deep_research (11,681★, 2026-06-07, MIT)
- https://github.com/stanford-oval/storm · https://api.github.com/repos/stanford-oval/storm (28,356★, 2025-09-30, MIT)
- https://github.com/searxng/searxng · https://api.github.com/repos/searxng/searxng (31,956★, 2026-06-12, AGPL-3.0)
- https://awesomeagents.ai/pricing/search-api-pricing/ · https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/ (Tavily/Exa 1k/mo, Serper 2.5k, Brave free tier retired Feb 2026)
- https://api.opencorporates.com/ · https://blog.opencorporates.com/2025/02/13/getting-started-with-the-opencorporates-api/ (500 calls/mo, 200/day, share-alike)

**Track 2 — reference architectures**
- https://www.enterpriseintegrationpatterns.com/patterns/messaging/ · https://en.wikipedia.org/wiki/Enterprise_Integration_Patterns (65 patterns)
- https://camel.apache.org/components/4.18.x/eips/enterprise-integration-patterns.html (Apache-2.0 EIP impl/docs)
- https://learn.microsoft.com/en-us/azure/architecture/patterns/ · https://learn.microsoft.com/en-us/azure/architecture/patterns/publisher-subscriber
- https://github.com/mspnp/cloud-design-patterns · https://api.github.com/repos/mspnp/cloud-design-patterns (847★, 2026-06-10)
- https://github.com/stn1slv/awesome-integration · https://api.github.com/repos/stn1slv/awesome-integration (535★, 2026-06-12, CC0-1.0)
- https://github.com/mehdihadeli/awesome-software-architecture · https://api.github.com/repos/mehdihadeli/awesome-software-architecture (11,212★, 2026-06-12, CC0-1.0)
- https://github.com/binhnguyennus/awesome-scalability · https://api.github.com/repos/binhnguyennus/awesome-scalability (71,680★, 2026-01-04, MIT)
- https://github.com/donnemartin/system-design-primer · https://api.github.com/repos/donnemartin/system-design-primer (352,775★, 2026-03-20) · https://github.com/donnemartin/system-design-primer/blob/master/LICENSE.txt (LICENSE.txt reads CC-BY-4.0)

**Track 3 — n8n templates**
- https://api.n8n.io/api/templates/search?page=1&rows=2 (verified: totalWorkflows 10,072; filters = 31 categories / 420 apps / 484 node types)
- https://api.n8n.io/api/templates/workflows/11366 (verified: returns importable `workflow` with `nodes` + `connections`)
- https://n8n.io/workflows/
- https://github.com/Zie619/n8n-workflows · https://api.github.com/repos/Zie619/n8n-workflows (55,096★, 2026-05-31, MIT)
- https://github.com/enescingoz/awesome-n8n-templates · https://api.github.com/repos/enescingoz/awesome-n8n-templates (22,948★, 2026-06-01, NOASSERTION)
- https://github.com/Danitilahun/n8n-workflow-templates · https://api.github.com/repos/Danitilahun/n8n-workflow-templates (685★, 2025-07-11, no license)
- https://docs.n8n.io/sustainable-use-license/ · https://github.com/n8n-io/n8n/blob/master/LICENSE.md (Sustainable Use License, fair-code)

**Track 4 — cost / compute / latency**
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching (write 1.25×/2.0×, read 0.10×)
- https://github.com/anthropics/claude-code/issues/46829 (TTL default 1h→5m regression, March 2026)
- https://platform.claude.com/docs/en/build-with-claude/batch-processing (50% off, async ≤24h)
- https://supabase.com/blog/ai-inference-now-available-in-supabase-edge-functions · https://supabase.com/docs/guides/ai/quickstarts/generate-text-embeddings (native `Supabase.ai.Session('gte-small')`, ONNX/Rust, ~100–200ms CPU)
- https://github.com/supabase/supabase/blob/master/examples/ai/edge-functions/supabase/functions/generate-embedding/index.ts
- https://github.com/zilliztech/GPTCache · https://api.github.com/repos/zilliztech/GPTCache (8,065★, 2025-07-11, MIT — stale)
- https://huggingface.co/Supabase/gte-small · https://github.com/koxy-ai/gte-small (Transformers.js gte-small for Deno/Node, alt path)
