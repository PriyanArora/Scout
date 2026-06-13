# Scout — Integration Plan (from research findings)

**Status:** PLAN — implementation pending. No application code, migrations, or config changed by this document.
**Date:** 2026-06-12
**Inputs:** `findings.md` (pass 1 — four tracks), `findings-expansion.md` (pass 2 — storage / reliability / security / observability / structured output / MCP / reporting), `findings-deepdive.md` (pass 3 — new/different tools).
**Companion files:** `.claude/DECISION_LOG.md` (every candidate, with critique), `.claude/PLANNING_RECONCILIATION.md` (drift check + follow-ups).

> **Why this file lives under `.claude/` and not `claude/`.** The Likit build-workflow state
> (`claude/Progress.md`, `claude/BuildFlow.md`, …) is the source of truth for *phase gates* and is
> out of scope for this planning task. This file is a forward-looking **architecture plan** for a
> post-P17 scope expansion. It does not advance any gate. Where it implies edits to root docs
> (`SPEC.md`, `docs/`, `claude/Progress.md`), those are listed as follow-ups in
> `.claude/PLANNING_RECONCILIATION.md` and are **not** made here.

---

## 0. The two-runtime fact that shapes every decision

Scout has **two separate node implementations**, and almost every adopted integration must be
landed (or deliberately scoped) in both:

| Path | File(s) | Runtime | How it calls Claude | JSON parsing |
|---|---|---|---|---|
| **Production pipeline** (all 12 nodes) | `supabase/functions/agent/index.ts` | Deno / Edge | raw `fetch` (no SDK, deliberate small bundle) | inline `extractJson` regex |
| **Local / MCP / eval subset** (6 nodes) | `agent/src/**` | Node / TS | `@anthropic-ai/sdk` via `NodeDeps.createMessage` | `parseStructuredOutput` (Zod) |

Consequences encoded throughout this plan:

- **Prompt caching, structured outputs, count_tokens, defuddle, conditional requests** each need an
  **Edge (raw-fetch) variant** *and* an **SDK variant**. The Edge variant is the one that ships in
  the demo; do not let the `agent/src` version drift ahead of it.
- The **production `generate_workflow` is currently weaker than `agent/src`** — the Edge node returns
  `{archetype, placeholders}` and never merges/validates, while `agent/src/n8n/generate.ts` does
  merge + `validateWorkflow`. Bringing the Edge path to parity is a **prerequisite** for any Track-3
  validation work to matter in production (see Wave 4).
- Catalog identity is **duplicated four ways** today: `agent/catalog.yaml`,
  `supabase/seed/001_catalog.sql`, the inline `CATALOG_IDS` array in the Edge function, and
  `agent/src/utils/catalog.ts`. The Zod-single-source work (Wave 2) collapses this.

---

## 1. Hard constraints (restated — the plan must hold all of these)

These are non-negotiable. Any step that breaks one is wrong by definition; the Decision Log rejects
or downgrades several findings precisely on these grounds.

1. **$0/month infra.** Supabase Free (500 MB DB, 500K Edge invocations/mo) + Vercel Hobby. **Claude
   tokens are the only acceptable marginal cost.** No new always-on host, no second paid vendor in
   the core path.
2. **Token budget ~30K–60K/run.** Prefer integrations that **offload work off the LLM**. Anything
   that *adds* net model load is a regression unless it removes more than it adds.
3. **~110s per-node wall budget** (`WALL_BUDGET_MS = 100_000`, `LEASE_SECONDS = 120`), **2s CPU**.
   Nodes self-chain on Edge. Long/recursive work must be **async or precomputed offline**.
4. **Runtime fit:** Deno/TS (Edge) and Node/TS (Vercel). **Python-only tools are rejected** unless
   expressible as a free-tier service (breaks $0 → effectively rejected) or an **offline build step**.
5. **License:** MIT/Apache/BSD preferred. Copyleft (AGPL) and source-available (n8n SUL,
   microservices.io ©) are flagged and either justified or rejected.
