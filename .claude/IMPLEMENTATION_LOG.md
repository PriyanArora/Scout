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

- **F-7 pillar-name drift (pre-existing).** Zod enum says `Cybersecurity & Risk`; catalog YAML/SQL +
  Edge prompt say `Cybersecurity & Risk Management`. The plan flags this must be reconciled to one
  spelling in Wave 2 / before `patterns.yaml`. Resolution recorded when Wave 2 lands.

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
- [ ] Wave 2 · [ ] Wave 3 · [ ] Wave 4 · [ ] Wave 5 · [ ] Wave 6 · [ ] Final drift check
