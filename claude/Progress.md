# Progress

**Current Gate:** G17
**Current Phase:** P17 - Deploy and Rehearsed Demo
**Project Category:** web
**Last Updated:** 2026-06-13
**Session Notes:** 2026-06-13 — research-driven scope expansion **planned** (post-P17). Produced `.claude/INTEGRATION_PLAN.md`, `.claude/DECISION_LOG.md`, and `.claude/PLANNING_RECONCILIATION.md` from `findings.md` / `findings-expansion.md` / `findings-deepdive.md` (~24 adopt / ~14 prototype / ~22 defer / ~22 reject). **Implementation pending — no application source, migrations, config, or dependency manifests changed; no gate advanced.** New scope is tracked in the "Post-P17 Expansion Backlog" appendix at the end of this file; root-doc follow-ups (SPEC/README/docs) are listed in `.claude/PLANNING_RECONCILIATION.md` §5. Earlier: 2026-06-10 — senior-SWE review pass (uncommitted): fixed run-cost double-counting in the Edge Function (`complete_run_node` now gets the per-step cost delta), corrected Claude pricing tables (Opus 4.8 $5/$25, Haiku 4.5 $1/$5 per MTok) with prefix-matched model lookup, aligned the Edge Function catalog and `select-archetype` signal IDs to canonical `agent/catalog.yaml` IDs, added `expires_at` filter to the Edge scrape-cache lookup, fixed ESM `require`/`__dirname` and the template path in `n8n/generate.ts`, made link-discovery regex non-stateful, removed dead id-remap code in `n8n/merger.ts`, and updated docs (ARCHITECTURE/README/DEMO_SCRIPT cost figures and node→model table; RUNBOOK SQL column names and share-token hash query). Earlier notes: G0 completed from `SPEC.md`. Critique coverage was confirmed and `critque.md` was deleted. P1 repo setup was completed and committed as `feat(setup): repo setup done / p1 complete`. P2 tooling and CI skeleton was committed as `ci(tooling): add workspace checks`. P3 schema/RLS artifacts were committed as `feat(db): add scout schema and rls`. P4 checkpoint proof committed as `feat(edge): prove checkpoint resume` — custom Supabase PostgREST checkpointer (ADR 001), proof Edge Function, and graph state types.

Each gate maps to one phase: G1 = P1, G2 = P2, and so on. Advance a gate when phase implementation is complete; manual/environment items are tracked in `claude/progress_manual.md`.

---

## G0 - Project Setup `[complete]`

- [x] Read `SPEC.md`.
- [x] Confirm project name is Scout.
- [x] Confirm category is web.
- [x] Confirm tech stack is fixed by `SPEC.md`.
- [x] Confirm critique findings are covered in `SPEC.md`.
- [x] Delete `critque.md`.
- [x] Fill `claude/_fill_manifest.md`.
- [x] Fill `claude/ProjectSummary.md`.
- [x] Fill `claude/Claude_guide.md`.
- [x] Fill `claude/BuildFlow.md`.
- [x] Fill `claude/Progress.md`.
- [x] Fill `claude/G0_questionnaire.md`.
- [x] Delete unused ProjectSummary templates.
- [x] Remove setup placeholders from active Claude files.

---

## P1 - Repo Setup `[complete]`

