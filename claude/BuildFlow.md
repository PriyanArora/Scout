# Build Flow - Scout

> Phase done = checkpoint passes, not code written.
> Each phase has a Proof line. The builder must show the proof before the gate advances.

All phases derive from `SPEC.md`. Do not change the tech stack in a phase. If the architecture needs to change, update `SPEC.md` first.

---

## Prerequisites

- Node.js suitable for Next.js and TypeScript workspace.
- npm workspaces for future monorepo scripts.
- Supabase CLI for local database, migrations, functions, `pg_cron`, and `pg_net` setup.
- Vercel project for the Next.js app.
- Anthropic API key for Claude.
- n8n Community Edition endpoint mode selected before P14.
- Docker only when needed for n8n local/import testing.
- GitHub repository with Actions enabled.
- No paid core app infrastructure.

---

## P1 - Repo Setup `[GATE G1]`

**Goal:** Establish the monorepo skeleton, ignore rules, env example, and first conventional commit.

- [ ] Create `agent/`, `web/`, `supabase/`, `mcp/`, `n8n/`, `docs/`, and `.github/workflows/`.
- [ ] Add root workspace package config.
- [ ] Add `.gitignore` for secrets, dependencies, build output, local Supabase state, Vercel output, logs, and generated exports.
- [ ] Add `.env.example` with every required and optional key from the manifest.
- [ ] Add README stub that points to `SPEC.md`.
- [ ] Install dependencies cleanly.
- [ ] Make the first conventional commit.

**Proof:** Show folder tree, `.gitignore`, `.env.example`, dependency install output, and `git log --oneline -1`.

**Commit:** `chore(init): scaffold scout monorepo`

---

## P2 - Tooling and CI Skeleton `[GATE G2 - requires G1]`

**Goal:** Add shared TypeScript, lint, tests, and initial CI structure.

- [ ] Add workspace TypeScript config.
- [ ] Add lint config.
- [ ] Add Vitest config.
- [ ] Add root scripts for lint, typecheck, test, and format check.
- [ ] Add `agent-ci` workflow skeleton.
- [ ] Add `web-ci` workflow skeleton.
- [ ] Add secret-safe CI logging rules.
- [ ] Confirm no implementation code depends on missing env at import time.

**Proof:** Show `npm run lint`, `npm run typecheck`, `npm test`, and workflow files.

**Commit:** `ci(tooling): add workspace checks`

---

## P3 - Supabase Schema and RLS `[GATE G3 - requires G2]`

**Goal:** Create the database backbone, policies, indexes, cron jobs, and seeds.

- [ ] Add migrations for `profiles`.
- [ ] Add migrations for `clients`.
- [ ] Add migrations for `runs` with lease fields.
- [ ] Add migrations for `run_steps`.
- [ ] Add migrations for `scrape_pages`.
- [ ] Add migrations for `reports` with share-token hash/expiry/revocation.
- [ ] Add migrations for `tools`.
- [ ] Add migrations for `agent_invocations`.
- [ ] Add managed or adapter-backed checkpoint table.
- [ ] Enable RLS on every app table.
- [ ] Add simple `org_id` policies.
- [ ] Add active-run idempotency unique index.
- [ ] Add cron job for heartbeat.
- [ ] Add cron job for pruning.
- [ ] Seed catalog from `agent/catalog.yaml`.

**Proof:** Show migration files, local Supabase reset output, RLS isolation test output, and seeded catalog count.

**Commit:** `feat(db): add scout schema and rls`

---

## P4 - Edge Checkpoint Proof `[GATE G4 - requires G3]`

**Goal:** Prove the load-bearing runtime choice before building the full graph.

- [ ] Add a tiny LangGraph.js state graph.
- [ ] Run it inside Supabase Edge locally or deployed.
- [ ] Write a checkpoint after the first invocation.
- [ ] Resume from the checkpoint on the second invocation.
- [ ] Record wall-clock and CPU-safe behavior.
- [ ] Decide official Postgres checkpointer vs. Supabase/PostgREST adapter.
- [ ] Document the decision in an ADR.

