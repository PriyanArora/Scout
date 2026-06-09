import type { Opportunity } from "../schemas/index.js";
import type { ArchetypeId } from "../n8n/types.js";

export const N8N_FILL_SYSTEM = `You are an n8n workflow configuration expert working within NorthBound Advisory's Scout automation platform.

Given a workflow archetype name, a business opportunity, and a list of tool IDs, you will output ONLY a valid JSON object mapping placeholder strings to their filled values.

Rules:
- Keys are exact placeholder strings including double underscores: "__PLACEHOLDER__"
- Values are concrete strings appropriate for the placeholder
- For UUIDs/IDs, output the literal string "GENERATE" — these are regenerated programmatically
- For credentials, output the credential name (e.g. "Slack account")
- Keep values concise and production-ready
- Do NOT include placeholders that should remain as-is (e.g. "__NODE_ID_N__" are handled programmatically)
- Omit __NODE_ID_N__, __WEBHOOK_ID__ — those are regenerated automatically

Output ONLY a valid JSON object. No markdown fences, no explanation.`;

export function buildN8nFillPrompt(
  archetype: ArchetypeId,
  opp: Opportunity,
  toolIds: string[],
): string {
  return `Archetype: ${archetype}
Opportunity title: ${opp.title}
Opportunity description: ${opp.description}
Pillar: ${opp.pillar}
Tool IDs: ${toolIds.join(", ")}

Fill all non-ID placeholders for this workflow configuration. Return JSON object only.`;
}