6. **Grounding is sacred.** Catalog enum grounding, citation-to-source, generic credential
   placeholders, "scraped content is data, not instructions" — no integration may weaken these.
   (This is why RAG-trimming the 43-tool catalog is **rejected**, not adopted.)

### New env / config / license obligations introduced by this plan

All optional and **default-off** so the keyless, $0 core path is unchanged:

| New flag / config | Purpose | Default | Obligation |
|---|---|---|---|
| `SCOUT_ENRICH_ENABLED` | gate the firmographic enrich step (Track 1) | off | keeps core keyless |
| `SCOUT_EDGAR_USER_AGENT` | descriptive UA required by SEC EDGAR (bare fetch 403s) | unset | EDGAR ToS |
| `TAVILY_API_KEY` | optional bounded external search (1k/mo free) | unset | non-$0 if used; flag it |
| `HELICONE_API_KEY` / `LANGFUSE_*` | optional tracing | unset | 2nd vendor; demo skips it |
| n8n template bundle | redistribute only the handful actually shipped; attribute authors | — | n8n SUL + author intent |
| Pattern vocabulary | EIP/Camel (Apache-2.0, attribute), Azure docs (CC-BY-4.0, cite), microservices.io (**names only — © prose**) | — | see Decision Log §Track 2 |

---

## 2. The core rule: clone/install & adapt, never reimplement

For **every adopted package/repo**, the implementer must **acquire the upstream artifact and plug it
in behind a thin Scout adapter** — not hand-rewrite it. Pin exactly; record provenance.

- **Maintained package →** `npm i <pkg>@<pinned>`; record the **resolved version + integrity hash**
  in the workspace `package-lock.json`. Pin exact (no `^`) for anything in the Edge/critical path.
- **Repo without a usable package →** `git clone` / vendor under `vendor/<name>` or
  `third_party/<name>`, pinned to a **specific commit SHA** captured at vendor time, with a
  `PROVENANCE.md` (source URL, SHA, license, retrieval date).
- **Wrap upstream behind a Scout-side adapter** (one seam per integration) so upstream stays
  pullable. **Forbid** copy-pasting upstream source into Scout files to reskin it.

> The version/SHA cells below say **`pin@install`** where I cannot verify a live version without
> fabricating it. The implementer must resolve and record the exact value at install time. Repo
> provenance (URL, license, last-push date *as of 2026-06-12* from the findings) is given so the pin
> is anchored, not invented.

### 2.1 Clone/install register (adopted packages & repos)