**Proof:** Show first invocation checkpoint write, second invocation resume, function logs, and the ADR.

**Commit:** `feat(edge): prove checkpoint resume`

---

## P5 - Shared Schemas and Test-First Core Utilities `[GATE G5 - requires G4]`

**Goal:** Build the pure correctness layer with tests first.

- [ ] Add Zod schemas for inputs, state, reports, opportunities, requirements, solution design, n8n fills, and catalog tools.
- [ ] Test URL normalization before implementation.
- [ ] Test SSRF validation before implementation.
- [ ] Test webhook signature verification before implementation.
- [ ] Test pre-scrape idempotency key generation before implementation.
- [ ] Test lease acquisition query assumptions before implementation.
- [ ] Test stale-write rejection before implementation.
- [ ] Test run-state transitions before implementation.
- [ ] Test scrape-cache keying before implementation.
- [ ] Test catalog enum validation before implementation.
- [ ] Test structured-output parser before implementation.
- [ ] Test token and cost accounting before implementation.
- [ ] Test share-token hashing before implementation.

**Proof:** Show failing-then-passing tests and full `pnpm test` output.

**Commit:** `test(agent): cover core safety utilities`

---

## P6 - Scrape Layer `[GATE G6 - requires G5]`

**Goal:** Implement the layered scrape path safely.

- [ ] Implement Jina Reader fetch path.
- [ ] Implement quality/weak-content detection.
- [ ] Implement safe direct fetch without auto-follow redirects.
- [ ] Validate every redirect target manually.
- [ ] Block unsafe schemes, ports, DNS results, private ranges, loopback, link-local, and metadata IPs.
- [ ] Add Readability/Cheerio markdown extraction.
- [ ] Add optional Firecrawl adapter behind env guard.
- [ ] Add manual/low-signal fallback.
- [ ] Store raw markdown once in `scrape_pages`.
- [ ] Return page IDs/hashes for checkpoints.

**Proof:** Show fixture scrape tests, unsafe URL rejection tests, cache tests, and low-signal fallback output.

**Commit:** `feat(scrape): add safe layered scraping`

---

## P7 - Local Agent Vertical `[GATE G7 - requires G6]`

**Goal:** Produce local report JSON from fixtures through the core discovery path.

- [ ] Build `scrape_site` node wrapper.
- [ ] Build `profile_business`.
- [ ] Build `identify_opportunities`.
- [ ] Build `score_and_rank`.
- [ ] Build `map_tools`.
- [ ] Build `discovery_questions`.
- [ ] Use Claude Opus for judgement-heavy nodes.
- [ ] Use Haiku where the spec marks cheap steps.
- [ ] Wrap scraped content in data delimiters.
- [ ] Persist usage and recoverable errors in state.
- [ ] Reject out-of-catalog tools.

**Proof:** Show local script output from fixture to structured report JSON with citations, pillars, rankings, and catalog tool IDs.

**Commit:** `feat(agent): build local discovery graph`

---

## P8 - n8n Template Generation `[GATE G8 - requires G7]`

**Goal:** Make generated workflows import-safe by construction.

- [ ] Add seed template library.
- [ ] Pin the demo n8n version.
- [ ] Define parameter-fill schema.
- [ ] Select archetype from top opportunity.
- [ ] Merge fills into template.
- [ ] Regenerate node IDs.
- [ ] Regenerate node positions.
- [ ] Validate `nodes[]`.
- [ ] Validate `connections{}`.
- [ ] Validate connection node names.
- [ ] Validate required node fields.
- [ ] Validate expressions.
- [ ] Validate node `typeVersion`s.
- [ ] Add one bounded retry.
- [ ] Add unparameterized template fallback.
- [ ] Add pinned-version import smoke test.

