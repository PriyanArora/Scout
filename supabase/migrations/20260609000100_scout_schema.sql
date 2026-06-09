-- Scout database backbone: durable runs, RLS, catalog, share lookups, and cron wake-ups.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_cron" with schema extensions;
create extension if not exists "pg_net" with schema extensions;

create type public.profile_role as enum ('consultant', 'admin');
create type public.client_status as enum ('new', 'queued', 'running', 'completed', 'failed', 'archived');
create type public.run_status as enum ('queued', 'running', 'retrying', 'completed', 'failed', 'cancelled');
create type public.run_step_status as enum ('queued', 'running', 'completed', 'failed', 'skipped');
create type public.agent_invocation_status as enum ('started', 'lease_unavailable', 'completed', 'failed');
create type public.run_trigger_source as enum ('ui', 'webhook', 'mcp', 'db_webhook', 'cron', 'manual');
create type public.scout_node as enum (
  'scrape_site',
  'profile_business',
  'identify_opportunities',
  'score_and_rank',
  'map_tools',
  'draft_requirements',
  'solution_design',
  'generate_workflow',
  'discovery_questions',
  'write_playbook',
  'critique',
  'finalize'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null default gen_random_uuid(),
  role public.profile_role not null default 'consultant',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or length(full_name) <= 160)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text,
  url text not null,
  normalized_url text,
  notes text not null default '',
  source public.run_trigger_source not null default 'ui',
  status public.client_status not null default 'new',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_url_length check (length(url) <= 2048),
  constraint clients_notes_length check (length(notes) <= 20000)
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  trigger_source public.run_trigger_source not null default 'ui',
  submitted_url text not null,
  normalized_url text not null,
  notes text not null default '',
  notes_hash text not null,
  idempotency_key text not null,
  content_hash text,
  status public.run_status not null default 'queued',
  next_node public.scout_node not null default 'scrape_site',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  locked_by text,
  lease_until timestamptz,
  node_execution_id uuid,
  heartbeat_at timestamptz,
  error jsonb,
  usage jsonb not null default '{}'::jsonb,
  cost_usd numeric(12,6) not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runs_url_length check (length(submitted_url) <= 2048 and length(normalized_url) <= 2048),
  constraint runs_attempts_non_negative check (attempts >= 0 and max_attempts > 0),
  constraint runs_cost_non_negative check (cost_usd >= 0)
);

create unique index runs_active_idempotency_key_idx
  on public.runs (org_id, idempotency_key)
  where status in ('queued', 'running', 'retrying');

create index runs_due_work_idx
  on public.runs (status, lease_until, created_at)
  where status in ('queued', 'running', 'retrying');

create table public.run_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  run_id uuid not null references public.runs(id) on delete cascade,
  node public.scout_node not null,
  node_execution_id uuid,
  status public.run_step_status not null,
  detail text,
  error jsonb,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  duration_ms integer,
  model text,
  created_at timestamptz not null default now(),
  constraint run_steps_tokens_non_negative check (
    input_tokens >= 0 and output_tokens >= 0 and cache_read_tokens >= 0 and cache_creation_tokens >= 0
  ),
  constraint run_steps_cost_non_negative check (cost_usd >= 0),
  constraint run_steps_duration_non_negative check (duration_ms is null or duration_ms >= 0)
);

create index run_steps_run_created_idx on public.run_steps (run_id, created_at);

create table public.scrape_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  normalized_url text not null,
  source_url text not null,
  content_hash text not null,
  title text,
  markdown text not null,
  scrape_meta jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  constraint scrape_pages_markdown_non_empty check (length(markdown) > 0),
  constraint scrape_pages_urls_length check (length(normalized_url) <= 2048 and length(source_url) <= 2048)
);

create unique index scrape_pages_cache_idx
  on public.scrape_pages (org_id, normalized_url, content_hash);

create index scrape_pages_expiry_idx on public.scrape_pages (expires_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  run_id uuid not null references public.runs(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft',
  summary text not null default '',
  business_profile jsonb not null default '{}'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  ranked jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '{}'::jsonb,
  solution_design jsonb not null default '{}'::jsonb,
  discovery_questions jsonb not null default '[]'::jsonb,
  top_workflow jsonb not null default '{}'::jsonb,
  playbook text not null default '',
  readiness jsonb not null default '{}'::jsonb,
  export_path text,
  share_token_hash text,
  share_expires_at timestamptz,
  share_revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_version_positive check (version > 0),
  constraint reports_share_expiry_required check (share_token_hash is null or share_expires_at is not null)
);

create unique index reports_run_version_idx on public.reports (run_id, version);
create unique index reports_share_token_hash_idx
  on public.reports (share_token_hash)
  where share_token_hash is not null;

create table public.tools (
  id text primary key,
  org_id uuid,
  name text not null,
  category text not null,
  pillars text[] not null default '{}',
  what_it_does text not null,
  best_for text[] not null default '{}',
  integrates_with text[] not null default '{}',
  effort integer not null,
  cost_tier text not null,
  notes text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tools_effort_range check (effort between 1 and 5)
);

create index tools_enabled_idx on public.tools (enabled);

create table public.agent_invocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  run_id uuid references public.runs(id) on delete cascade,
  invocation_id text not null,
  source public.run_trigger_source not null default 'manual',
  status public.agent_invocation_status not null default 'started',
  node public.scout_node,
  node_execution_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  wall_time_ms integer,
  error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint agent_invocations_wall_non_negative check (wall_time_ms is null or wall_time_ms >= 0)
);

