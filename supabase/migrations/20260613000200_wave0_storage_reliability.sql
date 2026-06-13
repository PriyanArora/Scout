-- Wave 0 — $0 storage & reliability hygiene (INTEGRATION_PLAN §3 Wave 0).
-- Pure additive/reversible changes: no behavior change to the happy path.
--   1. LZ4 TOAST compression on the big columns (future writes; backfill for immediate effect).
--   2. Eager terminal-checkpoint drop + shorter scrape_pages TTL in prune_scout_data().
--   3. Exponential backoff + jitter in fail_run_node (replace flat now()+30s).

-- ---------------------------------------------------------------------------
-- 1. LZ4 compression on the big TOAST columns.
--    Correct DDL is SET COMPRESSION (not SET STORAGE). Affects future writes;
--    a no-op UPDATE backfill (documented in progress_manual.md) rewrites existing rows.
--    Requires Postgres >= 14 built with LZ4 (Supabase qualifies).
-- ---------------------------------------------------------------------------

alter table public.scrape_pages          alter column markdown            set compression lz4;

alter table public.reports               alter column business_profile    set compression lz4;
alter table public.reports               alter column opportunities        set compression lz4;
alter table public.reports               alter column ranked               set compression lz4;
alter table public.reports               alter column requirements         set compression lz4;
alter table public.reports               alter column solution_design      set compression lz4;
alter table public.reports               alter column discovery_questions  set compression lz4;
alter table public.reports               alter column top_workflow         set compression lz4;
alter table public.reports               alter column readiness            set compression lz4;
alter table public.reports               alter column playbook             set compression lz4;

alter table public.langgraph_checkpoints alter column checkpoint           set compression lz4;

-- ---------------------------------------------------------------------------
-- 2. Shorter scrape_pages TTL for the demo (30d -> 14d). Existing rows keep
--    their original expiry; new rows get 14 days. prune_scout_data() reaps them.
-- ---------------------------------------------------------------------------

alter table public.scrape_pages
  alter column expires_at set default (now() + interval '14 days');

-- ---------------------------------------------------------------------------
-- 3. prune_scout_data(): also drop checkpoints belonging to terminal runs.
--    Once a run is completed/failed/cancelled its checkpoints are dead weight
--    (terminal runs never resume), so they are pruned regardless of expires_at.
-- ---------------------------------------------------------------------------

create or replace function public.prune_scout_data()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.run_steps where created_at < now() - interval '30 days';
  delete from public.agent_invocations where started_at < now() - interval '30 days';
  delete from public.scrape_pages where expires_at < now();
  delete from public.langgraph_checkpoints where expires_at < now();
  -- Terminal-run checkpoints: dead weight (completed/failed/cancelled never resume).
  delete from public.langgraph_checkpoints c
  using public.runs r
  where c.thread_id = r.id::text
    and r.status in ('completed', 'failed', 'cancelled');
$$;

-- ---------------------------------------------------------------------------
-- 4. fail_run_node(): exponential backoff with jitter instead of flat 30s.
--    lease_until = now() + min(30 * 2^attempts, 1800)s + [0,15)s jitter.
--    With the 1-minute heartbeat this stops a transient 429/529 from thundering.
--    `attempts` here is the pre-increment value (0 on the first failure).
-- ---------------------------------------------------------------------------

create or replace function public.fail_run_node(
  p_run_id uuid,
  p_node_execution_id uuid,
  p_error jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.runs
  set
    attempts = attempts + 1,
    status = case when attempts + 1 >= max_attempts then 'failed' else 'retrying' end,
    error = p_error,
    node_execution_id = null,
    locked_by = null,
    lease_until = case
      when attempts + 1 >= max_attempts then null
      else now() + make_interval(secs =>
        least(30 * power(2, attempts)::int, 1800) + floor(random() * 15)::int)
    end,
    heartbeat_at = now()
  where id = p_run_id
    and node_execution_id = p_node_execution_id;

  return found;
end;
$$;