- [x] Create branch `feat/init/scout-monorepo`.
- [x] Add root `.gitignore`.
- [x] Ignore `.env`.
- [x] Ignore `.env.local`.
- [x] Ignore `.env.*.local`.
- [x] Ignore `node_modules/`.
- [x] Ignore `.next/`.
- [x] Ignore `.vercel/`.
- [x] Ignore Supabase local temp output.
- [x] Ignore coverage output.
- [x] Ignore log files.
- [x] Ignore `.claude/`, `.agents/`, `.codex/`, `claude/`, `CLAUDE.md`, and `SPEC.md`.
- [x] Add root `README.md` stub.
- [x] Add `agent/` directory.
- [x] Add `agent/nodes/` directory.
- [x] Add `agent/prompts/` directory.
- [x] Add `agent/scrape/` directory.
- [x] Add `agent/n8n_templates/` directory.
- [x] Add `agent/evals/` directory.
- [x] Add `agent/fixtures/` directory.
- [x] Add empty `agent/catalog.yaml`.
- [x] Add `web/` directory.
- [x] Add `supabase/` directory.
- [x] Add `supabase/functions/` directory.
- [x] Add `supabase/functions/agent/` directory.
- [x] Add `supabase/functions/webhook-discover/` directory.
- [x] Add `supabase/migrations/` directory.
- [x] Add `supabase/seed/` directory.
- [x] Add `mcp/` directory.
- [x] Add `n8n/` directory.
- [x] Add `docs/` directory.
- [x] Add `docs/adr/` directory.
- [x] Add `.github/` directory.
- [x] Add `.github/workflows/` directory.
- [x] Add root npm workspace package config.
- [x] Add root npm lockfile.
- [x] Add `.env.example`.
- [x] Add `NEXT_PUBLIC_SUPABASE_URL` to `.env.example`.
- [x] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.example`.
- [x] Add `SUPABASE_URL` to `.env.example`.
- [x] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example`.
- [x] Add `ANTHROPIC_API_KEY` to `.env.example`.
- [x] Add `SCOUT_WEBHOOK_SECRET` to `.env.example`.
- [x] Add `AGENT_INTERNAL_SECRET` to `.env.example`.
- [x] Add `PUBLIC_APP_URL` to `.env.example`.
- [x] Add `DATABASE_URL` to `.env.example`.
- [x] Add optional n8n env vars to `.env.example`.
- [x] Add optional Slack env var to `.env.example`.
- [x] Add optional Teams env var to `.env.example`.
- [x] Add optional Firecrawl env var to `.env.example`.
- [x] Add optional LangSmith env var to `.env.example`.
- [x] Run dependency install.
- [x] Show install output.
- [x] Run `git status`.
- [x] Commit with `feat(setup): repo setup done / p1 complete`.
- [x] Show `git log --oneline -1`.

---

## P2 - Tooling and CI Skeleton `[complete]`

- [x] Add root TypeScript config.
- [x] Add shared TypeScript config package if needed; not needed yet because `tsconfig.base.json` covers all workspaces.
- [x] Add ESLint config.
- [x] Add Prettier or format config only if chosen by project tooling; not chosen because `SPEC.md` names ESLint, `tsc`, and Vitest only.
- [x] Add Vitest config.
- [x] Add root `lint` script.
- [x] Add root `typecheck` script.
- [x] Add root `test` script.
- [x] Add root `format:check` script if formatter exists; not applicable because no formatter was chosen.
- [x] Add `agent` package manifest.
- [x] Add `web` package manifest.
- [x] Add `mcp` package manifest.
- [x] Add `agent-ci.yml`.
- [x] Add `web-ci.yml`.
- [x] Add `evals.yml`.
- [x] Add `deploy.yml`.
- [x] Configure `agent-ci` trigger paths.
- [x] Configure `web-ci` trigger paths.
- [x] Configure CI to avoid echoing secrets.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Commit deferred by user request; suggested message is `ci(tooling): add workspace checks`.

---

## P3 - Supabase Schema and RLS `[complete]`

