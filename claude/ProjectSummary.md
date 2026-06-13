# Scout - Project Summary

> AI discovery agent for NorthBound Advisory: URL plus pain-point notes in, grounded consulting deliverable out.

This file is generated from `SPEC.md`. When there is any conflict, `SPEC.md` wins.

---

## Problem

NorthBound Advisory's early consulting workflow is high leverage but repetitive: understand the business, identify inefficiencies, scope opportunities, translate needs into requirements, sketch solution designs, draft automation artifacts, and write playbooks. Scout compresses that blank-page work into one automated pass that a consultant edits and approves.

The project is an interview centerpiece. It must be live before the interview, run the core app on Vercel plus Supabase free-tier infrastructure, demonstrate n8n and MCP, and produce the same kind of guides, technical notes, and playbooks the role asks for.

---

## Product Outcome

A consultant signs in, submits a client URL and notes, watches live progress, and receives an editable report containing:

- Business profile with evidence.
- Ranked automation opportunities with impact, effort, priority, quadrant, confidence, ROI, evidence, and NorthBound pillar.
- Catalog-constrained tool mappings with rationale and KPIs.
- Requirements brief for the top opportunity.
- Solution design for the top opportunity.
- Import-tested n8n workflow JSON for the top opportunity.
- Implementation playbook and technical note.
- Discovery-call questions.
- Readiness snapshot.
- Secure share link and export path.

Scout also ships a companion n8n automation:

`Supabase clients INSERT -> n8n -> Scout webhook -> discovery run -> report stored -> Slack/Teams notification`

The same core steps are exposed through a TypeScript MCP server for Claude Code.

---

## Core Constraint

The core app must not require a paid always-on worker. Vercel routes stay thin and return quickly. Supabase Edge Functions run DB-leased, I/O-bound LangGraph nodes. Postgres owns durable state through leases, checkpoints, run steps, and heartbeat recovery.

Claude tokens are the unavoidable per-run cost. n8n Community Edition is free software, but the public endpoint mode must be documented as local+tunnel, self-host, Cloud trial, or fallback.

---

## System Overview

```text
User
  -> Vercel Hobby / Next.js App Router
      - Supabase Auth
      - submit form
      - report viewer/editor
      - public share page
      - POST /api/discover
      - POST /api/webhook/scout
  -> Supabase
      - Postgres tables, RLS, migrations
      - Auth, Realtime, Storage
      - Edge Function `agent`
      - pg_cron heartbeat
      - pg_net wake-ups and DB webhooks
  -> Agent dependencies
      - Jina Reader
      - SSRF-checked fetch plus Readability
      - optional Firecrawl
      - Claude Opus 4.8 and Haiku 4.5
  -> Outputs
      - reports table
      - live run_steps feed
      - optional n8n/Slack/Teams notification
      - local MCP tools
```

The `agent/` package is shared by the Supabase Edge Function and the MCP server. There must be one TypeScript implementation of the graph nodes.

---

## Tech Stack

| Layer | Technology | Host |
|---|---|---|
| Frontend | Next.js App Router, TypeScript | Vercel Hobby |
| Thin API | Next.js route handlers | Vercel Hobby |
| Auth | Supabase Auth | Supabase |
| Database | Supabase Postgres, RLS, migrations | Supabase |
| Realtime | Supabase Realtime | Supabase |
| Storage | Supabase Storage | Supabase |
| Agent | Deno, Supabase Edge Functions, LangGraph.js, Anthropic TS SDK, Zod | Supabase Edge Functions |
| Durable orchestration | Postgres leases, `pg_cron`, `pg_net`, checkpoints | Supabase Postgres |
| Scrape | Jina Reader, safe fetch plus Readability, optional Firecrawl | External/direct |
| LLM | `claude-opus-4-8`, `claude-haiku-4-5` | Anthropic API |
| Automation | n8n Community Edition | local/self-host/Cloud trial/fallback |
| MCP | `@modelcontextprotocol/sdk` | local stdio for Claude Code |
| CI/CD | GitHub Actions, ESLint, tsc, Vitest, gitleaks, n8n import smoke test | GitHub |

Do not change this stack from implementation files. Change `SPEC.md` first if a stack decision changes.

