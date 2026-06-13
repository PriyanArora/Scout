# ADR 007 — n8n-mcp as a build-time workflow validator

**Status:** Accepted (2026-06-13) · **Wave:** 4 #17 (INTEGRATION_PLAN)

## Context

Generated n8n workflows must import cleanly into a real n8n instance. The P8 "CI
import smoke test" was left open because we have no live n8n in CI. Scout's own
`validateWorkflow` checks structure (nodes/connections/typeVersion, unresolved
placeholders) but not against the **real** node schemas (parameter shapes,
`typeVersion` compatibility, third-party node availability).

## Decision

Adopt **czlonkowski/n8n-mcp** (MIT) as a **build-time / CI validator only** — never
a runtime dependency of a 110s leased Edge node. It bundles 1,851 node schemas plus
a workflow validator/auto-fix and a template search.

- **Pinned commit:** `b0f5e25d22c1e28363c27aee160518c301341edc` (captured 2026-06-13
  from `https://github.com/czlonkowski/n8n-mcp`). License: MIT.
- **Acquisition:** `npx github:czlonkowski/n8n-mcp#<SHA>` at CI time (or vendor under
  `third_party/n8n-mcp` at the same SHA with a `PROVENANCE.md` if hermetic CI is
  required). Not added to any workspace `package.json` — it is not a runtime dep.
- **Gate vs deep check:** the **gating** importability check is the hermetic
  `agent/src/n8n/importability.test.ts` (merge + `validateWorkflow` over every shipped
  archetype — runs in `npm test`). The n8n-mcp node-schema validation is the **deeper**
  CI step in `.github/workflows/evals.yml` (`n8n-validate` job), marked
  `continue-on-error` because the exact validator entrypoint depends on runner network
  access; wire the `validate_workflow` tool over `agent/n8n_templates/*.json` there.

## Consequences

- P8 import smoke test is closed by the hermetic vitest; n8n-mcp adds real-schema
  depth without a runtime dependency or a second hosted service ($0).
- The pinned SHA must be bumped deliberately (review node-schema changes) — record
  new SHAs here.