**Proof:** Show generated workflow JSON, validator output, pinned n8n import result, and invalid-output fallback test.

**Commit:** `feat(n8n): validate template workflows`

---

## P9 - Durable Edge Agent Runtime `[GATE G9 - requires G8]`

**Goal:** Run the graph on Supabase Edge with durable leases and heartbeat recovery.

- [ ] Add `agent` Edge Function entry.
- [ ] Verify internal shared secret/service role.
- [ ] Load run by `run_id`.
- [ ] Acquire lease atomically.
- [ ] Exit if lease is unavailable.
- [ ] Load checkpoint.
- [ ] Run next node within budget.
- [ ] Write `run_steps`.
- [ ] Write checkpoint.
- [ ] Update `runs.next_node`.
- [ ] Update heartbeat and usage.
- [ ] Clear or extend lease.
- [ ] Reject stale writes.
- [ ] Self-invoke without awaiting.
- [ ] Let cron recover dropped self-chain.
- [ ] Retry node failures with backoff.
- [ ] Mark failed after capped attempts.
- [ ] Mark complete and write report.

**Proof:** Show queued run advancing with tab closed, duplicate wake not duplicating Claude calls, expired lease reclaim, retry behavior, and report row.

**Commit:** `feat(edge): run leased agent nodes`

---

## P10 - Auth and Webhook Access Control `[GATE G10 - requires G9]`

**Goal:** Secure all entry points.

- [ ] Add Supabase email auth.
- [ ] Protect `/api/discover`.
- [ ] Validate and normalize URL.
- [ ] Compute pre-scrape idempotency key.
- [ ] Insert or return active run.
- [ ] Invoke `agent` fire-and-forget.
- [ ] Add HMAC verification for `/api/webhook/scout`.
- [ ] Add webhook rate limit.
- [ ] Add webhook idempotency.
- [ ] Add optional allow-list.
- [ ] Add direct Edge webhook only if needed.
- [ ] Confirm service-role key is never bundled client-side.

**Proof:** Show unauthorized rejection, signed webhook success, unsigned webhook 401, active-run dedupe, and client bundle/env review.

**Commit:** `feat(auth): secure run entry points`

---

## P11 - Frontend Skeleton and Realtime Progress `[GATE G11 - requires G10]`

**Goal:** Build the first browser vertical slice.

- [ ] Add sign-in page.
- [ ] Add protected dashboard.
- [ ] Add discovery submit form.
- [ ] Add loading and error states.
- [ ] Call `/api/discover`.
- [ ] Render returned `run_id`.
- [ ] Subscribe to `run_steps` via Realtime.
- [ ] Render node-by-node progress.
- [ ] Handle tab close and return.
- [ ] Show failed-run state.

**Proof:** Show browser submission returning `run_id`, live progress updates, tab-close resume, and failed-run display.

**Commit:** `feat(web): add realtime discovery flow`

---

## P12 - Report Viewer and Editor `[GATE G12 - requires G11]`

**Goal:** Render and edit the full deliverable.

- [ ] Render business profile.
- [ ] Render opportunities.
- [ ] Render impact/effort 2x2.
- [ ] Render ROI assumptions.
- [ ] Render citations.
- [ ] Render catalog tool mapping.
- [ ] Render requirements brief.
- [ ] Render solution design.
- [ ] Render n8n workflow JSON and configure checklist.
- [ ] Render playbook.
- [ ] Render discovery questions.
- [ ] Render readiness snapshot.
- [ ] Add edit/save flow.
- [ ] Add report versioning.
- [ ] Render low-signal mode honestly.

**Proof:** Show completed report from stored data, edit/save behavior, citation links, version change, and low-signal rendering.

**Commit:** `feat(reports): render editable deliverable`

---

## P13 - Sharing and Export `[GATE G13 - requires G12]`

**Goal:** Add secure external report access and export.

