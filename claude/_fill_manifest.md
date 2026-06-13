# Fill Manifest

Generated from `SPEC.md` during G0.6. This is the source file for the active Claude guidance files. It is intentionally project-specific and contains no placeholders.

---

## Identity

name: Scout

tagline: An AI discovery agent for NorthBound Advisory that turns a client URL and pain-point notes into a grounded, editable consulting deliverable.

problem: NorthBound-style discovery, opportunity scoping, requirements drafting, solution design, automation artifact creation, and playbook writing are high-leverage but repetitive. Scout removes the blank page by producing a 2-minute draft that a consultant edits and approves. It is built as an interview centerpiece that demonstrates deployed apps, Supabase/Vercel infrastructure, n8n automation, MCP, and consultant-ready documentation.

type: portfolio interview centerpiece with production-grade architecture constraints

category: web

core_constraint: The core app must run live on Vercel plus Supabase free-tier infrastructure without an always-on paid worker, while keeping the agent durable, idempotent, secure, catalog-grounded, and resumable.

---

## Developer

dev_name: Aaryan Kapoor

dev_level: Not specified in `SPEC.md`; mentor as a self-directed builder and require proof for every gate.

dev_knows: The project is designed to demonstrate Claude Code, Supabase, Vercel/Next.js, n8n, APIs, webhooks, TypeScript, and automation patterns.

dev_gaps: Must prove LangGraph.js on Supabase Edge Functions, durable DB leases, RLS, SSRF hardening, prompt-caching measurement, structured-output handling, n8n import validation, and MCP integration.

dev_goal: Build and explain Scout independently as a live NorthBound interview artifact, including the architecture tradeoffs, safety controls, deployment path, and demo runbook.

---

## Tech Stack

| Layer | Technology | Host |
|---|---|---|
| Frontend | Next.js App Router, TypeScript | Vercel Hobby |
| Thin API | Next.js route handlers | Vercel Hobby |
| Auth | Supabase Auth | Supabase |
| Database | Supabase Postgres, RLS, migrations | Supabase free tier |
| Realtime | Supabase Realtime progress feed | Supabase |
| Storage | Supabase Storage for PDF/export artifacts | Supabase |
| Agent runtime | Supabase Edge Functions, Deno, LangGraph.js, Anthropic TS SDK | Supabase Edge Functions |
| Durable orchestration | Postgres leases, `pg_cron`, `pg_net`, LangGraph checkpoints | Supabase Postgres |
| Scraping | Jina Reader primary, SSRF-checked `fetch` plus Readability fallback, optional Firecrawl | Jina/direct/optional Firecrawl |
| LLM | Claude Opus 4.8 and Claude Haiku 4.5 via Anthropic API | Anthropic |
| Schemas | Zod, LangGraph state annotations | Shared TypeScript package |
| Automation | n8n Community Edition companion workflow | Local Docker, self-host, Cloud trial, or documented fallback |
| MCP | `@modelcontextprotocol/sdk`, stdio server | Local Claude Code |
| CI/CD | GitHub Actions, ESLint, tsc, Vitest, gitleaks, n8n import smoke test | GitHub |
| Deployment | Vercel auto-deploy, Supabase CLI migrations/functions deploy | Vercel and Supabase |

No tech-stack substitution is allowed without updating `SPEC.md` first.

---

## Commit Config

scopes: init, tooling, db, rls, cron, edge, agent, scrape, catalog, prompts, schemas, n8n, mcp, web, auth, reports, share, security, evals, ci, docs, deploy

tdd_targets: URL normalization, SSRF validation, idempotency-key generation, lease acquisition, stale-write rejection, run-state transition selection, scrape-cache keying, catalog enum validation, n8n template merge, n8n connection validation, structured-output parser, token-cost accounting, share-token hashing, RLS helper assumptions, webhook signature verification

docker_phase: P14 for n8n local demo; Docker must not be introduced earlier except for local n8n import smoke testing when that gate requires it.

ci_phase: P2 for initial workflow skeleton, then expanded in P5, P8, P10, P16, and P17.

package_manager: npm. `SPEC.md` does not require a package-manager change; keep npm workspaces unless the spec is updated.

---

## Architecture Decisions

D1_title: Thin Vercel routes, no long-running Vercel work
D1_decision: Vercel handles UI, auth session checks, SSRF validation, webhook authentication, enqueue, and report rendering only.
D1_why: Vercel function duration is plan and runtime dependent. The spec avoids relying on long Vercel requests by returning fast and moving agent work to Supabase Edge Functions.

