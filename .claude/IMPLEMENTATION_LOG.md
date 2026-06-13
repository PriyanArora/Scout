# Scout — Plan-Alignment Implementation Log

**Branch:** `feat/plan-alignment-migration` · **Started:** 2026-06-13
**Source of truth:** `.claude/INTEGRATION_PLAN.md` + `.claude/DECISION_LOG.md` + `.claude/PLANNING_RECONCILIATION.md`
(themselves derived from `findings.md` / `findings-deepdive.md` / `findings-expansion.md`).

This file is the in-repo home for: (1) the drift map measured at start, (2) the ordered
implementation plan, (3) the **resolved pin register** (versions/SHAs the plan left as
`pin@install`), and (4) running status + any plan/constraint conflicts hit during implementation
and how they were resolved. Per the task, there is no separate user-facing report — status lives
here, in `claude/Progress.md`, and in commit messages.

---

## 0. Baseline (verified green before any change)

- `npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` ✓ (158 agent + 26 web + 12 mcp = 196 tests).
- **Deno is NOT installed** in this workspace → the Edge function (`supabase/functions/agent/index.ts`,
  Deno/TS) cannot be typechecked or run locally. Mitigation: every Edge change is mirrored from a
  Node/SDK path that *is* tested, kept to syntactically-conservative TS, and reasoned about explicitly.
  This is recorded as a verification limitation, not a skipped gate.
- Supabase CLI is NOT installed → SQL migrations are verified by inspection + the existing
  `supabase/tests/*.sql` (which are themselves manual-run). Migrations are additive and reversible.

## 1. Resolved pin register (was `pin@install` in the plan)

Resolved 2026-06-13 against the live npm registry / GitHub:

| Integration | Resolved pin | License (npm) | Notes |
|---|---|---|---|
| `defuddle` | `0.18.1` | MIT | Node/JSDOM — Vercel/Node layer + build step, not inlined in Edge |
| `jsonrepair` | `3.14.0` | **ISC** | Resolves the plan's "API NOASSERTION" caveat → npm reports ISC |
| `react-markdown` | `10.1.0` | MIT | web report viewer |
| `remark-gfm` | `4.0.1` | MIT | tables/strikethrough in playbook |
| `@react-pdf/renderer` | `4.5.1` | MIT | PDF export, no headless browser |
| `ipaddr.js` | `2.4.0` | MIT | web SSRF range classification |
| `promptfoo` | `0.121.15` | MIT | CI eval gating (dev-dep) |
| `metascraper` | `5.50.6` | MIT | prototype firmographic pass (Node layer, flag-gated) |
| `rate-limiter-flexible` | `11.2.0` | ISC | prototype P10 rate limit (Postgres store) |
| `czlonkowski/n8n-mcp` | commit `b0f5e25d22c1e28363c27aee160518c301341edc` | MIT | CI/build-time validator only — never a runtime dep |

All pins are exact (no `^`) for Edge/critical-path items per INTEGRATION_PLAN §2.

## 2. Drift map (current state → target), ordered by wave

Legend: 🔴 large/one-way · 🟠 moderate · 🟢 low-risk/additive.

### Wave 0 — storage & reliability hygiene (SQL only)
- 🟢 **LZ4 compression** — current: default pglz TOAST. Target: `SET COMPRESSION lz4` on
  `scrape_pages.markdown`, `reports` jsonb cols, `langgraph_checkpoints.checkpoint`. New migration.
- 🟢 **Terminal-checkpoint drop + TTL** — current: `prune_scout_data()` only deletes expired; finalize
  leaves checkpoints. Target: drop checkpoints for `completed`/`failed` runs; shorten scrape TTL.
- 🟢 **Backoff+jitter** — current: `fail_run_node` sets flat `now()+30s`. Target: `30·2^attempts` ± jitter.

### Wave 1 — token & reliability (Edge `index.ts` + `agent/src`)
- 🟠 **Prompt caching** — current: NO `cache_control` anywhere; each node sends a bespoke `system`.
  Target: shared `buildSystemPrefix()` cacheable block + `cache_control` on all 9 LLM call sites.
