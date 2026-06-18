# Scout - AI Discovery Agent 

Scout automates the NorthBound consulting discovery workflow. Give it a company URL; it produces a grounded, editable deliverable: business profile, ranked AI/automation opportunities tied to NorthBound's four delivery pillars, catalog-constrained tool mappings, requirements brief, solution design, n8n workflow template, implementation playbook, discovery questions, and readiness snapshot.

**$0/month infrastructure.** Supabase Free + Vercel Hobby. Claude API tokens are the only marginal cost (~$0.10–$0.30 per run).

> **Setup tip — set `JINA_API_KEY` before your first run.** Scraping uses the keyless
> Jina Reader, which rate-limits **per IP**. On Vercel your function shares an egress IP,
> so scrapes can return empty/blocked on a fresh deploy even though they work locally.
> Grab a free key at <https://jina.ai/reader>, add it as `JINA_API_KEY` in Vercel env,
> and redeploy — discovery then works on the first go. Still $0 (free tier).

## How It Works

```
Browser / n8n / Claude Code
  → /api/discover  or  /api/webhook/scout
    → Supabase Edge Function (Deno, 110 s wall budget)
      scrape_site → profile_business → identify_opportunities → score_and_rank
      → map_tools → draft_requirements → solution_design → generate_workflow
      → discovery_questions → write_playbook → critique → finalize
    → Postgres: runs · run_steps · checkpoints · reports · scrape_pages
    → pg_cron: heartbeat (every 1 min) + prune (daily)
```

Each graph node is one Edge Function invocation. The function writes a checkpoint to Postgres, self-chains to the next node, and returns 200 immediately. `pg_cron` recovers any dropped chain. See `claude/ARCHITECTURE.md` for the full design.

## Running a Discovery

### Via the Web UI

1. Deploy Scout (see `claude/OPERATIONS.md`)
2. Sign in at your Scout URL
3. Paste the company's website URL and any context notes
4. Watch real-time node progress
5. View the completed report and generate a share link

### Via Webhook

```bash
BODY='{"url":"https://acme.com","notes":"SMB manufacturer, ~50 employees"}'
TS=$(date +%s)
SIG=$(echo -n "v0:${TS}:${BODY}" \
  | openssl dgst -sha256 -hmac "${SCOUT_WEBHOOK_SECRET}" \
  | awk '{print "v0="$2}')

curl -X POST https://your-scout.vercel.app/api/webhook/scout \
  -H "Content-Type: application/json" \
  -H "x-scout-signature: ${SIG}" \
  -H "x-scout-timestamp: ${TS}" \
  -d "${BODY}"
# → 202 { "run_id": "...", "accepted": true }
```

### Via MCP (Claude Code)

Copy `mcp/sample.mcp.json` to `.mcp.json` in your project root and fill in the env vars. Then inside Claude Code:

```
run_discovery url=https://acme.com notes="B2B SaaS, 200 employees"
```

Available tools: `run_discovery` · `scrape_company` · `map_tools` · `generate_n8n_workflow` · `write_playbook`

### Via n8n Automation Loop

Import `n8n/companion-workflow.json`. See `n8n/SETUP.md` for credentials and the Supabase DB webhook trigger.

## Understanding the Output

A completed run populates a `reports` row:

| Field | Description |
|---|---|
| `business_profile` | Company name, industry, size, services, evidence citations |
| `opportunities` | 3–6 ranked opportunities: NorthBound pillar, impact/effort/confidence scores, quadrant (quick-win / strategic / fill-in / thankless), tool IDs |
| `requirements` | Requirements brief for the top opportunity |
| `solution_design` | High-level architecture for the top solution |
| `top_workflow` | n8n archetype + a merged, `validateWorkflow`-checked n8n workflow (pattern-grounded via `agent/patterns.yaml`) + placeholder map |
| `playbook` | Editable implementation playbook (markdown) |
| `discovery_questions` | 5–8 questions for the first client meeting |
| `readiness` | Technology and organizational readiness snapshot |

Reports are editable after completion. Each re-run creates a new version.

## Catalog Customization

The 43-tool catalog lives in `agent/catalog.yaml` and `supabase/seed/001_catalog.sql`. Tools span Microsoft 365, Copilot, Power Platform, Snowflake, n8n, and key SaaS integrations.

To add a tool:

1. Add the entry to `agent/catalog.yaml`
2. Add the matching row to `supabase/seed/001_catalog.sql`
3. Add the tool ID to `CATALOG_IDS` in `agent/src/utils/catalog.ts`
4. Run `supabase db seed` on your project

All LLM tool mapping calls reference the catalog as a stable system-prompt prefix. Out-of-catalog IDs are rejected and the call retried once.

## Free-Tier Deploy

Full instructions: `claude/OPERATIONS.md`. Quick summary:

```bash
# 1. Supabase
supabase link --project-ref <your-ref>
supabase db push
supabase functions deploy agent
supabase secrets set ANTHROPIC_API_KEY=... AGENT_INTERNAL_SECRET=...

# 2. Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# ... (see RUNBOOK.md for full list)
vercel --prod

# 3. Seed
supabase db seed
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_URL` | Yes | Supabase project URL (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (never expose to browser) |
| `ANTHROPIC_API_KEY` | Yes | Used by Edge Function and MCP tools |
| `SCOUT_WEBHOOK_SECRET` | Yes | HMAC secret for `/api/webhook/scout` |
| `AGENT_INTERNAL_SECRET` | Yes | Internal auth for Edge Function invocations |
| `PUBLIC_APP_URL` | Yes | Canonical app URL (e.g. `https://scout.vercel.app`) |
| `JINA_API_KEY` | Recommended | Lifts the keyless Jina per-IP rate limit so scraping works on the first run in prod (free tier). See setup tip above. |
| `DATABASE_URL` | Local dev | `postgresql://` URL for migrations and eval runner |
| `FIRECRAWL_API_KEY` | Optional | Firecrawl fallback scraper |
| `N8N_WEBHOOK_URL` | Optional | n8n instance for companion workflow |
| `SLACK_BOT_TOKEN` | Optional | Slack notifications in companion workflow |
| `LANGSMITH_API_KEY` | Optional | LangSmith tracing |

## Limitations

- **One active run per idempotency key.** Duplicate (url + notes) pairs return the existing active run.
- **Scrape quality.** Jina Reader covers ~90% of public sites; the direct-fetch fallback uses defuddle main-content extraction (Node layer). Enable `FIRECRAWL_API_KEY` for the remainder.
- **PDF export is available** at `/api/report/[runId]/pdf` (react-pdf, no headless browser); a `@media print` stylesheet is the zero-dependency fallback.
- **Token budget.** ~30K–60K tokens per run. Runs that exceed 3 retry attempts are marked failed.
- **No re-run versioning UI.** Re-runs create a new `runs` row; a future version selector is not in v1.
- **n8n requires self-hosting or n8n Cloud.** Generated templates use generic credential placeholders that must be filled before import.
- **Free-tier Edge Function cold starts** add ~200–400 ms to the first node per run. Subsequent nodes are warm.