| Integration | Acquire | Pin | License / attribution | Scout integration point | Adapter seam |
|---|---|---|---|---|---|
| Anthropic prompt caching | API field (`cache_control`) | n/a (API) | first-party | `anthropicCall` (Edge) + `createMessage` callers (`agent/src`) | a shared `buildSystemPrefix()` module returning a cacheable block |
| Anthropic structured outputs | API field (`output_config`) | n/a (API) | first-party | Edge `anthropicCall` body + `agent/src` `parseStructuredOutput` | `withStructuredOutput()` helper + `stripUnsupportedKeywords()` |
| Anthropic `count_tokens` | `POST /v1/messages/count_tokens` | n/a (API) | first-party | front of Edge Opus nodes (profile/identify/critique) | `preflightBudget()` guard |
| Anthropic Batch API | `/v1/messages/batches` | n/a (API) | first-party | CI evals + n8n inbound-triage **only** | non-interactive paths |
| `defuddle` | `npm i defuddle@pin@install` | exact | MIT | Edge `runScrapeSite` direct-fetch fallback + `agent/src/scrape/direct-fetch.ts` | `extractMainContent()` in scrape layer |
| `czlonkowski/n8n-mcp` | vendor or `npx` at build time | commit SHA `pin@install` | MIT | **CI / offline** validator over generated workflow JSON; node-schema export into `agent/src/n8n` | `validateWorkflowSchemas()` build step — **not** a runtime dep |
| Official n8n template API + `Zie619/n8n-workflows` | offline build script (fetch) + vendor a small bundle | corpus snapshot date + per-template id | n8n SUL (deliverable use OK; attribute) | `agent/n8n_templates/index.json` + bundled templates; `generate_workflow` lookup | `n8nTemplateIndex` adapter |
| `Supabase.ai.Session('gte-small')` | native Edge runtime | platform | Apache-2.0 (platform) | Edge / build-time embeddings for **template retrieval** | `embed()` helper |
| Postgres LZ4 | `ALTER … SET COMPRESSION lz4` | n/a (PG ≥14) | n/a | migration on `scrape_pages.markdown`, `reports.*` jsonb, `langgraph_checkpoints.checkpoint` | migration |
| `zod` `z.toJSONSchema()` | already in repo (Zod 4.4.3) | in-repo | MIT | `agent/src/schemas/index.ts` becomes single source | `toAnthropicSchema()` / `toMcpSchema()` derivations |
| `@modelcontextprotocol/sdk` `McpServer` | already in repo (`^1.29.0`) | stay on 1.x | MIT | rewrite `mcp/src/index.ts` | `registerTool` + Zod |
| MCP Inspector / InMemoryTransport | `npx @modelcontextprotocol/inspector` / SDK export | pin@install | MIT | dev + Vitest round-trip test | test harness |
| `react-markdown` (+ `remark-gfm`) | `npm i` | exact | MIT | `web/src/components/report-viewer.tsx` (playbook render) | `<Markdown>` wrapper |
| `@react-pdf/renderer` | `npm i` | exact | MIT | new export action (uses `reports.export_path`); render in Next.js/Vercel layer | `ReportPdf` component |
| `promptfoo` | dev-dep / GH Action | pin@install | MIT | `.github/workflows/evals.yml` + config | CI eval job |
| `jsonrepair` | `npm i` | exact | ISC (**verify — API says NOASSERTION**) | `agent/src/utils/parser.ts` + Edge `extractJson` | repair-before-parse step |
| `ipaddr.js` | `npm i` | exact | MIT | `web/src/lib/url.ts` `assertSsrfSafe` | `classifyIp()` |
| `stn1slv/awesome-integration` | reference only (authoring `patterns.yaml`) | n/a | CC0-1.0 | research input, not shipped | — |

**Prototype-tier packages** (spike behind a flag; same pinning rules apply when promoted):
`cockatiel` (MIT), `rate-limiter-flexible` (ISC), `jsondiffpatch` (MIT), `metascraper` (MIT, Node/Vercel
layer only), `evalite` (MIT), `docx` (MIT), `Helicone`/`Langfuse` SDK (Apache-2.0 / MIT-core).

---

## 3. Sequenced architecture changes (waves)

Ordered so foundational, low-risk, $0 wins land first and de-risk the token budget before anything
depends on them. Each wave notes **what it can break**, **how it's verified**, and whether it's
**reversible** or a **one-way door**. "Both paths" = land in Edge *and* `agent/src`.

### Wave 0 — Pure $0 storage & reliability hygiene (no behavior change, no new deps)
1. **LZ4 compression** on the big TOAST columns. *Breaks:* nothing (future writes only; backfill with
   no-op `UPDATE` if immediate effect wanted). *Verify:* `\d+` shows `lz4`; table size drops after
   backfill. **Reversible.**