- [ ] Generate high-entropy share token.
- [ ] Store token hash only.
- [ ] Set expiry.
- [ ] Support revocation.
- [ ] Render redacted public report.
- [ ] Reject expired token.
- [ ] Reject revoked token.
- [ ] Add export artifact path.
- [ ] Ensure public route does not bypass RLS-sensitive data.

**Proof:** Show raw token absent from DB, expired/revoked rejection, redacted public page, and export artifact.

**Commit:** `feat(share): add secure report sharing`

---

## P14 - Companion n8n Automation `[GATE G14 - requires G13]`

**Goal:** Demonstrate the external automation loop.

- [ ] Choose endpoint mode.
- [ ] Document endpoint mode.
- [ ] Build companion workflow.
- [ ] Use generic credential placeholders.
- [ ] Sign Scout webhook request.
- [ ] Wait or poll for completion.
- [ ] Format automation-potential score.
- [ ] Send Slack or Teams notification.
- [ ] Add Error Trigger alert.
- [ ] Export workflow to `n8n/companion-workflow.json`.
- [ ] Document fallback without n8n.

**Proof:** Show selected endpoint mode, imported workflow, generic credentials, signed webhook call, completed run, and notification with report link.

**Commit:** `feat(n8n): add companion lead loop`

---

## P15 - MCP Server `[GATE G15 - requires G14]`

**Goal:** Expose Scout to Claude Code through shared TypeScript modules.

- [ ] Add `mcp/` package.
- [ ] Add stdio MCP server.
- [ ] Import shared agent modules.
- [ ] Add `run_discovery`.
- [ ] Add `scrape_company`.
- [ ] Add `profile_business`.
- [ ] Add `identify_opportunities`.
- [ ] Add `map_tools`.
- [ ] Add `generate_n8n_workflow`.
- [ ] Add `write_playbook`.
- [ ] Add `.mcp.json` sample.
- [ ] Document usage.

**Proof:** Show Claude Code MCP config and successful calls to `run_discovery`, `map_tools`, `generate_n8n_workflow`, and `write_playbook`.

**Commit:** `feat(mcp): expose scout tools`

---

## P16 - Docs, Evals, and Observability `[GATE G16 - requires G15]`

**Goal:** Build the credibility layer.

- [ ] Write README consultant playbook.
- [ ] Write architecture doc.
- [ ] Write ADRs.
- [ ] Write runbook.
- [ ] Write security checklist.
- [ ] Add golden fixtures.
- [ ] Add deterministic eval checks.
- [ ] Add optional LLM judge workflow.
- [ ] Add n8n import check to CI.
- [ ] Add citation checks.
- [ ] Add catalog checks.
- [ ] Add RLS isolation checks.
- [ ] Add gitleaks.
- [ ] Add usage/cache/cost observability views or docs.

**Proof:** Show docs index, eval output, n8n import check, gitleaks output, RLS tests, and per-node usage/cache telemetry.

**Commit:** `docs(playbook): add scout operating guide`

---

## P17 - Deploy and Rehearsed Demo `[GATE G17 - requires G16]`

**Goal:** Ship the live interview demo.

- [ ] Deploy Supabase migrations.
- [ ] Deploy Supabase Edge Functions.
- [ ] Deploy Vercel app.
- [ ] Configure production secrets.
- [ ] Seed catalog and demo data.
- [ ] Run live UI discovery.
- [ ] Run signed webhook discovery.
- [ ] Run companion n8n loop.
- [ ] Run MCP discovery.
- [ ] Verify share link.
- [ ] Verify export.
- [ ] Check free-tier budget.
- [ ] Rehearse green path.
- [ ] Document demo script.
- [ ] Confirm CI green.

**Proof:** Show live URL, Supabase function logs, completed report, n8n/Slack/Teams notification, MCP call, share/export proof, CI green, and demo runbook.

**Commit:** `chore(deploy): prepare live scout demo`
