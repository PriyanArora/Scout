# ADR 002 — Supabase Edge Functions as the Agent Runtime

**Status:** Accepted
**Date:** 2026-06-09

## Context

Scout's agent pipeline makes 6–9 sequential LLM calls (Opus + Haiku), scrapes web pages via Jina, and must tolerate partial failures at any step. The total wall time per run is 60–180 seconds. We need a runtime that:

- Tolerates multi-minute execution without holding an HTTP connection open
- Runs at $0/month on free-tier infrastructure
- Is compatible with Deno (Supabase's runtime) and has no Node.js TCP socket dependencies
- Can be invoked programmatically by Next.js API routes and by `pg_cron`

Options evaluated:

| Option | Verdict |
|--------|---------|
| Vercel serverless function (10 s / 60 s hobby limit) | Rejected — too short for multi-LLM pipeline |
| Vercel Edge Runtime | Rejected — same duration limit, no pg connectivity |
| AWS Lambda | Rejected — adds cost, complexity, and deployment surface |
| Long-running Node.js server (Railway, Fly) | Rejected — adds cost; Scout must fit on $0/month |
| Supabase Edge Functions (Deno, 150 s limit) | **Chosen** |
| Background Jobs in Supabase (pg_cron + pg_net) | Chosen as recovery mechanism, not primary runtime |

## Decision

Use Supabase Edge Functions as the sole execution environment for agent nodes. Each invocation runs one graph node, writes a checkpoint, and self-chains to the next node. This turns a long sequential pipeline into many short sequential invocations, each well under the 150 s Supabase limit.

Internal invocations are authenticated with `x-scout-internal: <AGENT_INTERNAL_SECRET>` — a secret that is never exposed to the browser or webhook callers.

`pg_cron` fires a heartbeat every minute. If the self-chain is dropped (function eviction, network blip), the heartbeat invokes the Edge Function, which re-acquires the lease and resumes from the checkpoint.

## Consequences

**Positive**
- Zero runtime infrastructure cost on free tier (500K invocations/month)
- Deno 1.x runtime is Node.js-compatible for Web Crypto, `fetch`, `URL` — no polyfills needed
- Cold starts (~200–400 ms) only affect the first node; subsequent nodes are warm within a run
- The one-node-per-invocation pattern naturally enforces the 100 s wall budget guard

**Negative / risks**
- Supabase free tier allows only one concurrent Edge Function; a burst of runs will queue
- The 150 s hard limit means any single node consuming more than ~100 s (scrape + LLM) will fail; mitigation: the 100 s `WALL_BUDGET_MS` guard exits cleanly before the limit
- Deno's npm compatibility is incomplete for packages relying on raw Node.js TCP sockets — this is exactly why LangGraph's official Postgres checkpointer was replaced (see ADR 001)