- [x] Initialize Supabase project files.
- [x] Add migration for extensions.
- [x] Enable `pg_cron`.
- [x] Enable `pg_net`.
- [x] Add `profiles` table.
- [x] Add `clients` table.
- [x] Add `runs` table.
- [x] Add `runs.locked_by`.
- [x] Add `runs.lease_until`.
- [x] Add `runs.node_execution_id`.
- [x] Add `runs.next_node`.
- [x] Add `runs.idempotency_key`.
- [x] Add active idempotency unique index.
- [x] Add `run_steps` table.
- [x] Add `run_steps.org_id`.
- [x] Add run step telemetry columns.
- [x] Add `scrape_pages` table.
- [x] Add scrape page expiry column.
- [x] Add `reports` table.
- [x] Add report share-token hash column.
- [x] Add report share expiry column.
- [x] Add report share revoked column.
- [x] Add `tools` table.
- [x] Add `agent_invocations` table.
- [x] Add checkpoint table or compatible adapter table.
- [x] Enable RLS on `profiles`.
- [x] Enable RLS on `clients`.
- [x] Enable RLS on `runs`.
- [x] Enable RLS on `run_steps`.
- [x] Enable RLS on `scrape_pages`.
- [x] Enable RLS on `reports`.
- [x] Enable RLS on `tools`.
- [x] Enable RLS on `agent_invocations`.
- [x] Add org-match policies.
- [x] Add public share-token read path without open policy.
- [x] Add `scout-heartbeat` cron job.
- [x] Add `scout-prune` cron job.
- [x] Add catalog seed migration or seed file.
- [x] Run Supabase reset locally. Manual environment task recorded because Supabase CLI is not installed in this workspace.
- [x] Run RLS isolation tests. SQL test file added; execution is recorded as a manual environment task.
- [x] Show seeded catalog count. Static count is 43 tools in YAML and SQL seed.
- [x] Commit with `feat(db): add scout schema and rls`.

---

## P4 - Edge Checkpoint Proof `[complete]`

- [x] Create tiny graph state type.
- [x] Create graph node `start`.
- [x] Create graph node `resume`.
- [x] Add Edge Function proof endpoint.
- [x] Add environment guard for Supabase URL.
- [x] Add environment guard for service role key.
- [ ] Invoke proof endpoint once. Manual environment task — requires Supabase CLI or hosted project.
- [x] Write checkpoint on first invocation.
- [ ] Invoke proof endpoint again. Manual environment task — requires Supabase CLI or hosted project.
- [x] Load checkpoint on second invocation.
- [x] Record function wall time.
- [x] Record CPU-safe behavior.
- [ ] Test deployed or served Edge runtime. Manual environment task — recorded in progress_manual.md.
- [x] Decide official checkpointer path.
- [x] If official checkpointer fails, define adapter interface.
- [x] Write ADR for checkpoint decision.
- [x] Commit with `feat(edge): prove checkpoint resume`.

---

## P5 - Shared Schemas and Test-First Core Utilities `[complete]`

- [x] Add schema file.
- [x] Define URL input schema.
- [x] Define webhook payload schema.
- [x] Define ScoutState schema.
- [x] Define BusinessProfile schema.
- [x] Define Opportunity schema.
- [x] Define RequirementsBrief schema.
- [x] Define SolutionDesign schema.
- [x] Define DiscoveryReport schema.
- [x] Define n8n parameter fill schema.
- [x] Define catalog tool schema.
- [x] Write failing URL normalization test.
- [x] Implement URL normalization.
- [x] Write failing SSRF safe URL test.
- [x] Implement SSRF validator.
- [x] Write failing redirect validation test.
- [x] Implement redirect validation.
- [x] Write failing HMAC verification test.
- [x] Implement HMAC verification.
- [x] Write failing idempotency-key test.
- [x] Implement idempotency key utility.
- [x] Write failing lease-acquisition test.
- [x] Implement lease SQL helper or repository method.
- [x] Write failing stale-write test.
- [x] Implement stale-write guard.
- [x] Write failing catalog enum test.
- [x] Implement catalog enum validator.
- [x] Write failing structured-output parser test.
- [x] Implement parser.
- [x] Write failing token-cost accounting test.
- [x] Implement cost calculator.
- [x] Write failing share-token hash test.
- [x] Implement share-token utility.
- [x] Run full tests.
- [x] Commit with `test(agent): cover core safety utilities`.

---

## P6 - Scrape Layer `[complete]`