---

## Architecture Decisions

### Thin Vercel Routes

Vercel only validates, authenticates, SSRF-checks, enqueues, and renders. It does not run the agent. Target route duration is under 5 seconds.

### Supabase Edge Function Agent

The `agent` Edge Function runs one graph node, or a few nodes while budget allows, per invocation. Nodes are I/O-bound and must fit Supabase Edge limits: 150 seconds wall-clock and 2 seconds CPU.

### Durable Postgres Leases

`pg_cron` and `pg_net` only wake work. Correctness comes from `runs.locked_by`, `runs.lease_until`, `runs.node_execution_id`, `runs.next_node`, `run_steps`, `agent_invocations`, and LangGraph checkpoints.

### LangGraph Checkpoint Proof

M0/M1 must prove a tiny deployed LangGraph.js graph can checkpoint and resume in Supabase Edge Functions. If the official Postgres checkpointer is unsuitable, keep the stack and write a minimal Supabase/PostgREST-backed adapter.

### Catalog-Grounded Tool Mapping

Claude may only recommend configured catalog IDs. Tool mapping uses strict structured output and enum validation. Out-of-catalog recommendations are rejected.

### n8n Template Filling

Generated workflows come from pinned-version, import-tested n8n templates. Claude selects an archetype and fills parameters only. Code merges, regenerates IDs/positions, validates structure, and imports into the pinned n8n version in CI.

### Security First

Scraped text is untrusted. Webhooks are HMAC authenticated. URL input is SSRF checked through every redirect. Secrets never reach the browser. RLS isolates tenants. Public share tokens are hashed, expiring, and revocable.

---

## Data Models

### `profiles`

- `id`: Supabase auth user id.
- `org_id`: tenant boundary.
- `role`: consultant role.

### `clients`

- `id`, `org_id`, `name`, `url`, `notes`, `source`, `created_by`, `status`.
- Insert can trigger Supabase Database Webhook to n8n.

### `runs`

- Execution record for one discovery run.
- Key fields: `normalized_url`, `notes_hash`, `idempotency_key`, `content_hash`, `status`, `next_node`, `attempts`, `heartbeat_at`, `locked_by`, `lease_until`, `node_execution_id`, `trigger_source`, `error`, `cost_usd`, `usage`.
- Unique partial index on active `idempotency_key`.
- Lease fields prevent duplicate node ownership.

### `run_steps`

- Live progress and per-node telemetry.
- Key fields: `org_id`, `run_id`, `node`, `node_execution_id`, `status`, `detail`, token counts, cache token counts, `cost_usd`, `created_at`.
- Pruned periodically.

### `scrape_pages`

- Deduplicated raw scrape cache.
- Key fields: `normalized_url`, `source_url`, `content_hash`, `title`, `markdown`, `scrape_meta`, `expires_at`.
- Checkpoints store page IDs/hashes rather than full markdown.

### `reports`

- Final deliverable.
- Stores `business_profile`, `opportunities`, `ranked`, `requirements`, `solution_design`, `discovery_questions`, `top_workflow`, `playbook`, `readiness`, `summary`, `version`, and share-token hash/expiry/revocation fields.

### `tools`

- Editable tool catalog seeded from `agent/catalog.yaml`.
- Includes `id`, `org_id`, `name`, `category`, `pillars`, `what_it_does`, `best_for`, `integrates_with`, `effort`, `cost_tier`, `notes`, `enabled`.

### `agent_invocations`

- Observability for self-chain, cron, and manual invocations.
- Not relied on as a queue.

### `langgraph_checkpoints`

- Managed by official checkpointer or adapter.
- Resume point for decomposed agent execution.
- Old checkpoints are pruned or compacted.

---

## RLS Rules

- Every app table has RLS enabled.
- Child/support tables carry `org_id` directly where needed.
- Policies should be simple: the row `org_id` must match the current profile `org_id`.
- Service-role key lives only in server/Edge secrets.
- Browser receives only Supabase anon key plus RLS.
- Public report view uses hashed token lookup plus expiry/revocation checks.
- CI must test cross-org isolation for every table.

---

## Agent State

`ScoutState` contains:

- Inputs: `run_id`, `client_id`, `url`, `notes`, `options`.
- Scrape: page references, scrape metadata, scrape error.
- Analysis: business profile, opportunities, ranked opportunities.
- Lifecycle additions: requirements, solution design, discovery questions, top workflow, playbook.
- Control: critique findings, revision flag, revision count, recoverable errors, usage, report, `next_node`.

`next_node` is persisted on the `runs` row. The invocation boundary is between nodes, not inside a held call stack.

---

## Agent Nodes

1. `scrape_site`: Jina-first scrape, safe fetch fallback, optional Firecrawl, manual low-signal mode.
2. `profile_business`: structured business profile from delimited untrusted scraped content.
3. `identify_opportunities`: evidence-backed automation opportunities classified into NorthBound pillars.
4. `score_and_rank`: deterministic priority, impact/effort/confidence, and 2x2 quadrant.
5. `map_tools`: strict catalog ID mapping with primary and alternatives.
6. `draft_requirements`: top-opportunity requirements brief.
7. `solution_design`: catalog-grounded design, data flow, integrations, risks, security notes.
8. `generate_workflow`: n8n archetype selection, parameter fill, merge, validation, fallback.
9. `discovery_questions`: 5-8 targeted questions for unknowns.
10. `write_playbook`: implementation playbook and technical note.
11. `critique`: grounding, citations, catalog validity, feasibility, injection artifacts, revision loop.
12. `finalize`: assemble report, persist, mark complete, notify.

Graph order:

```text
scrape -> profile -> opportunities -> score -> map_tools -> requirements -> solution_design -> generate_workflow -> questions -> playbook -> critique -> loop or finalize
```

Optional interrupt after `score_and_rank` lets the consultant adjust or drop opportunities before expensive lifecycle nodes.

---

## Run Lifecycle

1. Trigger from UI, webhook, MCP, or `clients` insert.
2. Normalize URL.
3. Compute pre-scrape idempotency key.
4. Insert queued run or return existing active run.
5. Fire-and-forget invoke `agent`.
6. Heartbeat wakes queued or expired-lease runs within about one minute.
7. `agent` atomically acquires lease.
8. If no lease is acquired, exit.
9. Load checkpoint.
10. Execute next node within budget.
11. Transactionally write run step, checkpoint, next node, heartbeat, telemetry, and lease update.
12. Ignore stale writes from old `node_execution_id`.
13. Self-chain or wait for heartbeat.
14. On completion, write report and notify.
15. On node failure, retry with backoff up to three attempts, then mark failed and keep partial output.

---

## Scrape Strategy

1. Try Jina Reader: `https://r.jina.ai/<url>`.
2. If weak or blocked, use direct `fetch` plus Readability only after SSRF validation.
3. If still weak, optionally use Firecrawl.
4. If all fail or validation is ambiguous, use notes/manual paste and mark low-signal mode.
5. Cap pages to high-signal pages: home, about, product/services, pricing, careers.
6. Store raw markdown once in `scrape_pages`.

Direct fetch must:

- Allow only `http` and `https`.
- Normalize host.
- Resolve DNS.
- Block private, loopback, link-local, and cloud metadata IPs.
- Block risky ports.
- Disable automatic redirect following.
- Validate every redirect target before fetching.

---

## n8n Requirements

Two workflows exist:

- Companion workflow: built and shipped in `n8n/companion-workflow.json`.
- Generated workflow: produced per report from template archetypes.

Companion flow:

```text
Supabase clients INSERT
  -> n8n Webhook Trigger
  -> build payload
  -> HTTP POST Scout /api/webhook/scout with HMAC
  -> wait or poll until run completed
  -> format top opportunity and share link
  -> Slack or Microsoft Teams notification
  -> Error Trigger to alert channel
```

Generated workflow archetypes:

- `scheduled-scrape-summarize-notify`
- `webhook-enrich-store`
- `form-to-crm`
- `inbound-email-triage`
- `rag-faq-skeleton`

Credential placeholders must be generic: `SLACK_CREDENTIALS`, `SUPABASE_CREDENTIALS`, and similar. Do not generate names from client text.

---

## MCP Tools

