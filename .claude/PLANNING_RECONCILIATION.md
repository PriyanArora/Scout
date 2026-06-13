# Scout — Planning Reconciliation (no-drift check)

**Date:** 2026-06-12 · **Re-read against:** `findings.md`, `findings-deepdive.md`, `findings-expansion.md`
**Confirms:** `.claude/INTEGRATION_PLAN.md` + `.claude/DECISION_LOG.md` represent the findings faithfully —
no misattribution, no invented tools, every item accounted for, all hard constraints intact.

---

## 1. Adopted findings → represented in the plan (source · pin · integration point · license)

Each ADOPT below is traceable to a specific finding and carries a pin mechanism, an integration
point, and a license note. `pin@install` = resolve & record the exact version/SHA at install time
(see `INTEGRATION_PLAN.md` §2 for why not invented here).

| Adopted item | Findings source | Pin | Integration point | License note |
|---|---|---|---|---|
| Prompt caching (shared prefix) | findings.md §1/§5.1 | API field | Edge `anthropicCall` + `agent/src` `createMessage`; `buildSystemPrefix()` | first-party |
| Structured outputs | expansion §1/§6.1 | API field | Edge body + `agent/src` `parseStructuredOutput`; strip-keywords helper | first-party |
| `count_tokens` pre-flight | deepdive §1/§5.1 | API endpoint | front of 3 Opus nodes | first-party |
| Message Batches API | findings.md §1/§5.4 | API endpoint | CI evals + n8n inbound-triage only | first-party |
| defuddle | findings.md §1/§2.1 | `defuddle@pin@install` (exact) | Edge `runScrapeSite` fallback + `agent/src/scrape/direct-fetch.ts` | MIT |
| Multi-page breadth | findings.md §1/§2.4 | technique | `agent/src/scrape/index.ts` + Edge parity | n/a |
| Conditional requests + `lastmod` | deepdive §1/§5.2 | technique (RFC 9110) | `scrape/cache.ts` + new `scrape_pages` cols | n/a |
| `patterns.yaml` (EIP) | findings.md §3 | vocabulary | new `agent/patterns.yaml`; `solution_design`/`generate_workflow` | EIP names free; Camel docs Apache-2.0 (attribute) |
| `patterns.yaml` `control_flow` (Workflow Patterns) | deepdive §3 | vocabulary | `control_flow:` field in `patterns.yaml` | concept (cite Wikipedia + 2003 paper) |
| czlonkowski/n8n-mcp | deepdive §1/§4.1 | commit SHA `pin@install` | **CI/build-time** validator; node-schema export | MIT |
| Official n8n template API | findings.md §4 | corpus snapshot date | offline build → `agent/n8n_templates/index.json` | n8n SUL (deliverable use; attribute) |
| Zie619/n8n-workflows | findings.md §1/§4.1 | per-template id + snapshot | offline corpus, ship-only-filled | MIT (tooling); attribute authors |
| Supabase.ai gte-small | findings.md §1/§5.2 | platform | Edge/build embeddings for template retrieval | Apache-2.0 (platform) |
| Postgres LZ4 | expansion §1/§2.2 | n/a (PG≥14) | migration on 3 TOAST columns | n/a |
| Checkpoint slimming + report de-dup | expansion §1/§2.1 | pattern | Edge `saveCheckpoint`/`runFinalize` (Wave 6, behind P9 tests) | n/a |
| TTL/pruning | expansion §2.3 | pattern | `prune_scout_data()` + finalize | n/a |
| Zod `z.toJSONSchema()` single source | expansion §1/§6.2 | in-repo (Zod 4.4.3) | `agent/src/schemas/index.ts` → 3 consumers | MIT |
| MCP `McpServer`/`registerTool` | expansion §1/§7 | SDK `^1.29.0` (stay 1.x) | rewrite `mcp/src/index.ts` | MIT |
| MCP Inspector + InMemoryTransport | expansion §7 | `pin@install` | dev + Vitest round-trip | MIT |
| react-markdown (+remark-gfm) | expansion §1/§8 | exact | `web/.../report-viewer.tsx` | MIT |
| @react-pdf/renderer | expansion §1/§8 | exact | export action (Vercel layer; `export_path`) | MIT |
| promptfoo | expansion §1/§5 | `pin@install` | `.github/workflows/evals.yml` | MIT |
| jsonrepair | expansion §1/§6.3 | exact | `agent/src/utils/parser.ts` + Edge `extractJson` | **ISC — verify (API: NOASSERTION)** |
| SQL backoff + jitter | expansion §3 | SQL | `fail_run_node` | n/a |
| `.strict()` webhook schema | expansion §4 | in-repo (Zod) | `WebhookPayloadSchema` + handler | MIT |
| ipaddr.js | expansion §4 | exact | `web/src/lib/url.ts` (web path) | MIT |
| stn1slv/awesome-integration | findings.md §3.1 | reference | authoring `patterns.yaml` (not shipped) | CC0-1.0 |
| CSS `@media print` baseline | expansion §8 | n/a | print stylesheet | n/a |