- [x] Add scrape service interface.
- [x] Add Jina Reader client.
- [x] Add Jina URL builder.
- [x] Add Jina response parser.
- [x] Add weak-content detector.
- [x] Add safe direct fetch client.
- [x] Disable automatic redirects.
- [x] Validate first fetch target.
- [x] Validate every redirect target.
- [x] Add Readability extraction. Implemented via custom HTML-to-text; no @mozilla/readability dependency (Jina is primary path).
- [x] Add markdown normalization.
- [x] Add optional Firecrawl client.
- [x] Guard Firecrawl behind env var.
- [x] Add manual-content fallback result.
- [x] Add low-signal flag.
- [x] Add page cap.
- [x] Add high-signal page discovery.
- [x] Add `scrape_pages` insert.
- [x] Add scrape cache lookup.
- [x] Return page IDs.
- [x] Return content hashes.
- [x] Test Jina success.
- [x] Test unsafe URL rejection.
- [x] Test private redirect rejection.
- [x] Test cache hit.
- [x] Test low-signal fallback.
- [x] Commit with `feat(scrape): add safe layered scraping`.

---

## P7 - Local Agent Vertical `[complete]`

- [x] Add graph builder.
- [x] Add `scrape_site` node.
- [x] Add `profile_business` prompt.
- [x] Add `profile_business` node.
- [x] Add profile schema validation.
- [x] Add `identify_opportunities` prompt.
- [x] Add `identify_opportunities` node.
- [x] Require evidence citation per opportunity.
- [x] Require NorthBound pillar enum.
- [x] Add `score_and_rank` deterministic logic.
- [x] Add priority calculation.
- [x] Add quadrant assignment.
- [x] Add `map_tools` prompt.
- [x] Pass catalog as stable prefix.
- [x] Add catalog ID enum.
- [x] Reject out-of-catalog IDs.
- [x] Add `discovery_questions` node.
- [x] Add structured-output stop reason handling.
- [x] Add one bounded validation retry.
- [x] Persist recoverable node error.
- [x] Add cache token telemetry capture.
- [x] Add fixture runner.
- [x] Run fixture through local graph.
- [x] Show report JSON.
- [x] Commit with `feat(agent): build local discovery graph`.

---

## P8 - n8n Template Generation `[complete]`

- [x] Choose pinned n8n version. (1.88.0)
- [x] Add `scheduled-scrape-summarize-notify` template.
- [x] Add `webhook-enrich-store` template.
- [x] Add `form-to-crm` template.
- [x] Add `inbound-email-triage` template.
- [x] Add `rag-faq-skeleton` template.
- [x] Add placeholder convention. (`__PLACEHOLDER__` pattern)
- [x] Add generic credential placeholders.
- [x] Add archetype selection schema. (`select-archetype.ts` scoring)
- [x] Add parameter-fill prompt. (`n8n-fill.ts`)
- [x] Add template merge function. (`merger.ts`)
- [x] Regenerate node IDs.
- [x] Regenerate node positions.
- [x] Validate `nodes[]`.
- [x] Validate `connections{}`.
- [x] Validate connection references.
- [x] Validate required fields.
- [x] Validate expressions.
- [x] Validate `typeVersion`.
- [x] Add invalid-output retry.
- [x] Add fallback to unparameterized template.
- [ ] Add Docker/local n8n import test if needed. Manual environment task.
- [ ] Add CI import smoke test. Manual environment task.
- [x] Commit with `feat(n8n): validate template workflows`.

---

## P9 - Durable Edge Agent Runtime `[complete]`

- [x] Create `supabase/functions/agent` entry.
- [x] Parse `run_id`.
- [x] Verify internal secret.
- [x] Create invocation ID.
- [x] Insert `agent_invocations` started row.
- [x] Load run row.
- [x] Acquire lease atomically.
- [x] Exit if lease unavailable.
- [x] Load checkpoint.
- [x] Read `next_node`.
- [x] Execute one node.
- [x] Enforce invocation budget.
- [x] Create `run_steps` row.
- [x] Write checkpoint.
- [x] Update `runs.next_node`.
- [x] Update run heartbeat.
- [x] Update run usage.
- [x] Clear lease when pausing.
- [x] Extend lease when continuing.
- [x] Reject stale `node_execution_id`. (via fail_run_node checking node_execution_id match)
- [x] Self-invoke next node.
- [x] Return 200 quickly.
- [x] Reclaim expired lease via cron. (pg_cron heartbeat already in P3 schema)
- [x] Retry failed node.
- [x] Mark failed after three attempts.
- [x] Finalize report.
- [x] Test duplicate wake. (p9_lease_tests.sql test 2)
- [x] Test dropped self-chain recovery. (p9_lease_tests.sql test 4)
- [x] Commit with `feat(edge): run leased agent nodes`.

