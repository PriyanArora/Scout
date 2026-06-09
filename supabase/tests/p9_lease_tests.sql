-- P9 lease tests: duplicate wake prevention and expired-lease recovery.
-- Run after `supabase db reset`:
--   supabase db execute --file supabase/tests/p9_lease_tests.sql

begin;

-- Seed minimal run row
insert into public.runs (
  id, org_id, status, next_node, submitted_url, normalized_url, notes, notes_hash, idempotency_key
) values (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'queued',
  'scrape_site',
  'https://example.com',
  'https://example.com/',
  '',
  'abc123',
  'test-idempotency-key-1'
) on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- Test 1: acquire_run_lease succeeds on first call
-- -------------------------------------------------------------------------
do $$
declare
  leased public.runs;
begin
  leased := public.acquire_run_lease(
    'cccccccc-0000-0000-0000-000000000001',
    'invocation-aaa',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
    120
  );
  if leased.id is null then
    raise exception 'test1 FAIL: expected lease, got null';
  end if;
  if leased.locked_by <> 'invocation-aaa' then
    raise exception 'test1 FAIL: locked_by mismatch: %', leased.locked_by;
  end if;
  if leased.status <> 'running' then
    raise exception 'test1 FAIL: expected status=running, got %', leased.status;
  end if;
  raise notice 'test1 PASS: first invocation acquired lease';
end $$;

-- -------------------------------------------------------------------------
-- Test 2: second invocation cannot acquire lease while first holds it
-- -------------------------------------------------------------------------
do $$
declare
  leased public.runs;
begin
  leased := public.acquire_run_lease(
    'cccccccc-0000-0000-0000-000000000001',
    'invocation-bbb',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02',
    120
  );
  if leased.id is not null then
    raise exception 'test2 FAIL: duplicate invocation acquired lease (race not prevented)';
  end if;
  raise notice 'test2 PASS: duplicate wake prevented by lease';
end $$;

-- -------------------------------------------------------------------------
-- Test 3: complete_run_node advances next_node and clears lease
-- -------------------------------------------------------------------------
do $$
declare
  ok boolean;
  run_row public.runs;
begin
  ok := public.complete_run_node(
    'cccccccc-0000-0000-0000-000000000001',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
    'profile_business',
    '{"inputTokens":100}'::jsonb,
    0.001
  );
  if not ok then
    raise exception 'test3 FAIL: complete_run_node returned false';
  end if;
  select * into run_row from public.runs where id = 'cccccccc-0000-0000-0000-000000000001';
  if run_row.next_node <> 'profile_business' then
    raise exception 'test3 FAIL: next_node not updated, got %', run_row.next_node;
  end if;
  if run_row.locked_by is not null then
    raise exception 'test3 FAIL: lease not cleared, locked_by = %', run_row.locked_by;
  end if;
  if run_row.lease_until is not null then
    raise exception 'test3 FAIL: lease_until not cleared';
  end if;
  raise notice 'test3 PASS: lease cleared after node completion';
end $$;

-- -------------------------------------------------------------------------
-- Test 4: expired-lease recovery — new invocation can re-acquire
-- -------------------------------------------------------------------------
do $$
declare
  leased public.runs;
begin
  -- Simulate an expired lease from a dropped self-chain
  update public.runs
  set
    locked_by = 'dropped-invocation',
    lease_until = now() - interval '5 seconds',
    node_execution_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    status = 'running'
  where id = 'cccccccc-0000-0000-0000-000000000001';

  leased := public.acquire_run_lease(
    'cccccccc-0000-0000-0000-000000000001',
    'recovery-invocation',
    'dddddddd-dddd-dddd-dddd-dddddddddd01',
    120
  );
  if leased.id is null then
    raise exception 'test4 FAIL: recovery invocation could not re-acquire expired lease';
  end if;
  if leased.locked_by <> 'recovery-invocation' then
    raise exception 'test4 FAIL: locked_by not updated after expiry, got %', leased.locked_by;
  end if;
  raise notice 'test4 PASS: expired lease reclaimed by recovery invocation';
end $$;

-- -------------------------------------------------------------------------
-- Test 5: fail_run_node increments attempts and sets status=retrying
-- -------------------------------------------------------------------------
do $$
declare
  ok boolean;
  run_row public.runs;
begin
  ok := public.fail_run_node(
    'cccccccc-0000-0000-0000-000000000001',
    'dddddddd-dddd-dddd-dddd-dddddddddd01',
    '{"message":"simulated failure"}'::jsonb
  );
  if not ok then
    raise exception 'test5 FAIL: fail_run_node returned false';
  end if;
  select * into run_row from public.runs where id = 'cccccccc-0000-0000-0000-000000000001';
  if run_row.attempts <> 1 then
    raise exception 'test5 FAIL: attempts not incremented, got %', run_row.attempts;
  end if;
  if run_row.status <> 'retrying' then
    raise exception 'test5 FAIL: expected status=retrying, got %', run_row.status;
  end if;
  if run_row.locked_by is not null then
    raise exception 'test5 FAIL: lease not cleared after failure';
  end if;
  raise notice 'test5 PASS: node failure increments attempts and queues retry';
end $$;

-- -------------------------------------------------------------------------
-- Test 6: three failures mark run as failed (max_attempts=3)
-- -------------------------------------------------------------------------
do $$
declare
  leased public.runs;
  ok boolean;
  run_row public.runs;
begin
  -- Re-acquire and fail twice more
  leased := public.acquire_run_lease(
    'cccccccc-0000-0000-0000-000000000001',
    'fail-inv-2',
    '11111111-1111-1111-1111-aaaaaaaaaaaa',
    120
  );
  ok := public.fail_run_node(
    'cccccccc-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-aaaaaaaaaaaa',
    '{"message":"failure 2"}'::jsonb
  );

  leased := public.acquire_run_lease(
    'cccccccc-0000-0000-0000-000000000001',
    'fail-inv-3',
    '22222222-2222-2222-2222-aaaaaaaaaaaa',
    120
  );
  ok := public.fail_run_node(
    'cccccccc-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-aaaaaaaaaaaa',
    '{"message":"failure 3"}'::jsonb
  );

  select * into run_row from public.runs where id = 'cccccccc-0000-0000-0000-000000000001';
  if run_row.status <> 'failed' then
    raise exception 'test6 FAIL: expected status=failed after 3 failures, got %', run_row.status;
  end if;
  raise notice 'test6 PASS: run marked failed after max_attempts reached';
end $$;

rollback;