D2_title: Supabase Edge Functions plus DB-leased node execution
D2_decision: The agent runs one I/O-bound graph node, or a few while budget allows, per Supabase Edge Function invocation.
D2_why: Supabase Edge Functions have 150 s wall-clock and 2 s CPU limits. Claude and scrape waits are I/O-bound; DB leases prevent duplicate ownership.

D3_title: Postgres owns durable orchestration
D3_decision: `runs.next_node`, `locked_by`, `lease_until`, `node_execution_id`, run steps, and checkpoints are persisted in Postgres.
D3_why: `pg_cron` and `pg_net` are wake-up mechanisms, not queues. Durable state and idempotent leases provide correctness.

D4_title: LangGraph.js with early checkpoint proof
D4_decision: Use LangGraph.js and Postgres checkpointing if M0/M1 proves it works in Supabase Edge Functions; otherwise keep the stack and implement a minimal Supabase/PostgREST-backed checkpointer adapter.
D4_why: Checkpointing is load-bearing for resume, self-chain recovery, and tab-close durability.

D5_title: Jina-first layered scraping
D5_decision: Use Jina Reader first, then SSRF-checked direct fetch plus Readability, then optional Firecrawl, then manual-content low-signal mode.
D5_why: It keeps the default path free, handles JS-rendered sites, and bounds risk when direct fetching is unsafe.

D6_title: Tool catalog grounding
D6_decision: Recommendations must come from the configured catalog, with strict enum validation of catalog IDs and NorthBound pillars.
D6_why: Hallucinated tools or unsupported integrations would hurt demo credibility.

D7_title: n8n template filling, not free generation
D7_decision: Maintain pinned-version, import-tested n8n templates. Claude selects an archetype and fills parameters only; code merges, regenerates IDs/positions, validates, and import-tests.
D7_why: n8n workflow JSON is version-sensitive and generated arbitrary workflows are likely to fail import.

D8_title: HMAC-authenticated at-least-once webhooks
D8_decision: All webhook routes verify HMAC, dedupe by caller key or pre-scrape key, rate-limit, enqueue, and return 202 quickly.
D8_why: Public webhooks can be forged, spammed, retried, or delivered more than once.

D9_title: RLS with denormalized org_id on child tables
D9_decision: Every app table has RLS; child/support tables carry `org_id` directly where needed for simple policies.
D9_why: Join-based child policies are fragile. Cross-org isolation must be testable for every table.

D10_title: Public share links are hashed, expiring, and revocable
D10_decision: Store only `share_token_hash`, `share_expires_at`, and `share_revoked_at`; render a redacted public view.
D10_why: Raw share tokens in the DB are a leak risk, and permanent public links are hard to control.

D11_title: Prompt caching is measured, not assumed
D11_decision: Use explicit Anthropic cache breakpoints for stable prefixes and persist cache read/create token counts per node.
D11_why: Cache savings are optimization, not a guarantee; costs must be observable.

D12_title: Human-in-the-loop before expensive lifecycle nodes
D12_decision: Allow an optional interrupt after `score_and_rank` so a consultant can adjust/drop opportunities before requirements, design, workflow, and playbook generation.
D12_why: It improves quality, reduces over-trust, and bounds token cost.

---

## Data / Structure

### Web Models