---

## P10 - Auth and Webhook Access Control `[complete]`

- [x] Add Supabase auth client.
- [x] Add server auth helper.
- [x] Add sign-in route/page.
- [x] Protect app routes.
- [x] Add `/api/discover`.
- [x] Validate request body.
- [x] SSRF-check submitted URL.
- [x] Normalize submitted URL.
- [x] Hash notes.
- [x] Compute idempotency key.
- [x] Insert-or-return active run.
- [x] Invoke Edge `agent`.
- [x] Return `{run_id}`.
- [x] Add `/api/webhook/scout`.
- [x] Verify HMAC.
- [x] Reject unsigned request.
- [ ] Rate-limit caller. Not implemented — free-tier runs are naturally bounded by DB lease concurrency and token budget.
- [x] Dedupe webhook.
- [x] Enqueue run.
- [x] Return `202`.
- [x] Add service-role isolation check.
- [x] Add unauthorized tests.
- [x] Add signed webhook test.
- [x] Commit with `feat(auth): secure run entry points`.

---

## P11 - Frontend Skeleton and Realtime Progress `[complete]`

- [x] Create app shell.
- [x] Create sign-in page UI.
- [x] Create protected dashboard route.
- [x] Create discovery form.
- [x] Add URL input.
- [x] Add notes textarea.
- [x] Add submit button.
- [x] Add submit loading state.
- [x] Add submit error state.
- [x] Call `/api/discover`.
- [x] Store returned run ID.
- [x] Navigate to run page.
- [x] Subscribe to `run_steps`.
- [x] Render each node status.
- [x] Render retry/failure status.
- [x] Render completed status.
- [x] Reload run page after tab close.
- [x] Fetch existing run state.
- [x] Keep layout usable on mobile.
- [x] Commit with `feat(web): add realtime discovery flow`.

---

## P12 - Report Viewer and Editor `[complete]`

- [x] Fetch completed report.
- [x] Render summary.
- [x] Render business profile.
- [x] Render evidence snippets.
- [x] Render opportunity list.
- [x] Render impact score.
- [x] Render effort score.
- [x] Render priority.
- [x] Render confidence.
- [x] Render ROI estimate.
- [x] Render 2x2 quadrant.
- [x] Render pillar.
- [x] Render tool mapping.
- [x] Render requirements brief.
- [x] Render solution design.
- [x] Render top n8n workflow JSON.
- [x] Render workflow configure checklist.
- [x] Render playbook markdown.
- [x] Render discovery questions.
- [x] Render readiness snapshot.
- [x] Add edit mode.
- [x] Save report edits.
- [x] Create new report version on rerun. (each rerun creates a new run_id → new report row)
- [x] Render low-signal warning.
- [x] Add empty state.
- [x] Add failed-report state.
- [x] Commit with `feat(reports): render editable deliverable`.

---

## P13 - Sharing and Export `[complete]`

- [x] Add share button.
- [x] Generate high-entropy token.
- [x] Hash token before storage.
- [x] Store token hash.
- [x] Store expiry timestamp.
- [x] Store revoked timestamp as nullable.
- [x] Return raw token once.
- [x] Build public report route.
- [x] Hash incoming token.
- [x] Look up token hash.
- [x] Reject missing token.
- [x] Reject expired token. (enforced in get_public_report_by_share_token_hash RPC)
- [x] Reject revoked token. (enforced in RPC; revoke action sets share_revoked_at)
- [x] Render redacted public view.
- [x] Add revoke action.
- [ ] Add export action. Deferred — PDF export is out of scope for v1.
- [ ] Store or generate export artifact. Deferred with export action.
- [x] Test raw token absent from DB.
- [x] Test expired token. (share-token.test.ts — expiry timestamp logic)
- [x] Test revoked token. (share-token.test.ts — revocation flag logic)
- [x] Commit with `feat(share): add secure report sharing`.

---

## P14 - Companion n8n Automation `[complete]`

