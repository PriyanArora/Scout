# Scout — Architecture

## Overview

Scout is a durable AI agent that runs entirely on free-tier infrastructure. A Next.js frontend (Vercel Hobby) accepts discovery requests, which are processed by a Supabase Edge Function (Deno) that checkpoints each graph node to Postgres and self-chains to the next node.

```
┌─────────────────────────────────────────────────────────┐
│                   Client Layer                          │
│  Browser  │  n8n webhook  │  Claude Code MCP           │
└─────────────────┬────────────────────────┬─────────────┘
                  │                        │
         POST /api/discover        POST /api/webhook/scout
         (auth required)           (HMAC required)
                  │                        │
┌─────────────────▼────────────────────────▼─────────────┐
│              Next.js on Vercel Hobby                    │
│  /api/discover      /api/webhook/scout                  │
│  /app/(authed)/*    /share/[token]                      │
│  middleware.ts: auth guard                              │
└─────────────────────────────┬───────────────────────────┘
                              │ fire-and-forget fetch
                              │ x-scout-internal header
┌─────────────────────────────▼───────────────────────────┐
│           Supabase Edge Function: agent                 │
│  acquire_run_lease (atomic, pg stored proc)             │
│  load checkpoint from Postgres                          │
│  execute ONE graph node                                 │
│  write checkpoint + run_steps row                       │
│  complete_run_node / fail_run_node                      │
│  self-chain: fetch(self, next run_id)  ←────────────┐  │
│  return 200                                         │  │
│                                                     │  │
│  budget: 100 s wall time per invocation             │  │
└──────────────────────┬──────────────────────────────┘  │
                       │ PostgREST HTTP                   │
┌──────────────────────▼──────────────────────────────────┐
│                  Supabase Postgres                       │
│  runs · run_steps · checkpoints · reports               │
│  scrape_pages · tools · profiles · agent_invocations    │
│                                                         │
│  pg_cron: heartbeat (1 min) — reclaims expired leases   │
│  pg_cron: prune (daily) — removes old scrape cache      │
│  pg_net: used by heartbeat to re-invoke Edge Function   │
└─────────────────────────────────────────────────────────┘
```

## Graph Nodes

The 12-node pipeline processes one URL end-to-end:

| # | Node | Model | Description |
|---|------|-------|-------------|
| 1 | `scrape_site` | — | Jina Reader + optional Firecrawl; stores in `scrape_pages` |
| 2 | `profile_business` | Opus | Extract structured company profile with evidence |
| 3 | `identify_opportunities` | Opus | Identify 3–6 automation/AI opportunities, cite evidence |
| 4 | `score_and_rank` | — | Deterministic impact/effort scoring + quadrant assignment |
| 5 | `map_tools` | Haiku | Map each opportunity to catalog IDs; reject out-of-catalog |
| 6 | `draft_requirements` | Opus | Requirements brief for the top opportunity |
| 7 | `solution_design` | Opus | High-level solution architecture |
| 8 | `generate_workflow` | Haiku | Select n8n archetype; fill placeholders |
| 9 | `discovery_questions` | Haiku | 5–8 discovery questions for the client meeting |
| 10 | `write_playbook` | Opus | Implementation playbook (markdown) |
| 11 | `critique` | Opus | Self-critique; flag low confidence / missing evidence |
| 12 | `finalize` | — | Write `reports` row; set `runs.status = completed` |

Expensive judgement nodes (2, 3, 6, 7, 10, 11) use `claude-opus-4-8`. Cheap structured-output nodes (5, 8, 9) use `claude-haiku-4-5`. Deterministic nodes (4, 12) make no LLM calls.

## Durability Model

### Lease-based Concurrency

Each run holds a Postgres-level lease (`runs.locked_by`, `runs.lease_until`). The `acquire_run_lease` stored procedure atomically claims the lease using `FOR UPDATE SKIP LOCKED`. If a second invocation arrives for the same run (e.g., duplicate cron fire), it exits immediately when the lease is held by another worker.

### Checkpoint Resume

State is stored as JSONB in `langgraph_checkpoints(thread_id, checkpoint_id, parent_checkpoint_id, checkpoint, metadata)`. On each invocation the function:

1. Reads `MAX(created_at)` checkpoint for `thread_id = run_id`
2. Executes the node indicated by `checkpoint.metadata.nextNode`
3. Writes a new checkpoint row with updated state

If the function crashes mid-node, the checkpoint is unchanged. The next invocation (from cron heartbeat) resumes from the last stable checkpoint. See ADR 001 for the checkpointer design decision.

### Self-Chain

After writing the checkpoint, the function fires a `fetch()` to itself (fire-and-forget) with the same `run_id`. This starts the next node ~100 ms later without any scheduler involvement. If the fetch is dropped (e.g., the function is evicted before the fetch completes), the `pg_cron` heartbeat fires within ~1 minute and re-invokes the function, which re-acquires the lease and continues from the checkpoint.

### Retry and Failure

Each node tracks `runs.attempts`. `fail_run_node` increments attempts and sets `status = retrying`. After 3 attempts, the run is marked `failed`. The `critique` node logs low-confidence flags but does not count as a failure.

## Security Boundaries

| Boundary | Protection |
|---|---|
| Webhook entry | HMAC-SHA256 (v0=...), 5-minute timestamp drift window |
| UI entry | Supabase Auth (JWT); RLS on all tables |
| Edge Function | `x-scout-internal` secret header; not reachable from browser |
| Share links | High-entropy (32-byte) token; only SHA-256 hash stored in DB; expiry + revocation |
| Scraped URLs | `isSafeUrl()` rejects private IPs (RFC 1918, link-local, loopback) before every fetch |
| All redirects | SSRF check applied at every redirect hop, not just the initial URL |

## Data Model (abbreviated)

```sql
runs           (id, org_id, url, notes, status, next_node, locked_by, lease_until,
                node_execution_id, idempotency_key, attempts, total_cost_usd)
run_steps      (id, run_id, org_id, node, status, started_at, finished_at,
                input_tokens, output_tokens, cost_usd, error)
langgraph_checkpoints (thread_id, checkpoint_id, parent_checkpoint_id, checkpoint, metadata)
reports        (id, run_id, org_id, business_profile, opportunities, requirements,
                solution_design, top_workflow, playbook, discovery_questions, readiness,
                share_token_hash, share_expires_at, share_revoked_at)
scrape_pages   (id, run_id, url, content_hash, content, scraped_at, expires_at)
tools          (id, name, category, description, vendor, tier)
agent_invocations (id, run_id, invocation_id, node, started_at, finished_at, status)
```

## Cost Model

| Category | Cost |
|---|---|
| Supabase Free | $0 (500 MB DB, 500K Edge invocations/month) |
| Vercel Hobby | $0 (serverless, no long-running compute needed) |
| Claude Haiku 4.5 | ~$0.0008/K input · $0.004/K output |
| Claude Opus 4.8 | ~$0.015/K input · $0.075/K output |
| Typical run | $0.20–$0.50 in API tokens |

At 20 runs/month on Claude API, total cost is $4–$10/month in tokens, with $0 in infrastructure.

## Monorepo Layout

```
agent/          TypeScript workspace — graph nodes, schemas, n8n tools, evals
  src/
    nodes/      12 graph node handlers
    prompts/    System + user prompts for each LLM node
    n8n/        Archetype selector, merger, validator, generate
    scrape/     Jina client, Firecrawl client, scrape service
    utils/      Catalog, cost, HMAC, URL, idempotency
    checkpoint/ Checkpointer types + interface
  n8n_templates/  5 n8n archetype JSON templates
  evals/        Deterministic eval runner + golden fixtures
  fixtures/     Scrape fixtures for offline testing

web/            Next.js 15 App Router on Vercel Hobby
  src/
    app/        Route handlers + page components
    components/ DiscoveryForm, RunProgress, ReportViewer, etc.
    lib/        Supabase clients, HMAC, URL utils, share-token

supabase/
  migrations/   Single migration file (all DDL)
  seed/         Catalog seed
  functions/
    agent/      Durable runtime dispatcher (index.ts)
  tests/        SQL lease tests

mcp/            MCP stdio server — 5 tools for Claude Code

n8n/            Companion workflow JSON + SETUP.md

docs/
  adr/          Architecture Decision Records
  ARCHITECTURE.md  (this file)
  RUNBOOK.md    Deployment and operations
  SECURITY.md   Security model and incident response
```