model_1: profiles | id: uuid required equals auth.uid | org_id: uuid required | role: text required
model_2: clients | id: uuid required | org_id: uuid required | name: text required | url: text required | notes: text optional | source: text required | created_by: uuid required | status: text required
model_3: runs | id: uuid required | org_id: uuid required | client_id: uuid optional ref clients | normalized_url: text required | notes_hash: text required | idempotency_key: text required unique for active runs | content_hash: text optional | status: text enum queued/running/completed/failed | next_node: text optional | attempts: int required | heartbeat_at: timestamptz optional | locked_by: text optional | lease_until: timestamptz optional | node_execution_id: uuid optional | trigger_source: text enum ui/webhook/mcp | created_by: uuid optional | started_at: timestamptz optional | completed_at: timestamptz optional | error: jsonb optional | cost_usd: numeric optional | usage: jsonb optional
model_4: run_steps | id: uuid required | org_id: uuid required | run_id: uuid ref runs | node: text required | node_execution_id: uuid required | status: text required | detail: jsonb optional | input_tokens: int optional | output_tokens: int optional | cache_read_input_tokens: int optional | cache_creation_input_tokens: int optional | cost_usd: numeric optional | created_at: timestamptz required
model_5: scrape_pages | id: uuid required | org_id: uuid required | normalized_url: text required | source_url: text required | content_hash: text required | title: text optional | markdown: text required | scrape_meta: jsonb optional | created_at: timestamptz required | expires_at: timestamptz optional
model_6: reports | id: uuid required | org_id: uuid required | run_id: uuid ref runs | business_profile: jsonb required | opportunities: jsonb required | ranked: jsonb required | requirements: jsonb optional | solution_design: jsonb optional | discovery_questions: jsonb required | top_workflow: jsonb optional | playbook: text optional | readiness: jsonb required | summary: text required | share_token_hash: text optional | share_expires_at: timestamptz optional | share_revoked_at: timestamptz optional | version: int required | created_at: timestamptz required
model_7: tools | id: text required | org_id: uuid optional | name: text required | category: text required | pillars: text[] required | what_it_does: text required | best_for: text[] required | integrates_with: text[] required | effort: int required | cost_tier: text required | notes: text optional | enabled: boolean required
model_8: agent_invocations | id: uuid required | run_id: uuid ref runs | node: text optional | node_execution_id: uuid optional | source: text enum self_chain/cron/manual | status: text required | error: jsonb optional | created_at: timestamptz required
model_9: langgraph_checkpoints | managed_or_adapter_backed: true | thread_id: run_id | purpose: resume point for decomposed agent | pruning: required

### Systems Modules

module_1: web-submit | input: authenticated form url and notes | transform: validate, SSRF-check, normalize, compute pre-scrape idempotency key | output: queued run id
module_2: webhook-receiver | input: HMAC-signed payload | transform: verify, rate-limit, dedupe, enqueue | output: 202 with run_id
module_3: lease-runner | input: run_id | transform: atomic lease acquisition, load checkpoint, execute next node, persist step/checkpoint/run update | output: released or extended lease
module_4: scrape-service | input: normalized url | transform: Jina Reader, safe fetch fallback, optional Firecrawl, manual fallback | output: scrape_pages records and page references
module_5: agent-graph | input: ScoutState | transform: LangGraph node sequence with critique loop and optional interrupt | output: DiscoveryReport
module_6: catalog-service | input: opportunity and catalog | transform: strict enum-constrained tool mapping | output: primary and alternative tool mappings
module_7: n8n-template-service | input: top opportunity and parameter fills | transform: select archetype, merge template, regenerate IDs/positions, validate, import-test | output: import-tested workflow or fallback template
module_8: share-service | input: report id | transform: generate high-entropy token, store hash/expiry/revocation fields | output: public share URL
module_9: mcp-server | input: Claude Code MCP tool call | transform: call shared agent modules | output: report JSON or single-node result
module_10: eval-suite | input: fixtures and golden sites | transform: deterministic checks plus optional LLM judge | output: CI pass/fail and quality scores

### Screens

screen_1: Sign in | Supabase email auth entry | submit dashboard | public
screen_2: Submit discovery | collect client URL and pain-point notes | run progress | protected
screen_3: Run progress | stream run_steps via Realtime | report view | protected
screen_4: Report viewer/editor | show profile, opportunities, 2x2, requirements, design, workflow, playbook, questions, readiness | share/export | protected
screen_5: Public report | redacted read-only report by share token | none | public token
screen_6: Catalog admin | customize tools, pillars, mappings, enabled flags | report workflow | protected
screen_7: Settings | configure secrets status, n8n endpoint mode docs, org profile | dashboard | protected

---

## Seed / Fixtures / Test Data

strategy: Seed `tools` from `agent/catalog.yaml` with 30-45 NorthBound-grounded tools, prioritizing Microsoft 365/Copilot/Power Platform, Snowflake, Supabase, Vercel/Netlify, AWS/Azure, n8n/Make, Claude, LangGraph, MCP, Jina, Firecrawl, CRM, comms, support, and BI tools. Keep 5-10 golden public company fixtures with cached scrape markdown and hand-checked expected outputs. Seed one demo org, one profile, several clients, and rehearsed green-path runs. Seeds must be idempotent by stable IDs.