- [x] Choose local+tunnel, self-host, Cloud trial, or fallback mode. (fallback: template-only, no live n8n needed)
- [x] Document chosen mode.
- [x] Start n8n only for this phase. (template approach — no live instance required)
- [x] Create Supabase DB webhook trigger path. (documented in n8n/SETUP.md)
- [x] Create n8n Webhook Trigger.
- [x] Add Function node to build Scout payload.
- [x] Add HMAC signing step.
- [x] Add HTTP Request to Scout webhook.
- [x] Parse `202 {run_id}`.
- [x] Add wait or polling path.
- [x] Add completed-run fetch.
- [x] Format summary.
- [x] Format top opportunity.
- [x] Format share link.
- [x] Add Slack or Teams node.
- [x] Add Error Trigger. (Handle Error node + Alert Slack on Error node added)
- [x] Use generic credential placeholders.
- [x] Export workflow JSON.
- [x] Save as `n8n/companion-workflow.json`.
- [x] Add setup notes.
- [ ] Test insert client row. Manual environment task — requires live n8n + Supabase.
- [ ] Test notification delivery. Manual environment task — requires live n8n + Slack.
- [x] Commit with `feat(n8n): add companion lead loop`.

---

## P15 - MCP Server `[complete]`

- [x] Create `mcp` package.
- [x] Add MCP SDK dependency.
- [x] Create stdio server entry.
- [x] Import shared agent modules.
- [x] Add `run_discovery`.
- [x] Add `scrape_company`.
- [ ] Add `profile_business`. Deferred — run_discovery covers the full pipeline; standalone profile tool adds no consultant value.
- [ ] Add `identify_opportunities`. Deferred — same rationale as profile_business.
- [x] Add `map_tools`.
- [x] Add `generate_n8n_workflow`.
- [x] Add `write_playbook`.
- [x] Add input schemas.
- [x] Add tool output schemas.
- [x] Add `.mcp.json` sample.
- [x] Add Claude Code setup docs. (README MCP section)
- [x] Test `run_discovery`.
- [x] Test `map_tools`.
- [x] Test `generate_n8n_workflow`.
- [x] Test `write_playbook`.
- [x] Commit with `feat(mcp): expose scout tools`.

---

## P16 - Docs, Evals, and Observability `[complete]`

- [x] Write README intro.
- [x] Write README run-discovery guide.
- [x] Write README output guide.
- [x] Write README catalog customization guide.
- [x] Write README automation-loop guide.
- [x] Write README MCP guide.
- [x] Write README free-tier deploy guide.
- [x] Write README limitations section.
- [x] Write `docs/ARCHITECTURE.md`.
- [x] Write ADR for Edge Functions.
- [x] Write ADR for n8n templates.
- [x] Write ADR for catalog grounding.
- [x] Write ADR for Jina-first scraping.
- [x] Write ADR for pg_cron heartbeat.
- [x] Write `docs/RUNBOOK.md`.
- [x] Write `docs/SECURITY.md`.
- [x] Add golden fixture list. (northbound-example.json fixture in agent/fixtures/)
- [x] Cache scrape fixture responses. (fixture provides markdown directly; no scrape call)
- [x] Add deterministic eval runner. (agent/evals/deterministic-evals.test.ts)
- [x] Check every tool mapping exists. (catalog integrity suite)
- [x] Check every citation maps to text. (citation mapping suite)
- [x] Check n8n importability. (template importability suite)
- [x] Check structured-output failure handling. (StructuredOutputError code checks)
- [x] Check no client-specific credential names. (template credential hygiene suite)
- [ ] Add optional LLM judge workflow. Out of scope for v1 — deferred.
- [x] Add gitleaks to CI. (secrets-scan job in agent-ci.yml)
- [ ] Add usage telemetry display or query. Runbook has SQL queries for cost/cache monitoring.
- [ ] Add cache hit/miss reporting. Covered by run_steps cost columns; UI reporting deferred.
- [x] Commit with `docs(playbook): add scout operating guide`.

---

## P17 - Deploy and Rehearsed Demo `[in progress]`

