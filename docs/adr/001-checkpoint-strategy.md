# ADR 001 — Checkpoint Strategy for Scout Edge Agent

**Status:** Accepted
**Date:** 2026-06-09

## Context

Scout decomposes its multi-minute LLM pipeline into one-node-per-invocation on Supabase Edge Functions
(Deno runtime). Each invocation must persist graph state to Postgres so the next node can resume
from where the previous one stopped, even across different Edge Function instances.

LangGraph.js ships an official Postgres checkpointer (`@langchain/langgraph-checkpoint-postgres`)
that writes to a `checkpoints` table using `pg` (node-postgres). This package cannot run on Deno
because it depends on Node.js `net` sockets — Deno's `npm:` compatibility layer does not expose
raw TCP sockets to userland modules at the time of writing.

Alternatives evaluated:

| Option | Verdict |
|--------|---------|
| `@langchain/langgraph-checkpoint-postgres` (official) | Rejected — `pg` is not Deno-compatible |
| `@langchain/langgraph` `MemorySaver` | Rejected — state lost between Edge invocations |
| Custom Supabase PostgREST adapter | **Chosen** |
| Upstash Redis checkpoint (via HTTP client) | Viable fallback; adds cost and dependency |

## Decision

Implement a custom `SupabaseCheckpointer` that calls Supabase's PostgREST HTTP API to read and
write rows in the `langgraph_checkpoints` table (defined in migration `20260609000100`).

The adapter is a thin wrapper around two PostgREST operations:

- `GET /rest/v1/langgraph_checkpoints?thread_id=eq.{id}&order=created_at.desc&limit=1` — load latest checkpoint
- `POST /rest/v1/langgraph_checkpoints` with `Prefer: resolution=merge-duplicates` — upsert checkpoint

The `checkpoint` column stores `ScoutGraphState` as JSONB. The `metadata` column stores a
projection (`{ nextNode, step }`) for cheap cron-side queue scanning without deserializing state.

The service-role key bypasses RLS for Edge Function writes; reads from authenticated contexts
use the standard org-scoped RLS policies.

## Consequences

**Positive**
- Zero extra npm/JSR dependencies; `fetch()` is built into both Deno and Node.js 18+.
- The same adapter code runs in the Edge Function and in the Node.js `agent/` workspace for tests.
- The `langgraph_checkpoints` table is already owned by Scout's migration; no separate infra.
- The schema (`thread_id`, `checkpoint_id`, `parent_checkpoint_id`, `checkpoint`, `metadata`)
  intentionally mirrors the official LangGraph.js Postgres schema, so a future migration to the
  official checkpointer requires only a driver swap.

**Negative / risks**
- The official `BaseCheckpointSaver` interface may evolve; the adapter will need updates if
  Scout later upgrades to use LangGraph.js graph wiring that depends on the checkpointer contract.
- PostgREST HTTP adds ~5–20 ms of round-trip latency per checkpoint operation. Given that each
  node is I/O-bound waiting on Claude (seconds), this overhead is negligible.
- The adapter does not implement `list()` (cursor-based checkpoint history). This is only needed
  for time-travel replay, which is not in scope for v1.
