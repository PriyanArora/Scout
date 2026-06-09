# ADR 006 — pg_cron Heartbeat for Self-Chain Recovery

**Status:** Accepted
**Date:** 2026-06-09

## Context

Scout's agent pipeline chains 12 Edge Function invocations in sequence. Each invocation fires the next via a fire-and-forget `fetch()`. If that fetch is dropped (function eviction, transient network error, Supabase scheduler blip), the chain stops and the run stalls with no external trigger to resume it.

We need a recovery mechanism that:

- Costs $0 (no external scheduler like AWS EventBridge or Inngest)
- Can identify stalled runs and re-invoke the Edge Function
- Does not create duplicate concurrent invocations

Options evaluated:

| Option | Verdict |
|--------|---------|
| Client-side polling (browser refresh loops) | Rejected — breaks for background/headless invocations (webhook, MCP) |
| Vercel cron job | Limited to 1 cron/month on Hobby; not reliable for 1-minute cadence |
| External cron (GitHub Actions, etc.) | Adds external dependency; secret management complexity |
| pg_cron + pg_net (built into Supabase) | **Chosen** — zero cost, same Postgres instance, Deno-compatible |

## Decision

Enable `pg_cron` and `pg_net` in the Scout migration. Define two cron jobs:

**Heartbeat** (every minute):
```sql
SELECT cron.schedule('scout-heartbeat', '* * * * *', $$
  SELECT net.http_post(
    url := current_setting('app.agent_function_url'),
    body := jsonb_build_object('recovery', true),
    headers := jsonb_build_object('x-scout-internal', current_setting('app.agent_internal_secret'))
  )
  FROM runs
  WHERE status IN ('queued', 'running', 'retrying')
    AND (lease_until IS NULL OR lease_until < now() - interval '2 minutes')
  LIMIT 5;
$$);
```

The heartbeat selects up to 5 stalled runs (no active lease for > 2 minutes) and POSTs to the Edge Function for each. The Edge Function attempts to acquire the lease atomically — if another invocation already holds it, it exits harmlessly.

**Prune** (daily at 02:00 UTC):
```sql
SELECT cron.schedule('scout-prune', '0 2 * * *', $$
  DELETE FROM scrape_pages WHERE expires_at < now();
  DELETE FROM langgraph_checkpoints
    WHERE thread_id IN (SELECT id::text FROM runs WHERE created_at < now() - interval '30 days');
$$);
```

## Consequences

**Positive**
- Zero extra infrastructure cost; pg_cron is a Supabase built-in
- Recovery happens within 1 minute of a dropped chain
- The lease system prevents duplicate concurrent invocations — recovery is safe to fire redundantly
- The prune job keeps the `scrape_pages` and `checkpoints` tables from growing unbounded

**Negative / risks**
- pg_net HTTP calls from Postgres are fire-and-forget; there is no retry if the Edge Function URL is misconfigured
- `app.agent_function_url` and `app.agent_internal_secret` are Postgres settings that must be set as Supabase project secrets and synced to the `app.*` namespace via a migration or startup trigger
- The 1-minute heartbeat interval means a stalled run may wait up to ~1 minute before recovery; this is acceptable for a background pipeline