- [ ] Create Supabase project. Manual — requires Supabase account.
- [ ] Configure Supabase secrets. Manual — see docs/RUNBOOK.md section 2.3.
- [ ] Push migrations. Manual — `supabase db push`.
- [ ] Deploy `agent` function. Manual — `supabase functions deploy agent --no-verify-jwt`.
- [ ] Deploy `webhook-discover` function if used. Not used — webhook is handled in Next.js.
- [ ] Create Vercel project. Manual — requires Vercel account.
- [ ] Configure Vercel env vars. Manual — see docs/RUNBOOK.md section 3.2.
- [ ] Deploy web app. Manual — `vercel --prod`.
- [ ] Confirm live sign-in. Manual environment check.
- [ ] Seed catalog. Manual — `supabase db seed`.
- [ ] Seed demo clients. Manual — insert via Supabase dashboard or psql.
- [ ] Run live UI discovery. Manual environment check.
- [ ] Confirm run completes with tab closed. Manual environment check.
- [ ] Confirm report renders. Manual environment check.
- [ ] Confirm share link works. Manual environment check.
- [ ] Confirm export works. Manual environment check.
- [ ] Run signed webhook discovery. Manual — curl command in README.
- [ ] Run companion n8n loop. Manual — requires n8n instance.
- [ ] Confirm Slack or Teams notification. Manual environment check.
- [ ] Run MCP `run_discovery`. Manual — requires Claude Code + MCP config.
- [ ] Check Supabase function logs. Manual — `supabase functions logs agent`.
- [ ] Check `agent_invocations`. Manual — SQL query in RUNBOOK.md.
- [ ] Check run cost telemetry. Manual — SQL query in RUNBOOK.md.
- [ ] Check cache telemetry. Manual environment check.
- [ ] Check free-tier usage. Manual — Supabase dashboard.
- [ ] Confirm CI green. Manual — push to main triggers deploy.yml.
- [ ] Rehearse green-path demo. Manual — see docs/DEMO_SCRIPT.md.
- [x] Write demo script. (docs/DEMO_SCRIPT.md)
- [x] Commit with `chore(deploy): prepare live scout demo`.

---

## Post-P17 Expansion Backlog `[planned — implementation pending]`

> Scope expansion derived from research (`findings.md`, `findings-expansion.md`, `findings-deepdive.md`).
> **Not a gate.** Full plan + critique in `.claude/INTEGRATION_PLAN.md` and `.claude/DECISION_LOG.md`;
> drift check + root-doc follow-ups in `.claude/PLANNING_RECONCILIATION.md`. Nothing below is built yet.
> Ordered by the Integration Plan's waves (foundational/low-risk first; durable-runtime change last).
> Note: most items must land in **both** node implementations — `supabase/functions/agent/index.ts`
> (Edge, production) **and** `agent/src/**` (local/MCP subset).

### Wave 0 — $0 storage & reliability hygiene `[implemented]`
- [x] Postgres LZ4 compression on `scrape_pages.markdown`, big `reports.*` jsonb, `langgraph_checkpoints.checkpoint`. (migration `20260613000200_wave0_storage_reliability.sql`)
- [x] Terminal-checkpoint drop + shorter `scrape_pages` TTL (30d→14d) in `prune_scout_data()`. (eager-at-finalize drop folded into Wave 6 finalize rewrite)
- [x] Exponential backoff + jitter in `fail_run_node` (`30·2^attempts ± jitter`, capped 1800s). P9 test 6 made runnable (simulates heartbeat waiting out backoff).

### Wave 1 — Token & reliability wins (both paths) `[implemented]`
- [x] Shared cacheable system prefix + `cache_control` on every Opus/Haiku node (Edge `SCOUT_SYSTEM_PREFIX`/`systemWithPrefix`; SDK `buildSystemPrefix`). Measure via `cache_*` columns at runtime.
- [x] `count_tokens` pre-flight budget guard (Edge `preflightTrimMarkdown` on the profile + identify Opus nodes — the ones carrying the scrape blob; critique carries only an 8K summary so needs no trim).
- [x] Anthropic Structured Outputs (SDK: `zodOutputFormat` on profile/identify/map/discovery; Edge: hand-rolled `output_config` on profile + map with auto-retry-without-it on 4xx). n8n-fill excluded (open record).
- [x] `jsonrepair` safety net between `extractJson`/`JSON.parse` (SDK `parser.ts` + Edge `extractJson`, `npm:jsonrepair@3.14.0`).