- `run_discovery(url, notes)`.
- `scrape_company(url)`.
- `profile_business(content, notes)`.
- `identify_opportunities(profile)`.
- `map_tools(opportunities)`.
- `generate_n8n_workflow(opportunity)`.
- `write_playbook(opportunity, design)`.

MCP runs over stdio for Claude Code and imports shared `agent/` modules.

---

## Tool Catalog

Seed 30-45 tools, grounded in NorthBound and the role:

- Microsoft 365 Copilot, Copilot Studio, Power Automate, Power Apps, Power BI, Teams, SharePoint, Outlook, Dataverse, Microsoft Fabric.
- Azure, Azure Functions, Azure OpenAI/AI, AWS, Supabase, Vercel, Netlify.
- n8n, Make, Power Automate, Zapier.
- Snowflake, Postgres, Airtable, Power BI, Fabric, Metabase, Hex.
- Claude API, Azure OpenAI/OpenAI, LangGraph/LangChain, MCP, pgvector, Pinecone.
- Jina Reader, Firecrawl, Tavily.
- Dynamics 365, HubSpot, Salesforce.
- Slack, Notion, Asana, Monday, Jira, GitHub.
- Intercom, Zendesk.

Each tool has name, category, pillars, what it does, best-for use cases, integrations, effort, cost tier, notes, and enabled status.

---

## API Reference

### Public

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/r/[share_token]` | Hash token, check expiry/revocation, render redacted report |
| POST | `/api/webhook/scout` | HMAC-authenticated public webhook, enqueue run |

### Protected

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/discover` | Validate URL/notes, dedupe, enqueue run, return run_id |
| GET | `/app` | Dashboard |
| GET | `/app/runs/[run_id]` | Run progress and report editor |
| POST | `/api/reports/[report_id]/share` | Create hashed expiring share token |
| POST | `/api/reports/[report_id]/revoke` | Revoke share token |
| GET | `/api/catalog` | Read tool catalog |
| PATCH | `/api/catalog/[tool_id]` | Update catalog entry |

### Edge Functions

| Method | Function | Purpose |
|---|---|---|
| POST | `agent` | Acquire lease, run node, checkpoint, self-chain |
| POST | `webhook-discover` | Optional direct Supabase webhook |
| GET | `healthz` | Optional liveness |

---

## Security and Guardrails

- Wrap scraped text in `<scraped_content>` delimiters.
- Treat content inside delimiters as data only.
- Keep agent tools read/analyze-only.
- Verify HMAC on every webhook.
- Prefer caller-provided idempotency key.
- Otherwise compute pre-scrape idempotency key.
- Rate-limit per caller/user.
- SSRF-check every URL and redirect.
- Store secrets only in Vercel/Supabase/GitHub secret stores.
- Keep service-role key out of browser bundles.
- Run gitleaks in CI.
- Use public pages only.
- Respect robots where applicable.
- Cap pages and retention.
- Do not harvest or store personal data.
- Pause optional nodes near token budget.

---

## Evaluation and Quality

CI must include:

- ESLint.
- TypeScript typecheck.
- Vitest unit tests.
- Deterministic fixture evals.
- n8n pinned-version import smoke test.
- Catalog existence checks for every recommended tool.
- Citation-to-scraped-text checks.
- Structured-output refusal and `max_tokens` handling tests.
- RLS isolation tests for every table.
- gitleaks secret scan.
- No client-specific credential names in output.

Optional/gated:

- LLM-as-judge on golden fixtures for grounding, actionability, citation accuracy, tool mapping, n8n importability, and requirements/design feasibility.
- LangSmith tracing.

Observability comes from `run_steps`, `agent_invocations`, lease fields, checkpoint tables, usage, cache read/create token counts, and cost per run.

---

## Documentation Deliverables

- `README.md`: consultant playbook.
- `docs/ARCHITECTURE.md`: system diagram and decomposition rationale.
- `docs/adr/`: Edge Functions, n8n templates, catalog grounding, Jina-first scraping, pg_cron heartbeat.
- `docs/RUNBOOK.md`: deploy, rotate secrets, seed catalog, failed runs, expired leases, stalled runs, n8n retry, share-token revocation, free-tier monitoring.
- `docs/SECURITY.md`: operator security checklist.

