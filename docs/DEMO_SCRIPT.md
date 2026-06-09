# Scout — Demo Script

**Audience:** NorthBound Advisory interview panel
**Duration:** 8–10 minutes
**Goal:** Show a live end-to-end run; explain the architecture; answer technical questions

---

## Setup (before the interview)

1. Deploy Scout to Vercel + Supabase (see RUNBOOK.md)
2. Have the demo URL ready: `https://scout.vercel.app` (or your deployment)
3. Pre-load a warm run for fallback: run `https://northbound-example.com` ahead of time so a completed report is available if the live run is slow
4. Have the Supabase dashboard open in a background tab (for the architecture walkthrough)
5. Have `mcp/sample.mcp.json` open in VS Code

---

## Act 1 — Live Discovery (3 min)

> "Scout is an AI agent that automates the first 2–3 hours of a NorthBound consulting engagement — the discovery and scoping phase."

1. **Open the Scout dashboard** and sign in
2. Paste a real company URL (use a client you know, or `https://northbound-example.com`)
3. Add a note: `"CFO mentioned manual month-end process as the #1 pain point"`
4. Click **Run Discovery**
5. **Watch the progress page** — narrate as each node appears:
   - `scrape_site` — "Jina Reader fetches and cleans the public website"
   - `profile_business` — "Opus extracts a structured company profile with evidence citations"
   - `identify_opportunities` — "Opus identifies 3–6 automation opportunities, each tied to a NorthBound delivery pillar"
   - `score_and_rank` — "Deterministic scoring: impact × effort → quadrant assignment"
   - `map_tools` — "Haiku maps each opportunity to our grounded 43-tool catalog"
   - _... continue through finalize_
6. **Open the completed report**

---

## Act 2 — Report Walkthrough (2 min)

> "The output is a structured deliverable, not a chat transcript."

Walk through the report:
- **Business profile** — company name, industry, size, evidence snippets from the website
- **Opportunities** — ranked list with pillar, quadrant badge, impact/effort scores, tool IDs
- **Quick-win opportunity** — highlight the top-right quadrant item: "high impact, low effort"
- **n8n workflow** — show the generated JSON: "This imports directly into n8n 1.88.0 with credential placeholders"
- **Playbook** — editable markdown; show the inline edit and save
- **Share link** — generate and open in a new tab: "This is what we'd send to the client"

---

## Act 3 — Architecture (2 min)

> "The infrastructure cost is zero. Claude tokens are the only marginal cost — about $0.30–$0.50 per run."

Draw on whiteboard or open `docs/ARCHITECTURE.md`:

```
Browser → /api/discover → Supabase Edge Function
  [scrape → profile → identify → score → map → draft → design
   → workflow → questions → playbook → critique → finalize]
  Each node = 1 Edge Function invocation, checkpointed to Postgres
  pg_cron heartbeat recovers any dropped chain
```

Key design decisions to mention if asked:
- **Why Edge Functions?** Free tier, Deno-compatible, self-chain pattern avoids 60s Vercel limit
- **Why custom checkpointer?** LangGraph's official Postgres adapter uses Node.js TCP sockets — incompatible with Deno
- **Why catalog-grounded?** Every recommendation maps to a tool NorthBound actually delivers; no hallucinated products
- **SSRF/security** — all URLs SSRF-checked before any fetch; HMAC on webhook; share links use hashed tokens

---

## Act 4 — MCP Integration (1 min)

> "Scout also works as a Claude Code tool — I can run a discovery from inside my IDE."

Open VS Code with Claude Code:
```
run_discovery url=https://acme.com notes="SMB manufacturer"
```

Show the `run_id` return, then:
```
write_playbook runId=<run_id>
```

> "This lets me iterate on a client deliverable without leaving my development environment."

---

## Act 5 — Automation Loop (1 min, optional)

> "And we can wire it to an n8n companion workflow so a new CRM entry triggers a full Scout run and posts the summary to Slack."

Open `n8n/companion-workflow.json` or show the flow diagram from `n8n/SETUP.md`.

---

## Fallback if live run is slow

If the live run takes > 4 minutes, switch to the pre-loaded completed run:

> "While that continues in the background — here's a completed run from earlier so we can see the full output."

Open the pre-loaded report and continue from Act 2.

---

## Common questions

**Q: How do you handle sites that block scrapers?**
Jina Reader handles most JavaScript-heavy sites. For bot-protected sites, set `FIRECRAWL_API_KEY` — Firecrawl uses headless browsing as a fallback.

**Q: How do you keep recommendations on-strategy?**
The 43-tool catalog is injected as a system prompt prefix. Out-of-catalog tool IDs are rejected with a validation error and the call retries. Anthropic prompt caching keeps the catalog prefix cheap after the first call.

**Q: What happens if the Edge Function crashes mid-run?**
The checkpoint survives. The `pg_cron` heartbeat fires within ~1 minute and re-invokes the function, which re-acquires the lease and resumes from the last checkpoint.

**Q: How much does this cost to run?**
Infrastructure: $0/month (Supabase Free + Vercel Hobby). Claude API: ~$0.30–$0.50 per run. At 20 runs/month: ~$6–10 in tokens.

**Q: What's the latency?**
Typically 2–4 minutes for a full run. The first node has a ~300ms cold start; subsequent nodes are warm.