create index agent_invocations_run_started_idx on public.agent_invocations (run_id, started_at);

create table public.langgraph_checkpoints (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  parent_checkpoint_id text,
  type text,
  checkpoint jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);

create index langgraph_checkpoints_expiry_idx on public.langgraph_checkpoints (expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create trigger runs_set_updated_at
  before update on public.runs
  for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

create trigger tools_set_updated_at
  before update on public.tools
  for each row execute function public.set_updated_at();

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.ensure_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, org_id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'org_id')::uuid, gen_random_uuid()),
    'consultant',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.ensure_profile();

create or replace function public.acquire_run_lease(
  p_run_id uuid,
  p_locked_by text,
  p_node_execution_id uuid,
  p_lease_seconds integer default 120
)
returns public.runs
language plpgsql
security definer
set search_path = public
as $$
declare
  leased public.runs;
begin
  update public.runs
  set
    locked_by = p_locked_by,
    lease_until = now() + make_interval(secs => p_lease_seconds),
    node_execution_id = p_node_execution_id,
    status = case when status = 'queued' then 'running' else status end,
    heartbeat_at = now()
  where id = p_run_id
    and status in ('queued', 'running', 'retrying')
    and (lease_until is null or lease_until < now() or locked_by = p_locked_by)
  returning * into leased;

  return leased;
end;
$$;

create or replace function public.complete_run_node(
  p_run_id uuid,
  p_node_execution_id uuid,
  p_next_node public.scout_node,
  p_usage jsonb default '{}'::jsonb,
  p_cost_usd numeric default 0
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.runs
  set
    next_node = p_next_node,
    node_execution_id = null,
    locked_by = null,
    lease_until = null,
    heartbeat_at = now(),
    attempts = 0,
    usage = coalesce(usage, '{}'::jsonb) || coalesce(p_usage, '{}'::jsonb),
    cost_usd = cost_usd + coalesce(p_cost_usd, 0)
  where id = p_run_id
    and node_execution_id = p_node_execution_id;

  return found;
end;
$$;

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
    lease_until = case when attempts + 1 >= max_attempts then null else now() + interval '30 seconds' end,
    heartbeat_at = now()
  where id = p_run_id
    and node_execution_id = p_node_execution_id;

  return found;
end;
$$;

create or replace function public.get_public_report_by_share_token_hash(p_share_token_hash text)
returns table (
  id uuid,
  run_id uuid,
  version integer,
  summary text,
  business_profile jsonb,
  opportunities jsonb,
  ranked jsonb,
  requirements jsonb,
  solution_design jsonb,
  discovery_questions jsonb,
  top_workflow jsonb,
  playbook text,
  readiness jsonb,
  export_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.run_id,
    r.version,
    r.summary,
    r.business_profile,
    r.opportunities,
    r.ranked,
    r.requirements,
    r.solution_design,
    r.discovery_questions,
    r.top_workflow,
    r.playbook,
    r.readiness,
    r.export_path,
    r.created_at
  from public.reports r
  where r.share_token_hash = p_share_token_hash
    and r.share_expires_at > now()
    and r.share_revoked_at is null
  limit 1;
$$;

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
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.runs enable row level security;
alter table public.run_steps enable row level security;
alter table public.scrape_pages enable row level security;
alter table public.reports enable row level security;
alter table public.tools enable row level security;
alter table public.agent_invocations enable row level security;
alter table public.langgraph_checkpoints enable row level security;

create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or org_id = public.current_org_id());

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy clients_org_all on public.clients
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy runs_org_all on public.runs
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy run_steps_org_select on public.run_steps
  for select to authenticated
  using (org_id = public.current_org_id());

create policy scrape_pages_org_all on public.scrape_pages
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy reports_org_all on public.reports
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy tools_org_or_global_select on public.tools
  for select to authenticated
  using (enabled and (org_id is null or org_id = public.current_org_id()));

create policy tools_org_write on public.tools
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy agent_invocations_org_select on public.agent_invocations
  for select to authenticated
  using (org_id = public.current_org_id());

revoke all on function public.get_public_report_by_share_token_hash(text) from public;
grant execute on function public.get_public_report_by_share_token_hash(text) to anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname in ('scout-heartbeat', 'scout-prune');

select cron.schedule(
  'scout-heartbeat',
  '* * * * *',
  $$
    select net.http_post(
      url := current_setting('app.settings.agent_function_url', true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scout-internal-secret', current_setting('app.settings.agent_internal_secret', true)
      ),
      body := jsonb_build_object('source', 'cron')
    )
    where coalesce(current_setting('app.settings.agent_function_url', true), '') <> ''
      and coalesce(current_setting('app.settings.agent_internal_secret', true), '') <> ''
      and exists (
        select 1
        from public.runs
        where status in ('queued', 'running', 'retrying')
          and (lease_until is null or lease_until < now())
      );
  $$
);

select cron.schedule(
  'scout-prune',
  '17 3 * * *',
  $$ select public.prune_scout_data(); $$
);