- 🟢 **count_tokens preflight** — current: none. Target: `preflightBudget()` in front of profile/identify/critique.
- 🟠 **Structured outputs** — current: prompt-for-JSON + regex `extractJson` + 1 retry. Target: Edge
  `output_config` + strip-unsupported-keywords; SDK `messages.parse`/`zodOutputFormat`.
- 🟢 **jsonrepair** — current: raw `JSON.parse`. Target: repair-before-parse in `parser.ts` + Edge `extractJson`.

### Wave 2 — schema source + MCP
- 🟠 **Zod single source** — current: catalog duplicated 4×; schemas hand-written per consumer.
  Target: `agent/src/schemas/index.ts` → `z.toJSONSchema()` derives Anthropic + MCP + `CATALOG_IDS`.
- 🟠 **MCP modernization** — current: low-level `Server`+`setRequestHandler`+hand-written JSON Schema.
  Target: `McpServer`+`registerTool` (Zod) + `outputSchema`/`structuredContent` + InMemoryTransport test.

### Wave 3 — discovery depth
- 🟢 **defuddle** — current: Edge fallback is `html.replace(/<[^>]+>/g," ")`; `agent/src` has custom htmlToText.
  Target: `extractMainContent()` seam using defuddle in the Node/Vercel layer + build step.
- 🟠 **multi-page breadth** — current: `agent/src` has it; **Edge scrapes one page**. Target: Edge parity, page-capped.
- 🟠 **conditional requests** — current: content-hash only. Target: ETag/Last-Modified + `lastmod`; new `scrape_pages` cols.
- 🟢 **(proto) enrich** — keyless GLEIF/EDGAR/Wikidata + metascraper, flag-gated default-off, cited.

### Wave 4 — pattern grounding → n8n
- 🟠 **patterns.yaml** — current: none. Target: ~12-entry hand-curated file (EIP + Workflow Patterns).
- 🟠 **Edge generate_workflow parity** — current: returns `{archetype,placeholders}`, no merge/validate.
  Target: inline merge + `validateWorkflow` to match `agent/src`.
- 🟠 **offline n8n index** — current: 5 pinned archetypes only. Target: build script + `index.json`, attributed.
- 🟢 **n8n-mcp CI validator** — current: P8 import smoke test OPEN. Target: build-time validator closes it.
- 🟢 **(proto) gte-small** — semantic template retrieval seam.

### Wave 5 — deliverable + security + observability
- 🟢 **react-markdown** — current: raw `<pre>` playbook + `JSON.stringify` for requirements/design.
- 🟢 **react-pdf** — current: P13 export deferred, `export_path` unused. Target: PDF export action.
- 🟢 **ipaddr.js / .strict() / rate-limit** — current: hostname-regex SSRF, permissive webhook `data`, no rate-limit.
- 🟢 **promptfoo** — current: `evals.yml` exists but no promptfoo. Target: CI eval gating.

### Wave 6 — checkpoint slimming (LAST, one-way)
- 🔴 **claim-check** — current: Edge `saveCheckpoint` stores full 60K `scrapeMarkdown` every checkpoint
  (**red-line violation**); `runFinalize` writes both `opportunities` and `ranked` (dup). Target: store
  `scrapePageIds`, rehydrate from `scrape_pages`; de-dup report. Behind green P9 + resume test.

## 3. Conflicts hit during implementation & resolutions

_(appended as encountered)_

