-- Run after `supabase db reset` with:
--   supabase db execute --file supabase/tests/rls_isolation.sql

begin;

insert into auth.users (id, email, role, aud)
values
  ('11111111-1111-1111-1111-111111111111', 'one@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'two@example.com', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.profiles (id, org_id, role, full_name)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'consultant', 'Org One'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'consultant', 'Org Two')
on conflict (id) do update set org_id = excluded.org_id;

insert into public.clients (id, org_id, url, normalized_url, notes, created_by)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://one.example', 'https://one.example/', 'one', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://two.example', 'https://two.example/', 'two', '22222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  visible_count integer;
  cross_org_count integer;
begin
  select count(*) into visible_count from public.clients;
  if visible_count <> 1 then
    raise exception 'expected org one to see 1 client, saw %', visible_count;
  end if;

  select count(*) into cross_org_count
  from public.clients
  where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  if cross_org_count <> 0 then
    raise exception 'org one can see org two clients';
  end if;
end $$;

reset role;
rollback;
