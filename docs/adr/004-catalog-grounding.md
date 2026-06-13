# ADR 004 — Catalog-Grounded Tool Recommendations

**Status:** Accepted
**Date:** 2026-06-09

## Context

Without grounding, LLMs recommend tools that NorthBound cannot deliver (e.g., Salesforce, HubSpot, ServiceNow) or invent fictional products. Scout must recommend only tools that NorthBound's consulting practice actively delivers, so that every recommendation in a report can be backed by a real engagement capability.

Options evaluated:

| Option | Verdict |
|--------|---------|
| Unconstrained LLM tool recommendations | Rejected — hallucinations, out-of-scope tools |
| Post-hoc filtering of LLM output against a list | Rejected — still pays for hallucinated content; hard to enforce |
| Catalog as a hard system-prompt prefix | **Chosen** |
| RAG over a larger tool knowledge base | Overkill for a fixed 43-item catalog; adds latency and cost |

## Decision

The 43-tool catalog (`agent/catalog.yaml`, `supabase/seed/001_catalog.sql`) is serialized as a compact YAML block and injected at the start of the `map_tools` system prompt:

```
You MUST only recommend tools from the following catalog.
Return a JSON array of tool IDs. Any ID not in this list will be rejected.
---
<catalog block>
---
```

The validator in `agent/src/utils/catalog.ts` rejects any ID not in `CATALOG_IDS`. If the LLM returns an out-of-catalog ID, the call is retried once with an error prefix appended to the prompt. After two failures, the opportunity is returned with an empty `toolIds` array.

## Consequences

**Positive**
- Every recommended tool ID maps 1:1 to a real catalog entry; reports are always deliverable
- The catalog prompt prefix is cache-eligible (Anthropic prompt caching) — subsequent tool-mapping calls reuse the cached prefix, saving input tokens
- Adding a tool requires only a YAML/SQL row and a constant update; no model changes

**Negative / risks**
- The catalog is a fixed snapshot; it must be maintained as NorthBound's practice evolves
- A 43-item catalog narrows recommendations; some genuinely good tools for a client may be outside it
- The cache prefix assumption depends on the catalog being the first segment of the system prompt; reordering will break cache hits
