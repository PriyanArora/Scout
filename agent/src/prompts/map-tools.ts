// Prompt for the map_tools node.
// Maps ranked opportunities to tools from NorthBound's grounded catalog.

import type { Opportunity } from "../schemas/index.js";

// The grounded catalog now lives in the shared system prefix
// (`prompts/system-prefix.ts`) so it caches across nodes; this suffix is the
// map_tools-specific instruction block that follows the cache breakpoint.
export const MAP_TOOLS_SYSTEM_SUFFIX = `You are a solutions architect. For each opportunity, select 1–3 tool IDs from the grounded catalog that best address it. Use ONLY ids from the catalog in your instructions.

Output ONLY a valid JSON array. Each object:
{
  "opportunityId": string,  // matches the opportunity "id" field
  "toolIds": string[]       // 1–3 catalog tool IDs, no others
}`;

export function buildMapToolsPrompt(opportunities: Opportunity[]): string {
  const oppsSummary = opportunities
    .map((o) => `- ${o.id}: ${o.title} (${o.pillar})`)
    .join("\n");
  return `Opportunities to map:\n${oppsSummary}\n\nReturn a JSON array mapping each opportunity to catalog tool IDs:`;
}