---

## Core Logic

logic:
1. Consultant, webhook, MCP, or `clients` insert triggers a run.
2. Normalize the URL and compute a pre-scrape idempotency key from client/caller, normalized URL, notes hash, trigger source, and time bucket or caller key.
3. Insert a queued run or return the active run for the same key.
4. Invoke the `agent` Edge Function fire-and-forget; `pg_cron` also wakes queued and expired-lease runs.
5. Atomically acquire the run lease by setting `locked_by`, `lease_until`, `node_execution_id`, and `status`.
6. Load the LangGraph checkpoint for `thread_id = run_id`.
7. Execute the next node within Supabase Edge wall/CPU limits.
8. Write a `run_steps` row, checkpoint update, `runs.next_node`, heartbeat, usage, cost, and lease update in one transaction.
9. Ignore stale writes whose `node_execution_id` no longer owns the run.
10. Self-invoke for the next node or rely on the heartbeat if self-chain delivery fails.
11. On node failure, increment attempts, clear lease, requeue with backoff, or mark failed after three attempts while keeping partial output.
12. On final node, write the report, mark the run completed, clear `next_node`, and notify via Realtime and optional n8n/Slack/Teams.
13. Cache scraped pages by normalized URL and content hash; checkpoints reference page IDs/hashes rather than duplicating markdown.
14. Record token usage, cache reads/creates, cost, and invocations for observability.

---

## Features

feature_1: Authenticated consultant can submit a client URL and pain-point notes.
feature_2: The run completes server-side even if the browser tab closes.
feature_3: Live progress streams from `run_steps` via Supabase Realtime.
feature_4: Scout scrapes a small set of high-signal pages with layered fallback.
feature_5: Business profile is grounded in scraped evidence.
feature_6: Opportunities are ranked by impact, effort, priority, confidence, evidence, ROI, and NorthBound pillar.
feature_7: Tool recommendations are constrained to the editable catalog.
feature_8: Top opportunity receives requirements brief, solution design, n8n workflow, and implementation playbook.
feature_9: Discovery questions target unresolved assumptions and gaps.
feature_10: Report is editable, versioned, shareable, and exportable.
feature_11: Public share links are hashed, expiring, revocable, and redacted by default.
feature_12: Companion n8n workflow demonstrates Supabase -> n8n -> Scout -> Slack/Teams.
feature_13: MCP server exposes full and partial agent steps to Claude Code.
feature_14: CI validates types, tests, fixtures, RLS, n8n imports, and secret scanning.
feature_15: Documentation includes README playbook, architecture, ADRs, runbook, and security checklist.

---

## Routes / Entry Points / Screens

### Web Routes

public_routes:
- GET /api/health | public | health check
- GET /r/[share_token] | public token | hash token, check expiry/revocation, render redacted report

auth_routes:
- Supabase email auth routes/pages | public | sign in and session handling

protected_routes:
- POST /api/discover | protected | validate input, SSRF-check URL, dedupe, enqueue run, return run_id
- GET /app | protected | dashboard
- GET /app/runs/[run_id] | protected | live progress and report view/editor
- POST /api/reports/[report_id]/share | protected | create hashed expiring share token
- POST /api/reports/[report_id]/revoke | protected | revoke share token
- GET /api/catalog | protected | read enabled tool catalog
- PATCH /api/catalog/[tool_id] | protected | update catalog metadata

webhook_routes:
- POST /api/webhook/scout | public HMAC | verify, rate-limit, dedupe, enqueue, return 202

edge_functions:
- POST supabase/functions/agent | internal | acquire lease, run next graph node, checkpoint, self-chain
- POST supabase/functions/webhook-discover | public HMAC optional | bypass Vercel webhook path if needed
- GET supabase/functions/healthz | internal/public optional | liveness

mcp_entry_points:
- run_discovery(url, notes) | stdio MCP | full graph to report JSON
- scrape_company(url) | stdio MCP | scrape node
- profile_business(content, notes) | stdio MCP | profile node
- identify_opportunities(profile) | stdio MCP | opportunities and ranking
- map_tools(opportunities) | stdio MCP | catalog-constrained mapping
- generate_n8n_workflow(opportunity) | stdio MCP | workflow archetype/template output
- write_playbook(opportunity, design) | stdio MCP | implementation playbook

---

## Red Lines

