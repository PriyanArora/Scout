# G0 - Completed Project Setup Record

G0 was completed from `SPEC.md` on 2026-06-08. This file records the answers that populated the manifest and active Claude files. It is retained for audit, not for asking the user the same setup questions again.

If implementation decisions conflict with this record, update `SPEC.md` first, then regenerate the Claude files.

---

## G0.1 Identity

1. Project name: Scout.
2. One-line description: Scout is an AI discovery agent for NorthBound Advisory that turns a client URL and pain-point notes into a grounded, editable consulting deliverable.
3. Problem solved: Discovery, opportunity scoping, requirements drafting, solution design, automation artifact creation, and playbook writing are repetitive but high-leverage consulting tasks. Scout removes the blank page and produces a consultant-approved draft quickly.
4. Project type: Portfolio interview centerpiece with production-grade architecture constraints.

Confirmation: Identity is complete from `SPEC.md`.

---

## G0.2 Developer Profile

1. Developer name: Aaryan Kapoor.
2. Experience level: Not specified in `SPEC.md`; mentor as self-directed and require proof.
3. Comfortable stack indicated by project goals: Claude Code, Supabase, Vercel/Next.js, n8n, APIs/webhooks, TypeScript, automation patterns.
4. Gaps to prove: LangGraph.js on Supabase Edge Functions, durable leases, RLS, SSRF, structured-output failure handling, prompt-cache telemetry, n8n import validation, MCP, live demo hardening.
5. End goal: Build and explain Scout independently as a deployed NorthBound interview artifact.

Confirmation: Developer profile is complete enough for build guidance. If the user provides a more precise skill profile later, update this record and `Claude_guide.md`.

---

## G0.3 Architecture and Category Detection

1. Thing being built: A full-stack web app plus agent runtime, companion automation, and MCP server.
2. Tech stack: TypeScript, Next.js App Router, Supabase, Supabase Edge Functions, Deno, LangGraph.js, Anthropic TS SDK, Zod, Jina Reader, safe fetch/Readability, optional Firecrawl, n8n Community Edition, MCP TypeScript SDK, Vercel, GitHub Actions, ESLint, tsc, Vitest, gitleaks.
3. Data/control flow: User or webhook enqueues run; Supabase Edge Function leases and runs graph nodes; Postgres stores state/checkpoints/progress/report; Realtime streams progress; n8n and MCP call the same core flows.
4. Key decisions:
   - Vercel is thin.
   - Supabase Edge Functions run leased nodes.
   - Postgres owns orchestration.
   - `pg_cron` and `pg_net` wake work but are not queues.
   - LangGraph checkpointing must be proven early.
   - Jina-first scraping with safe fallback.
   - Catalog-constrained tool mapping.
   - n8n template filling with import tests.
   - HMAC webhooks, RLS, SSRF, hashed share tokens.
5. Data: profiles, clients, runs, run_steps, scrape_pages, reports, tools, agent_invocations, langgraph_checkpoints.
6. Environment: Supabase URL/anon/service role, Anthropic key, Scout webhook secret, internal agent secret, public app URL, database URL, optional n8n/Slack/Teams/Firecrawl/LangSmith values.

Category: web.

Confirmation: Category is locked as web.

---

## G0.4 Features and Structure

### Core Features

- Submit client URL and pain-point notes.
- Run durable server-side discovery.
- Stream progress via Realtime.
- Produce business profile and ranked opportunities.
- Map recommendations to NorthBound-grounded catalog tools.
- Draft requirements, solution design, n8n workflow, playbook, questions, and readiness snapshot.
- Edit and share/export report.
- Trigger via HMAC webhook.
- Demonstrate companion n8n automation.
- Expose MCP tools to Claude Code.

### Frontend Pages

- Sign in: public.
- Submit discovery: protected.
- Run progress: protected.
- Report viewer/editor: protected.
- Public report: public token.
- Catalog admin: protected.
- Settings: protected.