---

## Repository Layout

```text
scout/
  SPEC.md
  README.md
  docs/
  agent/
    graph.ts
    nodes/
    prompts/
    schemas.ts
    catalog.yaml
    scrape/
    n8n_templates/
    evals/
    fixtures/
  supabase/
    functions/agent/
    functions/webhook-discover/
    migrations/
    seed/
  mcp/
  web/
  n8n/
  .github/workflows/
```

---

## Delivery Milestones

- M0: foundations, schema, RLS, leases, cron, secrets, CI skeleton, deployed hello checkpoint proof.
- M1: local core agent, nodes 1-5 and 8, structured outputs, catalog grounding, prompt caching telemetry, fixtures, lease/idempotency tests.
- M2: live Edge agent, decomposition, checkpointing, leases, heartbeat, webhook receiver, duplicate-wake safety.
- M3: frontend live vertical with auth, submit, Realtime progress, report view, 2x2, edit, share/export.
- M4: lifecycle nodes and pinned/import-tested n8n template library.
- M5: companion Supabase to n8n to Scout to Slack/Teams flow.
- M6: MCP tools and `.mcp.json`.
- M7: critique loop, evals, guardrails, observability, docs, seeded demo data, rehearsed green path.

---

## Open Decisions

- D1: confirm Supabase Edge Functions plus LangGraph.js vs. Python on Modal before M1. Recommendation: Edge Functions plus LangGraph.js.
- D2: choose n8n endpoint mode. Recommendation: Community Edition in Docker with local+tunnel or a chosen self-host target for interview.
- D3: replace seeded catalog with NorthBound's exact internal stack if available.
- D4: choose lifecycle breadth for live demo. Recommendation: requirements, design, and playbook for top opportunity.
- D5: keep auth to simple Supabase email auth and single-org v1.
- D6: use interview date to decide how far beyond M0-M3 to push.

---

## Red Lines

- Do not change the tech stack.
- Do not run agent work inline in Vercel.
- Do not trust `pg_cron`/`pg_net` as a queue.
- Do not execute without a DB lease.
- Do not dedupe initial runs by `content_hash`.
- Do not store raw scraped pages inside every checkpoint.
- Do not let scraped content act as instructions.
- Do not recommend out-of-catalog tools.
- Do not publish invalid n8n JSON.
- Do not leak client text into credential placeholder names.
- Do not expose service-role secrets to the browser.
- Do not store raw share tokens.
- Do not omit share expiry/revocation.
- Do not direct-fetch unsafe URLs or redirects.
- Do not silently accept structured-output failure modes.
- Do not assume prompt-cache savings without telemetry.
- Do not skip RLS tests.
- Do not add paid core app infrastructure.
- Do not autonomously deploy recommended client automations.

---

## Planned Expansion (post-P17) — implementation pending

> Additive scope from a research-driven planning pass (2026-06-13). This **does not change the tech
> stack or any Red Line above**, and SPEC.md still wins on any conflict. It is a forward-looking
> backlog layered on the working P17 system; nothing here is built yet.

The plan and its per-candidate critique live under `.claude/`:

- `.claude/INTEGRATION_PLAN.md` — constraint guardrails, clone/install-&-adapt register, and the
  sequenced waves (foundational/low-risk first; the durable-runtime checkpoint change last).
- `.claude/DECISION_LOG.md` — every candidate from `findings.md` / `findings-expansion.md` /
  `findings-deepdive.md` marked adopt / prototype / defer / reject with rationale.
- `.claude/PLANNING_RECONCILIATION.md` — findings cross-check (no drift, no invented tools) and the
  root-doc follow-ups (SPEC/README/docs are intentionally **not** edited yet).

Highest-leverage adopts: a shared **prompt-cache prefix** (not yet implemented in code), first-party
**structured outputs**, **n8n-mcp** as a build-time validator (closes the open P8 import smoke test),
and a hand-curated **`agent/patterns.yaml`** grounding layer. The backlog is tracked in
`claude/Progress.md` ("Post-P17 Expansion Backlog") and `claude/progress_manual.md`.
