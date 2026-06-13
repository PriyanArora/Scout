# Scout — Security Model

## Threat Model

Scout is a single-tenant SaaS tool used by NorthBound consultants. The primary assets are:

- Client company intelligence (scraped content, AI-generated reports)
- The Anthropic API key (direct cost implications)
- Org-level report data (confidential client deliverables)
- Share link access to reports

Primary threats:

1. **SSRF** — attacker submits a URL that causes Scout to fetch internal infrastructure
2. **Webhook replay** — attacker replays a valid webhook request to create duplicate runs
3. **Share link enumeration** — attacker guesses share tokens
4. **Unauthorized report access** — unauthenticated user accesses another org's reports
5. **Secret exposure** — Anthropic key or service role key leaked
6. **Prompt injection** — scraped web content attempts to hijack LLM instructions

## Controls

### SSRF Prevention

Every URL submitted to Scout — whether via `/api/discover`, `/api/webhook/scout`, or any MCP tool — is validated with `isSafeUrl()` before any fetch is made.

`isSafeUrl()` rejects:
- RFC 1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Loopback (127.0.0.0/8, ::1)
- Link-local (169.254.0.0/16, fe80::/10)
- Localhost hostnames
- Non-HTTP/HTTPS schemes

The check is applied to **every redirect hop**, not just the initial URL. A redirect from `https://evil.com` → `http://169.254.169.254/metadata` is rejected at the redirect step.

The Jina Reader URL (`r.jina.ai`) is constructed from the validated original URL — the SSRF check validates the original input before the Jina URL is built.

### Webhook Authentication

`/api/webhook/scout` requires:

- `x-scout-signature: v0=<hex>` — HMAC-SHA256 over `v0:{timestamp}:{raw-body}`
- `x-scout-timestamp: <unix-seconds>` — must be within ±5 minutes of server time

The signature comparison uses a timing-safe byte-by-byte comparison (`crypto.subtle.verify`). Requests with a missing or invalid signature return `401` without further processing.

The `SCOUT_WEBHOOK_SECRET` must be rotated if compromised (see Incident Response below).

### Authentication and Authorization

All UI routes are protected by Supabase Auth JWT middleware (`web/src/middleware.ts`). Unauthenticated requests to `/app/*` are redirected to `/login`; unauthenticated requests to `/api/*` return `401`.

Row-Level Security (RLS) is enabled on all tables. The `org_id` column on `runs`, `run_steps`, `reports`, `scrape_pages`, and `clients` enforces org isolation. A user in org A cannot read rows belonging to org B.

The service role key bypasses RLS and is never sent to the browser. It is used only in:
- Server-side API route handlers (`web/src/lib/supabase/server.ts`)
- The Edge Function (`supabase/functions/agent/index.ts`)

### Share Links

Share tokens are generated as 32-byte cryptographically random values (`crypto.getRandomValues()`), encoded as base64url. **Only the SHA-256 hash of the token is stored in the database.** The raw token is returned once at creation time and never stored.

A share link expires after 30 days by default. Revocation sets `share_revoked_at`; the public share endpoint checks both conditions before serving the report.

The public share page uses the Supabase anon key and calls the `get_public_report_by_share_token_hash` RPC, which enforces expiry and revocation within the stored procedure — not in application code.

### Edge Function Authentication

The `agent` Edge Function is deployed with `--no-verify-jwt`. It authenticates callers via `x-scout-internal: <AGENT_INTERNAL_SECRET>`. This secret is only known to:
- The Next.js API routes (via `AGENT_INTERNAL_SECRET` Vercel env var)
- The `pg_cron` heartbeat (via Postgres `app.agent_internal_secret` setting)

The Edge Function endpoint is not publicly documented. All requests without the correct header return `401`.

### Prompt Injection Mitigation

Scraped content is passed to LLMs in the `user` turn, never in the `system` turn. System prompts are hardcoded in `agent/src/prompts/`. Structured-output instructions explicitly state that any instruction in the content to "ignore previous instructions" should be treated as company data, not a directive.

Scout does not execute any code returned by LLMs.

### Secret Management

| Secret | Storage | Rotation |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel env + Supabase secret | Rotate in both locations; no code change needed |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | Rotate if exposed; regenerate in Supabase dashboard |
| `SCOUT_WEBHOOK_SECRET` | Vercel env + Supabase secret | Rotate both; notify n8n companion workflow operators |
| `AGENT_INTERNAL_SECRET` | Vercel env + Supabase secret + Postgres app setting | Rotate all three simultaneously |

Secrets must never appear in:
- Git history
- Log output (Edge Function logs, Vercel function logs)
- Error messages returned to clients
- `console.log` statements

The `.gitignore` excludes `.env`, `.env.local`, and `.env.*.local`. The gitleaks CI job (`.github/workflows/agent-ci.yml`) scans commits for secrets.

## Incident Response

### Suspected Secret Exposure

1. Immediately rotate the exposed secret in all storage locations
2. Check `agent_invocations` for any unexpected runs in the past 24 hours
3. Check `runs` for any URLs not submitted by known consultants
4. If the Anthropic key was exposed, check Anthropic usage dashboard for unexpected charges
5. If the service role key was exposed, audit all table writes using Supabase audit logs

### SSRF Attempt

1. Identify the `run_id` and `url` from `runs`
2. Check `scrape_pages` — was any private-IP content stored?
3. If yes, delete the affected `scrape_pages` row and the `runs` row
4. Check if the submitting user account should be suspended

### Data Leak via Share Link

1. Revoke the affected share token: `UPDATE reports SET share_revoked_at = now() WHERE id = '<id>'`
2. Identify who had access to the raw token (it was returned once at creation — check who requested it)
3. If reports contain client PII or confidential data, notify the account holder

### Unauthorized Access Attempt

1. Check Supabase Auth logs for the suspicious user
2. If the account is compromised, disable it in Supabase dashboard
3. Audit `runs` and `reports` for rows accessed by that user's org_id

## Security Checklist for Contributors

- [ ] All new API endpoints check auth before any database query
- [ ] User-submitted URLs pass through `isSafeUrl()` before any fetch
- [ ] All new DB tables have RLS enabled with org-match policies
- [ ] No secrets in code, logs, or error responses
- [ ] New webhook endpoints verify HMAC before processing body
- [ ] LLM responses are validated against Zod schemas before use
- [ ] No `eval()`, `Function()`, or dynamic code execution
