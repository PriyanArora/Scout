# Manual Progress

**Purpose:** External setup and verification tasks that require project accounts, secrets, local CLIs, hosted services, or manual UI actions. Code artifacts are still committed by phase; these items must be completed to run the full live demo.

**Current Manual Gate:** P3
**Last Updated:** 2026-06-09

---

## P3 - Supabase Schema and RLS `[manual pending]`

- [ ] Install or expose the Supabase CLI in the workspace.
- [ ] Run `supabase start`.
- [ ] Run `supabase db reset`.
- [ ] Run `supabase db execute --file supabase/tests/rls_isolation.sql`.
- [ ] Confirm `select count(*) from public.tools;` returns `43`.
- [ ] In hosted Supabase, set `app.settings.agent_function_url` for the `scout-heartbeat` cron job.
- [ ] In hosted Supabase, set `app.settings.agent_internal_secret` for the `scout-heartbeat` cron job.
- [ ] Confirm `pg_cron` and `pg_net` are enabled in the target Supabase project.

Notes:
- Local workspace check on 2026-06-09 confirmed `supabase` CLI is not installed.
- Static checks confirmed the migration defines app tables, RLS enablement, active-run idempotency index, public share-token function, and cron jobs.
- Static catalog count is `43` in both `agent/catalog.yaml` and `supabase/seed/001_catalog.sql`.

---

## P4 - Edge Checkpoint Proof `[not started]`

- [ ] Serve or deploy `checkpoint-proof` with Supabase Edge runtime.
- [ ] Invoke the proof endpoint once and capture checkpoint write logs.
- [ ] Invoke the proof endpoint again and capture checkpoint resume logs.
- [ ] Record wall-clock timing from the Edge Function logs.

---

## P5 - Shared Schemas and Test-First Core Utilities `[not started]`

- [ ] No external manual setup expected.

---

## P6 - Scrape Layer `[not started]`

- [ ] Add `FIRECRAWL_API_KEY` only if optional Firecrawl fallback is needed.
- [ ] Confirm target demo URLs are public and appropriate to scrape.

---

## P7 - Local Agent Vertical `[not started]`

- [ ] Add `ANTHROPIC_API_KEY` before running live Claude-backed nodes.
- [ ] Keep deterministic fixture mode for CI and no-key demos.

---

## P8 - n8n Template Generation `[not started]`

- [ ] Install Docker images or n8n CLI path for pinned import smoke testing.

---

## P9 - Durable Edge Agent Runtime `[not started]`

- [ ] Configure Supabase Edge Function secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `AGENT_INTERNAL_SECRET`.
- [ ] Deploy or serve the `agent` Edge Function.
- [ ] Confirm heartbeat cron can reach the function URL.

---

## P10 - Auth and Webhook Access Control `[not started]`

- [ ] Configure Supabase Auth redirect URLs for local and Vercel.
- [ ] Set `SCOUT_WEBHOOK_SECRET`.
- [ ] Set any webhook caller allow-list values if used.

---

## P11 - Frontend Skeleton and Realtime Progress `[not started]`

- [ ] Enable Realtime for `run_steps` in Supabase if not enabled by default.
- [ ] Test authenticated browser session with a real Supabase project.

---

## P12 - Report Viewer and Editor `[not started]`

- [ ] No external manual setup expected beyond seeded reports or completed runs.

---

## P13 - Sharing and Export `[not started]`

- [ ] Configure Supabase Storage bucket or Vercel-compatible export path if storing generated exports.
- [ ] Manually verify external share links in a private browser session.

---

## P14 - Companion n8n Automation `[not started]`

- [ ] Choose endpoint mode: local+tunnel, self-host, Cloud trial, or fallback.
- [ ] Configure generic n8n credentials for Scout webhook, Supabase, and Slack or Teams.
- [ ] Import `n8n/companion-workflow.json`.
- [ ] Run a client insert and confirm Slack or Teams notification delivery.

---

## P15 - MCP Server `[not started]`

- [ ] Add generated `.mcp.json` values to local Claude Code configuration.
- [ ] Run MCP tools from Claude Code with local env variables set.

---

## P16 - Docs, Evals, and Observability `[not started]`

- [ ] Install/run `gitleaks` locally or rely on CI action.
- [ ] Confirm optional LLM judge secrets only if enabling judge workflow.

---

## P17 - Deploy and Rehearsed Demo `[not started]`

- [ ] Create or select Supabase project.
- [ ] Create or select Vercel project.
- [ ] Configure all production secrets.
- [ ] Push migrations and seed catalog.
- [ ] Deploy Supabase Edge Functions.
- [ ] Deploy Vercel app.
- [ ] Run live UI discovery.
- [ ] Run signed webhook discovery.
- [ ] Run companion n8n loop.
- [ ] Run MCP discovery.
- [ ] Verify share link and export.
- [ ] Check free-tier usage.
- [ ] Confirm CI green.
- [ ] Rehearse demo and update demo script with final live URLs.

---

## Post-P17 Expansion — Manual / Env / Build Items `[planned — implementation pending]`

> Environment, migration, and offline-build steps introduced by the research-driven expansion
> (`.claude/INTEGRATION_PLAN.md`). All new flags are **optional and default-off** to preserve the
> keyless, $0 core path. Nothing here is built yet.

- [ ] Add optional env: `SCOUT_ENRICH_ENABLED` (firmographic enrich gate, default off).
- [ ] Add optional config: `SCOUT_EDGAR_USER_AGENT` (descriptive UA — SEC EDGAR bare fetch 403s).
- [ ] Add optional env: `TAVILY_API_KEY` (bounded external search; non-$0 if used — flag it).
- [ ] Add optional env: `HELICONE_API_KEY` / `LANGFUSE_*` (tracing; demo can skip — DB telemetry already answers cost).
- [ ] Run the LZ4 compression migration; backfill with a no-op `UPDATE` if immediate effect is wanted.
- [ ] Run the migration adding `scrape_pages` `etag`/`last_modified` columns (conditional-request crawl).
- [ ] Run the migration adding the pgvector column/index for n8n template retrieval (only if that prototype is promoted).
- [ ] Run the offline n8n template-index build step (paginate official API + Zie619); bundle only the shipped templates; record provenance/attribution.
- [ ] Vendor `czlonkowski/n8n-mcp` at a pinned commit SHA (or `npx` at build time); wire the **CI import smoke test** that validates generated workflow JSON — closes the long-open P8 import smoke test.
- [ ] Confirm `Supabase.ai` gte-small embeddings are available in the target Edge runtime.
- [ ] Verify `defuddle` / `metascraper` under Deno `npm:`; if incompatible, run them in the Next.js/Vercel (Node) layer or an offline build step.
- [ ] Pin + record resolved versions/integrity (or commit SHAs) for every adopted package in the workspace lockfile per `.claude/INTEGRATION_PLAN.md` §2.
- [ ] Reconcile the pillar-name drift (Zod `Cybersecurity & Risk` vs catalog `Cybersecurity & Risk Management`) before authoring `patterns.yaml` (reconciliation follow-up F-7).
