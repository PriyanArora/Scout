# Companion n8n Workflow — Setup Notes

## What it does

`companion-workflow.json` implements the Scout discovery lead loop:

1. **DB Webhook Trigger** — Supabase fires a DB webhook on `INSERT` to `clients` table
2. **Build Payload** — Extracts URL and notes from the event
3. **Sign Request** — Computes HMAC-SHA256 signature (`v0:{ts}:{body}`)
4. **POST to Scout** — Sends signed discovery request to `/api/webhook/scout`
5. **Parse Run ID** — Extracts `run_id` from the 202 response
6. **Wait 90s** — Allows the agent to complete the first several nodes
7. **Fetch Report** — Polls Supabase REST API for the completed report
8. **Format Summary** — Builds a Slack message with top opportunity and share link
9. **Notify Slack** — Posts to configured channel
10. **Respond 202** — Returns acceptance to DB webhook trigger

## Setup

### Credentials

| Placeholder | Description |
|---|---|
| `__SCOUT_WEBHOOK_URL__` | Your Scout app URL + `/api/webhook/scout` |
| `__SUPABASE_URL__` | Your Supabase project URL |
| `__SUPABASE_SERVICE_ROLE_KEY__` | Supabase service role key (keep secret) |
| `__SLACK_CHANNEL_ID__` | Slack channel ID (not name) |
| `__CRED_SLACK_API__` | n8n credential ID for Slack |
| `PUBLIC_APP_URL` | Your Scout app URL (set in n8n env vars) |
| `SCOUT_WEBHOOK_SECRET` | Shared HMAC secret (set in n8n env vars) |

### Environment variables in n8n

Set these in your n8n instance settings → Environment Variables:

```
SCOUT_WEBHOOK_SECRET=<same value as your Scout .env SCOUT_WEBHOOK_SECRET>
PUBLIC_APP_URL=https://your-scout-app.vercel.app
```

### Supabase DB Webhook

1. Go to Supabase Dashboard → Database → Webhooks
2. Create webhook: Table = `clients`, Events = `INSERT`
3. URL = `https://your-n8n-instance.com/webhook/scout-db-webhook`

### n8n import

1. Open n8n → Workflows → Import
2. Upload `companion-workflow.json`
3. Fill all `__PLACEHOLDER__` values in node parameters
4. Create the Slack credential under Credentials
5. Activate the workflow

### Testing

1. Insert a test client row: `INSERT INTO clients (org_id, url, notes) VALUES ('<your-org-id>', 'https://example.com', 'test')`
2. Workflow should trigger within 30 seconds
3. Check n8n execution log for the `202` response from Scout
4. Check Slack for the discovery notification (arrives after ~90s)