### API Routes

- `GET /api/health`: public.
- `POST /api/discover`: protected.
- `POST /api/webhook/scout`: public HMAC.
- `GET /r/[share_token]`: public token.
- `POST /api/reports/[report_id]/share`: protected.
- `POST /api/reports/[report_id]/revoke`: protected.
- `GET /api/catalog`: protected.
- `PATCH /api/catalog/[tool_id]`: protected.

### Core Constraint

The core app must run on free-tier Vercel/Supabase infrastructure without a paid always-on worker.

### Third-Party Integrations

- Anthropic Claude API.
- Jina Reader.
- Optional Firecrawl.
- n8n Community Edition.
- Slack or Microsoft Teams webhook.
- Claude Code via MCP.
- Optional LangSmith.

Confirmation: Every feature maps to a route, Edge Function, MCP tool, or documented automation path.

---

## G0.5 Constraints and Red Lines

### Constraints

- One TypeScript-first monorepo.
- Core hosting on Vercel plus Supabase free tiers.
- n8n endpoint mode must be explicitly documented.
- Claude token cost must be bounded and observable.
- Agent must survive tab close and dropped self-chain.
- Demo must be rehearsed with seeded green-path data.

### Red Lines

- No tech-stack changes without `SPEC.md`.
- No long-running Vercel agent work.
- No queue semantics assigned to `pg_cron` or `pg_net`.
- No node execution without lease.
- No initial dedupe by `content_hash`.
- No raw scraped markdown duplicated into checkpoints.
- No scraped content treated as instructions.
- No out-of-catalog recommendations.
- No untested n8n JSON publication.
- No client-specific credential names.
- No service-role key in browser.
- No raw public share token storage.
- No unsafe direct fetch or redirect following.
- No silent structured-output failures.
- No assumed prompt-cache savings.
- No RLS gaps.
- No paid core app infrastructure.
- No autonomous deployment of recommended client automations.

Confirmation: Red lines are encoded in `Claude_guide.md`, `ProjectSummary.md`, `BuildFlow.md`, and `Progress.md`.

---

## G0.6 Critique and Cross-Check

The prior critique findings have been covered in `SPEC.md`:

1. Duplicate node execution -> DB leases, `node_execution_id`, stale-write rejection.
2. `pg_cron`/`pg_net` overstatement -> wake-up only, durable state in app tables.
3. Vercel timing staleness -> Vercel routes are enqueue-only and target under 5 seconds.
4. Prompt caching overpromise -> measured optimization with cache token telemetry.
5. Structured-output limits -> refusal, `max_tokens`, schema complexity, validation retry, recoverable errors.
6. n8n import risk -> pinned templates, parameter filling, validator, real import smoke test.
7. LangGraph checkpointing uncertainty -> M0/M1 proof and adapter fallback.
8. DB pressure -> `scrape_pages`, checkpoint references, pruning.
9. Initial idempotency error -> pre-scrape key and post-scrape content hash reuse.
10. Share-link risk -> hash, expiry, revocation, redacted public view.
11. RLS child-table risk -> `org_id` on child/support tables and isolation tests.
12. SSRF fallback risk -> manual redirect validation and unsafe fallback to Jina/manual.
13. n8n free endpoint caveat -> local+tunnel/self-host/Cloud trial/fallback documented.
14. Cost under-instrumentation -> per-node usage, cache hit/miss, cost telemetry, ceilings.

`critque.md` was deleted after this coverage check.

---

## G0.6 Generated Files

Active files:

- `claude/_fill_manifest.md`
- `claude/ProjectSummary.md`
- `claude/Claude_guide.md`
- `claude/BuildFlow.md`
- `claude/Progress.md`
- `claude/G0_questionnaire.md`

Deleted setup templates:

- The three category-specific ProjectSummary setup templates were removed after the active project summary was generated.

G0 status: complete.