- **F-7 pillar-name drift (pre-existing) — RESOLVED (Wave 2).** Zod enum + both identify prompts use the
  short form `Cybersecurity & Risk`; only the catalog YAML `pillars` metadata + SQL seed used the long
  `Cybersecurity & Risk Management`. **Conflict:** `DECISION_LOG.md` calls the *long* form "canonical", but
  the code validates against the *short* form everywhere it matters. **Resolution:** standardised on the short
  form (what's enforced); fixed the 2 YAML entries + SQL seed. The system prefix already used the short form.
- **MCP catalog grounding bug (discovered Wave 2).** `mcp/src/tools/map-tools.ts` carried a separate, wrong
  catalog (`ms-365`, `twilio`, `stripe`, `openai`, …) and did **no** filtering — it could surface
  hallucinated/off-stack tools, violating the grounding red line. Not in the plan as a known issue; fixed by
  canonicalising the list + adding catalog filtering, now guarded by the drift test.
- **Structured outputs on the Edge (Wave 1c).** The plan said "both paths." The Edge is Deno raw-fetch and
  cannot be run/typechecked locally (no Deno), and a malformed `output_config` would fail the *request*
  (unlike response-side jsonrepair). **Resolution:** kept the integration but made `anthropicCall`
  auto-retry once **without** `output_config` on any 4xx, and scoped it to the 2 simplest schemas. Worst
  case degrades to today's behavior — never breaks the demo. Documented, not forced.

## 4. Running status

- [x] **Wave 0** — migration `20260613000200_wave0_storage_reliability.sql`: LZ4 on 11 columns, TTL 30d→14d,
  terminal-checkpoint prune, `fail_run_node` backoff+jitter. P9 test 6 fixed to simulate heartbeat backoff
  wait (latent bug: flat-30s already left lease in the future → re-acquire blocked; tests were manual-only,
  never executed).
- [x] **Wave 1** — both paths. (1a) shared cacheable prefix + cache_control: SDK had caching but the
  breakpoint sat after node-specific text (only same-node retry hits); now an identical prefix block 0 +
  node-specific block 1 → cross-node hits. Edge had NO caching; added `SCOUT_SYSTEM_PREFIX` + `systemWithPrefix`
  on all 9 call sites. (1b) jsonrepair (`3.14.0` SDK dep; `npm:jsonrepair@3.14.0` Edge). (1c) structured outputs:
  SDK `zodOutputFormat` (GA in 0.102; SDK strips subset-banned keywords) on 4 nodes; Edge `output_config` on
  profile + map with auto-retry-without-it on 4xx (safe under no-Deno). (1d) `count_tokens` preflight trims the
  scrape blob on the profile + identify Opus nodes. **Deviations (resolved):** Edge structured outputs scoped
  to the 2 simplest schemas (profile/map) behind the auto-fallback guard rather than all 6 raw-fetch nodes —
  the unverifiable raw-fetch schema risk to the demo is contained by the guard; other Edge nodes rely on the
  adopted jsonrepair net. count_tokens applied to profile+identify (carry the blob), not critique (8K summary).
- [x] **Wave 2** — single catalog source + MCP. Canonical = `agent/src/catalog/data.ts`. The "single source"
  across 5 runtimes that can't share an import (TS, YAML, SQL, Deno-Edge, separate MCP pkg) is enforced by
  `catalog-drift.test.ts`. F-7 reconciled to `Cybersecurity & Risk`. **Found + fixed a grounding-red-line bug:**
  MCP `map-tools` shipped a totally different/wrong catalog (ms-365/twilio/stripe/openai) — replaced with the
  canonical 43 + added filtering. MCP rewritten to `McpServer`/`registerTool` (Zod) + InMemoryTransport round-trip.
- [x] **Wave 3** — discovery depth. defuddle (Node layer, `extractMainContent` seam, fallback-safe).
  Edge multi-page breadth parity (was single-page) page-capped at 4. Conditional-request columns +
  agent/src 304 handling + validator capture. Enrich prototype (Wikidata, default-off, cited).
  **Scope notes:** defuddle stays out of the Edge (no Deno verify); sitemap-`lastmod` crawl and
  metascraper/GLEIF/EDGAR are documented extension points (plan marks them prototype/defer).
- [x] **Wave 4** — patterns.yaml (+TS mirror, grounding/drift tests, wired into selectArchetype). Edge
  generate_workflow parity via generated `n8n.ts` (verified-by-proxy: ported tested logic + byte-identical
  drift-guarded templates — the honest way to land Deno code we can't run). Offline template index
  (shipped-templates + provenance; full corpus = documented offline step). n8n-mcp pinned-SHA CI validator
  (ADR 007) + hermetic importability test CLOSES P8. **#18 gte-small semantic retrieval: deferred prototype**
  (needs Edge embedding runtime; `lookupTemplate` is the implemented non-vector retrieval). Per plan #18 = PROTOTYPE.
- [ ] Wave 5 · [ ] Wave 6 · [ ] Final drift check