**All 24 ADOPT items trace to a real finding. No tool in the plan is absent from the findings.**

---

## 2. Rejected / deferred findings → recorded with a reason

Spot-check that every REJECT/DEFER has an explicit, constraint-grounded reason in
`DECISION_LOG.md` (full text there):

- **Runtime ($0 / Deno-TS):** Scrapy, ScrapeGraphAI, Crawl4AI, trafilatura, crawlee, LLMLingua-2, GPTCache,
  DBOS, graphile-worker, puppeteer-PDF, Common-Crawl-CDX-at-runtime — all rejected/deferred on runtime/$0.
- **License:** SearXNG (AGPL+host), Serper (scraped Google), donnemartin (CC-BY-NC-ND?), microservices.io prose (©),
  enescingoz/Danitilahun/wassupjay (unclear → reference-only) — all flagged.
- **Grounding/correctness:** RAG-trim catalog (rejected — weakens enum grounding), profile/mapping semantic
  cache (deferred ▲ — deliverable-correctness risk).
- **Redundant / not-strictly-better:** instructor-js, BAML, Valibot, ajv, tokenlens, p-retry, upstash/semantic-cache,
  Vercel AI SDK (as dep), pgmq, @upstash/ratelimit, Transformers.js, Azure/microservices.io beyond names,
  alternate extractors (article-extractor/readability/turndown/dom-to-semantic-markdown), Brave (free tier gone).

**No finding was silently dropped.** Every candidate named across the three files appears in the
Decision Log with a verdict; ambiguous "watch" items from the findings were resolved to **DEFER (with a
revisit trigger)** or **DEFER (reference only, no redistribution)** rather than left unstated.

---

## 3. No misattribution / no invented tools

- Every package/repo, star count band, license, and last-push date in the plan is copied from the
  findings' own source logs (themselves pulled from the live GitHub API on 2026-06-12). Where the
  findings flagged a license as uncertain (jsonrepair ISC vs API-NOASSERTION; aws-samples MIT-0 vs
  API-NOASSERTION; restyler/wassupjay no-license), the plan **carries the same caveat** rather than
  asserting certainty.
- **No tool appears in the plan that is not in the findings.** The only Scout-authored *new* artifacts
  named (`agent/patterns.yaml`, the offline n8n index, the `buildSystemPrefix`/strip-keywords/adapter
  seams) are clearly Scout-side glue, not third-party tools attributed to anyone.
- Exact versions/SHAs are deliberately left as `pin@install` rather than fabricated — see
  `INTEGRATION_PLAN.md` §2.

---

## 4. Hard-constraint compliance across the updated plan

| Constraint | Holds? | Evidence |
|---|---|---|
| **$0/mo infra** | ✅ | No new always-on host. Tracing/enrich/Tavily are optional, default-off. Rejections of SearXNG/Brave/Upstash/hosted-Python protect this. |
| **30–60K tokens/run** | ✅ | Net token *reducers* dominate adopts (caching, defuddle, count_tokens guard, structured-outputs fewer retries, deterministic breadth). RAG-trim rejected; the only adds (enrich/compress) are flag-gated + bounded. |
| **110s/node wall, 2s CPU** | ✅ | n8n-mcp is build-time; template index is offline; crawlee/Crawl4AI deferred; deep-research used as *pattern* only. gte-small fits the 2s CPU budget. |
| **Deno+Node/TS runtime** | ✅ | All Python tools rejected/deferred. defuddle/metascraper flagged Node-layer/offline pending Deno verification. |
| **MIT/Apache/BSD pref** | ✅ | Copyleft/SUL/© items flagged: n8n SUL justified (deliverable use), microservices.io names-only, AGPL rejected. |
| **Grounding sacred** | ✅ | Catalog enum grounding preserved (RAG-trim rejected); generic credential placeholders + citation checks reinforced (promptfoo); structured outputs strengthen, not weaken, schema validity. |

The one change that touches a **red line** — checkpoint markdown bloat — *fixes* a current violation
(see Decision Log Area A) and is sequenced last behind green P9 tests.

---

## 5. Root-doc follow-ups — RESOLVED by the implementation (Task #5)

The plan-alignment implementation landed all waves; the root-doc follow-ups are now closed:

- **F-1 — `SPEC.md`:** ✅ added the "M8 — Post-P17 research-driven expansion (implemented)" section.
  Prompt caching/structured outputs are now actually in code, so SPEC's earlier descriptions are accurate.
- **F-2 — `docs/ARCHITECTURE.md`:** ✅ `scrape_site` line updated (defuddle + multi-page + conditional);
  `generate_workflow` line updated (patterns.yaml + merge/validate + index); token/reliability layer added.