2. **Eager terminal-checkpoint drop + shorter `scrape_pages` TTL** in `prune_scout_data()` / at
   finalize. *Breaks:* resume-after-completion (intended — terminal runs don't resume). *Verify:*
   checkpoint rows for `completed`/`failed` runs are gone; prune job green. **Reversible.**
3. **SQL exponential backoff + jitter** in `fail_run_node` (replace flat `now() + 30s`). *Breaks:*
   retry cadence (intended). *Verify:* P9 lease test still green; observed `lease_until` grows with
   `attempts`. **Reversible.**

### Wave 1 — Token & reliability wins (highest ROI, both paths)
4. **Shared cached system prefix** with `cache_control` on every Opus/Haiku node. *Breaks:* prompt
   structure on all 9 LLM call sites; a sub-minimum prefix silently caches nothing (see §4). *Verify:*
   `cache_read_input_tokens` > 0 on nodes 3–11 of a single run; measured input-token drop. **Reversible.**
5. **`count_tokens` pre-flight guard** in front of the three Opus nodes. *Breaks:* adds one network
   round-trip/node (within budget). *Verify:* over-budget assemblies are trimmed before send; no more
   `413`/`max_tokens` truncation retries on the 60K-scrape nodes. **Reversible.**
6. **Structured outputs** on both paths (Edge: hand-rolled `output_config` + strip-unsupported-keywords;
   SDK: `messages.parse()` + `zodOutputFormat`). *Breaks:* JSON-Schema **subset** rejects
   `min/max/format/url` — wire schema must be stripped, full Zod validated client-side after. *Verify:*
   parse-failure branch stops firing; fewer reissued calls. **Reversible per node**, but the schema-subset
   adaptation is sticky.
7. **`jsonrepair`** safety net between `extractJson` and `JSON.parse` (covers `max_tokens` truncations
   even after #6). *Verify:* a truncated fixture parses instead of erroring. **Reversible.**

### Wave 2 — One schema source + MCP modernization (DRY, both paths)
8. **`z.toJSONSchema()` single source** in `agent/src/schemas/index.ts`; derive Anthropic
   `output_config`, MCP `inputSchema`, and the Edge `CATALOG_IDS`. *Breaks:* any place that relied on
   hand-written schema drift. *Verify:* one catalog list; MCP + Anthropic schemas regenerate from Zod.
   **Reversible.**
9. **MCP → `McpServer` + `registerTool`** (Zod schemas from #8), add `outputSchema`/`structuredContent`,
   wire **InMemoryTransport** round-trip test + **Inspector** in the dev loop. Stay on SDK 1.x.
   *Verify:* 5 tools list/call round-trip in Vitest. **Reversible.**

### Wave 3 — Discovery depth, off-model (Track 1, both paths + Vercel layer)
10. **`defuddle`** replaces the naive `html.replace(/<[^>]+>/g," ")` fallback. *Breaks:* fallback
    output shape; **Deno-Edge compat is unverified** (jsdom/linkedom) — verify under `npm:` or run the
    cleaner in the Node layer / build step. *Verify:* fewer junk input tokens reaching Opus on a
    direct-fetch fixture. **Reversible.**
11. **Deterministic multi-page breadth** — read `sitemap.xml`/`robots.txt`, raise `maxPages` (>1),
    keep the high-signal link regex. Bring the **Edge** path to parity (it scrapes one page today).
    *Breaks:* per-run wall budget if uncapped — **must stay page-capped**. *Verify:* home/about/services
    fetched deterministically, zero extra LLM tokens. **Reversible.**
12. **Conditional requests + `lastmod` incremental crawl** — store `ETag`/`Last-Modified`, send
    `If-None-Match`/`If-Modified-Since`; `304` skips body + downstream LLM. *Breaks:* requires new
    `scrape_pages` columns (migration). *Verify:* re-run of an unchanged site does near-zero scrape and
    zero LLM. **Reversible.**
13. *(prototype, flag-gated, default off)* **`metascraper` firmographic pass** (Node/Vercel layer) +
    **keyless firmographic enrich** (GLEIF/EDGAR/Wikidata → one Haiku summarize, with citations).
    *Breaks:* deliverable correctness if uncited — **must cite**. *Verify:* with flag on, 4–6 structured
    fields land in `business_profile` with sources; with flag off, path is identical to today. **Reversible.**

### Wave 4 — Pattern grounding → real n8n generation (Tracks 2 + 3, the coupled chain)
14. **`agent/patterns.yaml`** (~12 hand-curated entries): opportunity-type → pattern → `control_flow`
    (Workflow Patterns) → n8n archetype → likely catalog tools. *Breaks:* `solution_design` /
    `generate_workflow` become lookup-driven — once downstream depends on pattern ids, renaming hurts
    (**moderately one-way**). *Verify:* each entry references only catalog tool ids; a pattern classifier
    (rules or tiny Haiku) maps each opportunity to exactly one pattern. 
15. **Edge `generate_workflow` parity** — merge + `validateWorkflow` inline (match `agent/src`).
    *Breaks:* production now emits validated JSON (intended). *Verify:* validator runs in the Edge node.
    **Reversible.**
16. **Offline n8n template index** — build script paginates the official API, filters to the
    catalog-mappable subset (Slack/Notion/Outlook/HubSpot deep; Power Platform thin → stays
    *recommendation*, not artifact), tags each with a pattern id + archetype, **bundles only the dozen
    actually shipped**; `generate_workflow` looks up by (pattern, trigger, tools), falls back to the 5
    pinned archetypes. *Breaks:* license posture (see Decision Log) — **one-way-ish** (vendoring carries
    attribution/redistribution obligations). *Verify:* index builds offline; runtime never calls
    `api.n8n.io`. 
17. **`n8n-mcp` as a build-time / CI validator** over generated workflows (+ optional node-schema export
    to ground selection). *Breaks:* nothing at runtime (no runtime dep). *Verify:* **finally closes the
    open P8 import smoke test** — generated JSON validates against real node schemas in CI. **Reversible.**
18. *(prototype)* **`Supabase.ai` gte-small + pgvector** for semantic "closest real workflow"
    retrieval only. *Breaks:* adds a vector column/index (migration). *Verify:* template lookup returns
    on-stack matches; $0 on-device embeddings. **Reversible** (drop the column).

### Wave 5 — Report deliverable + security + observability (mostly Vercel/CI)
19. **`react-markdown`** for the playbook (currently raw `<pre>`, per findings — confirm in
    `report-viewer.tsx`) + structured render of requirements/design. *Verify:* markdown renders;
    no `JSON.stringify` in `<pre>`. **Reversible.**
20. **`@react-pdf/renderer`** export (closes deferred P13; uses `export_path`; render in Vercel layer,
    no headless browser). *Verify:* a report exports to PDF on Hobby with no cold-start browser.
    **Reversible.**
21. **Security hardening:** `ipaddr.js` range classification on the web SSRF path; `.strict()` on the
    webhook Zod schema; *(prototype)* `rate-limiter-flexible` (Postgres store) to close the
    unimplemented P10 rate-limit; *(prototype)* `seen_signatures` replay table. **Document the Edge
    DNS-rebinding residual** (Edge `fetch` can't pin resolved IPs). *Verify:* decimal/octal/hex IP SSRF
    payloads now rejected on the web path; webhook rejects unknown keys. **Reversible.**
22. **`promptfoo` into `evals.yml`** (regression gating: citations map to source, tool ids ∈ catalog,
    no hallucinated tools, n8n importability) + **Batch API** for any model-graded judge; *(prototype)*
    `jsondiffpatch` version-diff; *(prototype)* Helicone async tracing. *Verify:* CI eval job runs on PRs
    at $0. **Reversible.**

### Wave 6 — Checkpoint slimming (sequenced LAST behind green P9 tests — touches durable runtime)
23. **Claim-check checkpoint slimming** — store `scrapePageIds` in the checkpoint, **not**
    `scrapeMarkdown`; rehydrate from `scrape_pages` on resume. **De-dup** `reports.opportunities` vs
    `reports.ranked`. *Breaks:* resume/recovery correctness — **this is the one change that can corrupt
    a live run**, so it ships only with `supabase/tests/p9_lease_tests.sql` green and a
    resume-from-mid-pipeline test added. **One-way door** (changes the durable state contract).
    *Note:* this also **fixes an existing red-line violation** — today's Edge `saveCheckpoint` stores the
    full 60K markdown in every checkpoint, contradicting the SPEC red line *"Do not store raw scraped
    pages inside every checkpoint"* and the ProjectSummary claim that checkpoints hold page IDs.

> **Sequencing rationale.** Waves 0–2 are pure $0 wins with no behavioral risk and de-risk the token
> budget. Wave 1's caching is the single biggest lever and must precede anything that adds prefix
> tokens. Tracks 2→3 are one chain (pattern → archetype → real template → validation), so the small
> pattern vocabulary (Wave 4 #14) lands before the template index and the `n8n-mcp` validator that
> depend on it. Checkpoint slimming is **last** because it is the only change to the durable runtime
> and the only true one-way door in the durability layer.

---

## 4. Implementation gotchas the plan must carry forward

- **Prompt-cache minimum prefix size.** A `cache_control` breakpoint under the model minimum
  (~1024 tokens; Haiku-tier historically higher) **silently caches nothing**. The shared prefix
  (NorthBound context + 4 pillars + output conventions + the **fuller** catalog — names + `what_it_does`,
  not just ids) must clear the minimum, or the "biggest win" is a no-op. Opus and Haiku have
  **separate caches**, so the prefix amortizes within each model's nodes, not across them.
- **Default TTL regressed 1h→5m (~Mar 2026).** Don't assume 1h. Nodes self-chain seconds apart so the
  5-min TTL is fine; for stalls recovered by cron >5 min later, opt into `ttl:"1h"` (2.0× write).
  Consider `max_tokens:0` cache pre-warm to remove first-request miss latency.
- **Structured-outputs schema subset.** No `minimum/maximum/minLength/maxLength/multipleOf`, no
  `format`/`url`, no recursion; `additionalProperties:false` required on every object. Strip these from
  the **wire** schema; keep full Zod validation client-side. First request per schema pays a one-time
  compile (24h schema cache).
- **`defuddle`/`metascraper` are Node/JSDOM** — Deno-Edge compat unverified. Prefer running them in the
  **Vercel/Node layer or an offline build step**; only inline in the Edge node after verifying under
  `npm:`.
- **n8n template `typeVersion` drift.** Community templates use varied `typeVersion`s and third-party
  nodes. The offline build must **re-pin / down-convert** to the demo's n8n version, and prefer
  core/verified nodes. The existing validator + the new `n8n-mcp` check are what make this safe.
- **EDGAR requires a descriptive `User-Agent`** (bare fetch 403s). Wikidata/GLEIF are keyless/CC0.
- **`/share` ISR must be tag-revalidated** keyed to report id and **purged on edit and on share-revoke**
  — otherwise a stale or revoked report is served (a security regression, not just staleness).
- **Edge SSRF residual.** Even with `ipaddr.js` on the web path, the Edge `fetch` can't pin the
  resolved IP, so DNS-rebinding can't be fully closed in the Edge runtime. Document it; don't pretend
  it's solved.

---

## 5. Scope & state (this expansion)

- **Pre-expansion baseline:** P1–P16 complete; **P17 (deploy + rehearsed demo) in progress**; the
  12-node pipeline is implemented and green in CI. Open manual items: live deploy, and the **P8 n8n
  import smoke test** (still a TODO — Wave 4 #17 closes it).
- **This plan changes scope.** It is an architecture expansion layered on top of a working P17 system,
  not a new gate. **Implementation is pending** — nothing here is built yet.
- **Root-doc state files (`claude/Progress.md`, `claude/progress_manual.md`, `SPEC.md`, `docs/`) are
  intentionally NOT edited by this task.** Their required updates are listed as follow-ups in
  `.claude/PLANNING_RECONCILIATION.md`.

See `.claude/DECISION_LOG.md` for the per-candidate adopt/prototype/defer/reject calls and critique,
and `.claude/PLANNING_RECONCILIATION.md` for the findings cross-check and the no-drift confirmation.