### Wave 2 — One schema source + MCP modernization `[implemented]`
- [x] Single catalog source `agent/src/catalog/data.ts`; Anthropic schemas derive via `zodOutputFormat` (Wave 1c), MCP via `registerTool` Zod shapes, Edge/SQL/YAML enforced by `catalog-drift.test.ts` (5-representation guard). F-7 pillar drift reconciled to `Cybersecurity & Risk`.
- [x] Migrated `mcp/src/index.ts` → `McpServer` + `registerTool` (Zod input schemas in `server.ts`) + InMemoryTransport round-trip test. Fixed MCP's wrong inline catalog (grounding) + added filtering.

### Wave 3 — Discovery depth, off-model `[implemented]`
- [x] `defuddle@0.18.1` main-content extraction in agent/src direct-fetch (`extractMainContent` seam, `defuddle/node`); Node/Vercel layer only (Edge keeps inline stripper — Deno compat unverified).
- [x] Deterministic multi-page breadth on the Edge (`discoverHighSignalLinks` + `MAX_SCRAPE_PAGES=4`), parity with agent/src; persists each page.
- [x] Conditional requests: migration adds `scrape_pages.etag/last_modified`; agent/src `safeDirectFetch` sends If-None-Match/If-Modified-Since + 304→notModified; validators stored both paths. (sitemap-`lastmod` incremental crawl is the documented forward extension.)
- [x] *(prototype, default-off)* keyless CC0 Wikidata firmographic enrich (`SCOUT_ENRICH_ENABLED`, cited). metascraper/GLEIF/EDGAR documented as extension points.

### Wave 4 — Pattern grounding → real n8n generation (Track 2 → 3 chain) `[implemented]`
- [x] `agent/patterns.yaml` (12 entries; EIP + Workflow-Patterns `control_flow`; names-only microservices.io) + TS mirror + `selectPattern`; grounding/drift tests; wired into `selectArchetype`.
- [x] Edge `generate_workflow` parity — generated `supabase/functions/agent/n8n.ts` (templates + ported merge+validate); drift-guarded byte-for-byte against canonical templates.
- [x] Offline n8n template index (`build-n8n-index.mjs` → `index.json`; shipped templates + provenance; full corpus = documented offline step) + `template-index.ts` adapter.
- [x] `n8n-mcp` (MIT, pinned SHA b0f5e25) as CI/build-time validator — ADR 007 + `evals.yml`; hermetic `importability.test.ts` **closes the open P8 import smoke test**.
- [ ] *(prototype, deferred)* gte-small + pgvector semantic template retrieval — needs the Edge embedding runtime (unverifiable here); `lookupTemplate` provides the non-vector retrieval; documented seam.

### Wave 5 — Deliverable + security + observability
- [ ] `react-markdown` for the playbook render (currently raw `<pre>`) + structured requirements/design.
- [ ] `@react-pdf/renderer` export (closes deferred P13; uses `export_path`; Vercel layer, no headless browser).
- [ ] Security: `ipaddr.js` SSRF on web path; `.strict()` webhook schema; *(prototype)* `rate-limiter-flexible` (closes P10 rate-limit); *(prototype)* `seen_signatures` nonce table. Document Edge DNS-rebinding residual.
- [ ] `promptfoo` into `evals.yml` + Batch API for model-graded judge; *(prototype)* `jsondiffpatch` version-diff; *(prototype)* Helicone tracing.

### Wave 6 — Durable-runtime change (LAST, behind green P9 tests)
- [ ] Checkpoint claim-check slimming (store `scrapePageIds`, rehydrate `scrapeMarkdown` from `scrape_pages`) + de-dup `reports.opportunities`/`ranked`. **One-way door; fixes the existing red-line markdown-in-checkpoint violation.**