redline_1: Do not change the tech stack without changing `SPEC.md` first.
redline_2: Do not put agent work inside a long Vercel request.
redline_3: Do not trust `pg_cron` or `pg_net` as a durable queue.
redline_4: Do not run an agent node without first acquiring a DB lease.
redline_5: Do not write stale node output if `node_execution_id` no longer owns the run.
redline_6: Do not dedupe initial submissions by `content_hash`; it is unknown before scraping.
redline_7: Do not embed full scraped markdown inside every checkpoint.
redline_8: Do not let scraped text act as instructions.
redline_9: Do not recommend tools outside the catalog.
redline_10: Do not publish n8n JSON unless it passes structural validation and pinned-version import testing.
redline_11: Do not generate client-specific credential names.
redline_12: Do not expose the Supabase service-role key to the browser.
redline_13: Do not store raw public share tokens.
redline_14: Do not allow share links without expiry/revocation support.
redline_15: Do not direct-fetch a URL or redirect target without SSRF checks.
redline_16: Do not silently accept structured-output refusal, `max_tokens`, or schema failures.
redline_17: Do not assume prompt caching saved money unless telemetry proves it.
redline_18: Do not skip RLS tests for child/support tables.
redline_19: Do not add paid core app infrastructure.
redline_20: Do not implement autonomous execution of recommended automations; human approval is required.

---

## Env Vars

env_1: NEXT_PUBLIC_SUPABASE_URL | Supabase project URL for browser client | yes
env_2: NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key for browser client | yes
env_3: SUPABASE_URL | Supabase project URL for server/Edge | yes
env_4: SUPABASE_SERVICE_ROLE_KEY | Server-only service role key, Edge/server only | yes
env_5: ANTHROPIC_API_KEY | Claude API key | yes
env_6: SCOUT_WEBHOOK_SECRET | HMAC secret for Scout webhook | yes
env_7: AGENT_INTERNAL_SECRET | Shared secret for internal Edge Function invocation | yes
env_8: N8N_WEBHOOK_URL | Companion n8n endpoint for demo mode | no
env_9: N8N_HMAC_SECRET | Secret used by n8n when calling Scout | no
env_10: SLACK_WEBHOOK_URL | Slack fallback/notification endpoint | no
env_11: TEAMS_WEBHOOK_URL | Microsoft Teams notification endpoint | no
env_12: FIRECRAWL_API_KEY | Optional scrape fallback key | no
env_13: LANGSMITH_API_KEY | Optional tracing | no
env_14: VERCEL_URL | Deployment URL used in generated links | no
env_15: PUBLIC_APP_URL | Canonical app URL for share links and callbacks | yes
env_16: DATABASE_URL | Postgres connection for migrations/checkpointer if required | yes

---

## Phases

phase_1_name: Repo Setup
phase_1_goal: Establish the monorepo skeleton, toolchain, ignore rules, env example, and first conventional commit.
phase_1_proof: Show folder tree, `.gitignore`, `.env.example`, dependency install output, and `git log --oneline -1`.
phase_1_commit: chore(init): scaffold scout monorepo

phase_2_name: Tooling and CI Skeleton
phase_2_goal: Add workspace package setup, TypeScript configs, lint/typecheck scripts, test runner, and initial GitHub Actions workflows.
phase_2_proof: Show `pnpm lint`, `pnpm typecheck`, `pnpm test`, and workflow files.
phase_2_commit: ci(tooling): add workspace checks

phase_3_name: Supabase Schema and RLS
phase_3_goal: Create migrations for all tables, RLS policies, indexes, pg_cron jobs, and catalog seed.
phase_3_proof: Show migration files, local Supabase reset output, RLS isolation test output, and seeded catalog count.
phase_3_commit: feat(db): add scout schema and rls

phase_4_name: Edge Checkpoint Proof
phase_4_goal: Deploy or locally serve a tiny Edge Function graph that checkpoints and resumes under Supabase limits.
phase_4_proof: Show first invocation checkpoint write, second invocation resume, and documented adapter decision.
phase_4_commit: feat(edge): prove checkpoint resume

phase_5_name: Shared Schemas and Test-First Core Utilities
phase_5_goal: Implement Zod schemas and pure utilities with tests before code.
phase_5_proof: Show failing-then-passing tests for SSRF, idempotency, leases, catalog enum validation, token cost, and share-token hashing.
phase_5_commit: test(agent): cover core safety utilities

