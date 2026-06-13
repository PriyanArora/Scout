# Scout — Runbook

## Prerequisites

- Node.js 20+
- Supabase CLI (`npm install -g supabase`)
- Vercel CLI (`npm install -g vercel`)
- A Supabase account (free tier)
- A Vercel account (Hobby tier)
- An Anthropic API key

## 1. Local Development

```bash
# Install all workspace dependencies
npm install

# Copy env template
cp .env.example .env.local

# Edit .env.local — fill in Supabase local URL, service role key, Anthropic key
# Supabase local defaults: URL=http://127.0.0.1:54321, service role key in supabase start output

# Start Supabase local
supabase start

# Apply migrations and seed
supabase db push
supabase db seed

# Run type checks and tests
npm run typecheck
npm test

# Start Next.js dev server
cd web && npm run dev
```

## 2. Deploy to Supabase

### 2.1 Create Project

1. Go to supabase.com → New project
2. Copy the project reference ID, URL, and service role key

### 2.2 Link and Push

```bash
supabase link --project-ref <your-ref>

# Push all migrations
supabase db push

# Verify
supabase db diff  # should show no diff
```

### 2.3 Set Secrets

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  AGENT_INTERNAL_SECRET=$(openssl rand -base64 32) \
  SCOUT_WEBHOOK_SECRET=$(openssl rand -base64 32)
```

Store these values — you will need them for Vercel.

### 2.4 Deploy the Edge Function

```bash
supabase functions deploy agent --no-verify-jwt
```

The `--no-verify-jwt` flag is required because the function uses its own `x-scout-internal` header for auth rather than Supabase JWT.

### 2.5 Configure pg_cron Settings

After deploying, set the Postgres app settings so the heartbeat cron can invoke the Edge Function:

```sql
-- Run in Supabase SQL editor
ALTER DATABASE postgres SET app.agent_function_url = 'https://<ref>.supabase.co/functions/v1/agent';
ALTER DATABASE postgres SET app.agent_internal_secret = '<your-AGENT_INTERNAL_SECRET>';
```

### 2.6 Seed the Catalog

```bash
supabase db seed
```

Verify: `SELECT COUNT(*) FROM tools;` should return 43.

## 3. Deploy to Vercel

### 3.1 Create Vercel Project

```bash
cd web
vercel
# Follow prompts: link to new project, framework = Next.js
```

### 3.2 Set Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from Supabase dashboard |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `SCOUT_WEBHOOK_SECRET` | same value used in Supabase secrets |
| `AGENT_INTERNAL_SECRET` | same value used in Supabase secrets |
| `PUBLIC_APP_URL` | `https://your-project.vercel.app` |

### 3.3 Production Deploy

```bash
vercel --prod
```

### 3.4 Verify

1. Visit the deployed URL — you should see a sign-in page
2. Create an account via Supabase Auth (or enable email signup in Supabase dashboard)
3. Sign in and submit a discovery URL
4. Watch the run progress page — nodes should advance every 5–20 seconds
5. Verify the completed report renders

## 4. Monitoring

### Check Active Runs

```sql
SELECT id, submitted_url, status, next_node, attempts, created_at, lease_until
FROM runs
WHERE status IN ('queued', 'running', 'retrying')
ORDER BY created_at DESC;
```

### Check Run Cost

```sql
SELECT r.id, r.submitted_url, r.cost_usd,
       SUM(rs.cost_usd) AS step_cost_total,
       COUNT(rs.id) AS steps
FROM runs r
JOIN run_steps rs ON rs.run_id = r.id
WHERE r.created_at > now() - interval '7 days'
GROUP BY r.id, r.submitted_url, r.cost_usd
ORDER BY MAX(r.created_at) DESC;
```

### Check Stalled Runs

```sql
SELECT id, submitted_url, status, next_node, lease_until, updated_at
FROM runs
WHERE status IN ('running', 'retrying')
  AND updated_at < now() - interval '5 minutes';
```

### Edge Function Logs

```bash
supabase functions logs agent --tail
```

### Agent Invocations

```sql
SELECT invocation_id, node, status, started_at, completed_at, wall_time_ms
FROM agent_invocations
WHERE run_id = '<run-id>'
ORDER BY started_at;
```

## 5. Common Operations

### Force-Retry a Failed Run

```sql
UPDATE runs SET status = 'queued', attempts = 0, locked_by = NULL, lease_until = NULL
WHERE id = '<run-id>' AND status = 'failed';
```

Then invoke the Edge Function:

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/agent \
  -H "x-scout-internal: ${AGENT_INTERNAL_SECRET}" \
  -d '{"run_id":"<run-id>"}'
```

### Revoke a Share Link

The stored hash is SHA-256 of the *base64url-decoded* token bytes (see `agent/src/utils/share-token.ts`), not of the token string:

```sql
-- Raw tokens are 32 bytes → 43 base64url chars, so one '=' pad is needed
UPDATE reports SET share_revoked_at = now()
WHERE share_token_hash = encode(
  sha256(decode(translate('<raw-token>', '-_', '+/') || '=', 'base64')), 'hex');
```

Or via the UI: open the report, click "Revoke share".

### Clear Stale Scrape Cache

```sql
DELETE FROM scrape_pages WHERE expires_at < now();
```

### Add a New Catalog Tool

1. Add entry to `agent/catalog.yaml`
2. Add row to `supabase/seed/001_catalog.sql`
3. Add ID to `CATALOG_IDS` array in `agent/src/utils/catalog.ts`
4. Run `supabase db seed` on production: `supabase db seed --linked`
5. Verify: `SELECT id, name FROM tools WHERE id = '<new-id>';`

## 6. Rollback

### Roll Back a Migration

Supabase free tier does not support `supabase db rollback`. To roll back:

1. Write a new migration that undoes the change
2. `supabase db push`

### Roll Back a Vercel Deploy

```bash
vercel rollback
```

Or in Vercel dashboard → Deployments → click a previous deployment → Promote.

## 7. Incident Response

See `docs/SECURITY.md` for the security incident response procedure.

**Run stuck for > 10 minutes:**
1. Check `agent_invocations` for the run — look for errors
2. Check Edge Function logs: `supabase functions logs agent`
3. Force-retry (see section 5)

**All runs failing with "lease unavailable":**
1. Check if a single invocation is holding all leases: `SELECT locked_by, lease_until FROM runs WHERE locked_by IS NOT NULL`
2. If leases are past `lease_until`, the heartbeat cron should reclaim them within 1 minute
3. If the heartbeat is not firing: `SELECT jobname, schedule, active FROM cron.job;`

**High cost / unexpected token usage:**
1. Query `run_steps` for the run — check `input_tokens`, `output_tokens` per node
2. Verify the catalog prompt prefix is being cached (look for `cache_read_tokens` in run_steps)
3. Check for `retrying` runs — each retry re-executes the LLM call