- **F-3 — `docs/RUNBOOK.md`:** ✅ added optional expansion env, the two new migrations (LZ4/TTL/backoff,
  conditional cols), the offline `build:n8n-index`/`build:edge-n8n` steps, and the n8n-mcp CI validator.
- **F-4 — `README.md`:** ✅ quadrant naming corrected to `fill-in`/`thankless` (matches the Zod enum);
  limitations note PDF export is available + defuddle fallback.
- **F-5 — `docs/SECURITY.md`:** ✅ ipaddr.js SSRF upgrade + the Edge DNS-rebinding residual documented.
  Rate-limiting (P10) remains a documented deferred prototype (web uses PostgREST not a pg pool).
- **F-6 — `docs/adr/`:** ✅ ADR 007 (n8n-mcp validation) added. Prompt-caching/structured-outputs/
  checkpoint-slimming designs are documented inline (code comments + `.claude/IMPLEMENTATION_LOG.md`);
  further standalone ADRs are optional.
- **F-7 — Pillar drift:** ✅ RESOLVED (Wave 2) — standardised on `Cybersecurity & Risk` (the validated
  Zod enum + both identify prompts); fixed catalog.yaml + SQL seed. (Note: this *diverges* from the
  Decision Log's claim that the long form was "canonical" — the code enforces the short form. See
  `.claude/IMPLEMENTATION_LOG.md` §3.)

### Implementation deviations from the plan (all documented, none forced)

- **Edge structured outputs** scoped to the 2 simplest schemas behind an auto-retry-without-it guard
  (the Edge is Deno/raw-fetch and unrunnable locally; a malformed `output_config` fails the *request*).
  Other Edge nodes rely on the adopted jsonrepair net.
- **defuddle** runs in the Node/Vercel layer only (Deno-Edge compat unverified per the plan's own gotcha).
- **Message Batches API** (evals/triage): documented in `promptfooconfig.yaml`; not wired (the LLM-judge
  workflow was itself deferred at P16, and promptfoo's interactive provider doesn't batch).
- **gte-small semantic template retrieval** (#18): deferred prototype — needs the Edge embedding runtime;
  `lookupTemplate` is the implemented non-vector retrieval.
- **rate-limiter-flexible / seen_signatures / jsondiffpatch / Helicone**: PROTOTYPE per the plan — left as
  documented seams (env in `.env.example`); the ADOPT security items (ipaddr.js, `.strict()`) shipped.
- **Edge `generate_workflow` parity**: ported templates+merger+validator into a generated module verified
  "by-proxy" (logic ported from unit-tested agent/src; template data drift-guarded byte-for-byte), since
  Deno isn't runnable here.

A **MCP grounding bug** not anticipated by the plan was found and fixed during Wave 2: `mcp/src/tools/map-tools.ts`
shipped a separate, wrong catalog (ms-365/twilio/stripe/openai) with no filtering — now canonical + filtered.

---

## 6. `claude/` (lowercase) workflow files updated this task

At the user's explicit request, the Likit build-workflow state was updated **additively** to account
for the scope change (no contradiction with `SPEC.md`, no gate advanced):

- **`claude/Progress.md`** — session note + a new **"Post-P17 Expansion Backlog (planned — implementation
  pending)"** appendix mirroring the Integration Plan waves; P17 status unchanged.
- **`claude/progress_manual.md`** — new manual/env/migration items the expansion introduces (new secrets,
  LZ4 migration, offline n8n-index build, n8n-mcp CI import smoke test).
- **`claude/ProjectSummary.md`** — a clearly-labeled "Planned Expansion (post-P17)" addendum pointing to
  `.claude/INTEGRATION_PLAN.md`.

No application source, migrations, config, or dependency manifests were changed by this task.

---

## 7. Summary

- **Adopt: 24 · Prototype: ~14 · Defer: ~22 · Reject: ~22** (margins approximate where one tool spans
  multiple framings — see Decision Log §13).
- **Highest-leverage adopts:** (1) **shared cached system prefix** — biggest token win, not yet built;
  (2) **structured outputs** — removes parse-fail retries on both models at $0; (3) **n8n-mcp as a
  build-time validator** — finally closes the open P8 import smoke test; (4) **patterns.yaml** — turns
  `solution_design`/`generate_workflow` from free-gen into grounded lookup.
- **Riskiest one-way doors:** (1) **checkpoint claim-check slimming** — changes the durable-state
  contract (ship last, behind green P9 + a mid-pipeline resume test; also fixes a red-line violation);
  (2) **offline n8n template index/bundling** — carries n8n-SUL + author attribution/redistribution
  obligations; (3) **`patterns.yaml` as the grounding layer** — once downstream depends on pattern ids,
  renaming is costly.
