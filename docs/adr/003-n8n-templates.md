# ADR 003 — n8n Workflow Templates with Placeholder Convention

**Status:** Accepted
**Date:** 2026-06-09

## Context

Scout's deliverable includes a production-ready n8n workflow that a consultant can import and configure for the client. The workflow must:

- Be immediately importable into n8n 1.88.0 without modification to structure
- Use generic credential placeholders (not real API keys)
- Cover the five most common NorthBound automation archetypes
- Be generated without executing n8n itself (no live test environment in CI)

Options evaluated:

| Option | Verdict |
|--------|---------|
| Generate workflow JSON entirely from LLM output | Rejected — LLM produces structurally invalid JSON (wrong typeVersion, duplicate IDs, bad connections) |
| Use n8n's API to generate workflows programmatically | Rejected — requires a running n8n instance; not suitable for an Edge Function |
| Pre-built templates + LLM-filled placeholders | **Chosen** |
| Static templates with no LLM involvement | Rejected — no customization for the specific client context |

## Decision

Define five archetype templates in `agent/n8n_templates/` as committed JSON files pinned to n8n 1.88.0. Each template uses `__UPPERCASE_PLACEHOLDER__` tokens for all client-specific values (API endpoints, credential references, channel IDs, etc.).

A selector function (`select-archetype.ts`) scores archetypes by keyword match on the opportunity title + description. The selected template is passed to Haiku (`n8n-fill.ts` prompt) which returns a JSON object of `placeholder → value`. The merger (`merger.ts`) does a regex replace pass, then regenerates all node IDs (UUIDs) and repositions nodes for a clean layout.

The validator (`validator.ts`) checks structure, connection integrity, `typeVersion` fields, and the absence of unresolved `__PLACEHOLDER__` tokens before the workflow is stored.

## Consequences

**Positive**
- Templates are structurally correct by construction; LLM only fills string values
- Validator catches any unresolved placeholders or structural regressions
- The five archetypes cover ≥80% of NorthBound automation use cases
- No running n8n instance needed in CI or Edge Functions

**Negative / risks**
- Templates must be manually updated when n8n breaks changes between minor versions (pinned to 1.88.0)
- Haiku occasionally returns a placeholder map that misses some keys; the merger falls back to the unparameterized template in that case
- The archetype selector is keyword-based (not semantic); it will misclassify edge cases
