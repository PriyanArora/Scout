# Scout

Scout is an AI discovery agent for NorthBound Advisory. A consultant provides a client URL and pain-point notes; Scout produces a grounded, editable consulting deliverable with business profile, ranked automation opportunities, catalog-constrained tool mappings, requirements, solution design, n8n workflow, playbook, questions, and readiness snapshot.

This repository is currently at P1: repo setup. The implementation source of truth is [SPEC.md](SPEC.md), and the gated build plan lives in [claude/BuildFlow.md](claude/BuildFlow.md) and [claude/Progress.md](claude/Progress.md).

Core constraints:

- Keep the core app on Vercel plus Supabase free-tier infrastructure.
- Run agent work in Supabase Edge Functions, not long Vercel requests.
- Use DB leases, checkpoints, and `pg_cron`/`pg_net` wake-ups for durable progress.
- Keep recommendations catalog-grounded and n8n workflows template-filled/import-tested.
- Treat scraped content, webhooks, share links, and secrets as security boundaries.