phase_6_name: Scrape Layer
phase_6_goal: Implement Jina-first scraping, SSRF-checked fetch fallback, optional Firecrawl, cache references, and low-signal mode.
phase_6_proof: Show fixture scrape tests, unsafe URL rejection tests, cache write/read tests, and low-signal fallback output.
phase_6_commit: feat(scrape): add safe layered scraping

phase_7_name: Local Agent Vertical
phase_7_goal: Build LangGraph nodes 1-5 and 9 with structured outputs, catalog grounding, fixtures, and a local full-report JSON.
phase_7_proof: Show local script output from fixture through business profile, opportunities, ranking, tool mapping, and questions.
phase_7_commit: feat(agent): build local discovery graph

phase_8_name: n8n Template Generation
phase_8_goal: Add pinned-version n8n templates, parameter filling, ID/position regeneration, validation, fallback, and import smoke test.
phase_8_proof: Show generated workflow JSON, structural validator output, pinned n8n import result, and invalid-output fallback test.
phase_8_commit: feat(n8n): validate template workflows

phase_9_name: Durable Edge Agent Runtime
phase_9_goal: Wire the full leased run lifecycle into the `agent` Edge Function with checkpointing, self-chain, heartbeat, retries, and stale-write rejection.
phase_9_proof: Show queued run advancing with tab closed, duplicate wake not duplicating Claude calls, expired lease reclaim, and failed-node retry.
phase_9_commit: feat(edge): run leased agent nodes

phase_10_name: Auth and Webhook Access Control
phase_10_goal: Add Supabase auth, protected discover route, HMAC webhook, rate limiting, service-role isolation, and public health route.
phase_10_proof: Show unauthorized rejection, signed webhook success, unsigned webhook 401, active-run dedupe, and no service-role key in client bundle.
phase_10_commit: feat(auth): secure run entry points

phase_11_name: Frontend Skeleton and Realtime Progress
phase_11_goal: Build sign-in, submit, run progress, dashboard shell, and Realtime subscription against real run_steps.
phase_11_proof: Show browser submission returning run_id, progress updates streaming, and tab-close resume behavior.
phase_11_commit: feat(web): add realtime discovery flow

phase_12_name: Report Viewer and Editor
phase_12_goal: Render the full deliverable: profile, opportunities, 2x2, ROI, citations, requirements, solution design, n8n workflow, playbook, questions, readiness, and edit flow.
phase_12_proof: Show completed report from real stored data, edit/save behavior, citation links, and low-signal rendering.
phase_12_commit: feat(reports): render editable deliverable

phase_13_name: Sharing and Export
phase_13_goal: Implement hashed expiring revocable share links, redacted public view, report versioning, and export path.
phase_13_proof: Show raw token absent from DB, expired/revoked token rejection, redacted public page, and export artifact.
phase_13_commit: feat(share): add secure report sharing

phase_14_name: Companion n8n Automation
phase_14_goal: Build and document Supabase clients insert -> n8n -> Scout webhook -> completion wait -> Slack/Teams notification.
phase_14_proof: Show selected endpoint mode, imported companion workflow, generic credentials, signed webhook call, and notification with report link.
phase_14_commit: feat(n8n): add companion lead loop

phase_15_name: MCP Server
phase_15_goal: Add TypeScript MCP server using the same agent modules and `.mcp.json` documentation.
phase_15_proof: Show Claude Code MCP config and successful calls to `run_discovery`, `map_tools`, `generate_n8n_workflow`, and `write_playbook`.
phase_15_commit: feat(mcp): expose scout tools

phase_16_name: Docs, Evals, and Observability
phase_16_goal: Add README playbook, architecture docs, ADRs, runbook, security checklist, golden fixtures, deterministic evals, optional LLM judge, and run observability.
phase_16_proof: Show docs index, eval output, n8n import check, gitleaks output, RLS tests, and per-node usage/cache telemetry.
phase_16_commit: docs(playbook): add scout operating guide

phase_17_name: Deploy and Rehearsed Demo
phase_17_goal: Deploy Vercel and Supabase, run full live demo, rehearse seeded green path, verify free-tier budgets, and finalize interview runbook.
phase_17_proof: Show live URL, Supabase function logs, completed report, n8n/Slack/Teams notification, MCP call, CI green, and demo runbook.
phase_17_commit: chore(deploy): prepare live scout demo
