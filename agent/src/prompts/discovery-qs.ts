// Prompt for the discovery_questions node.
// Generates targeted discovery questions for the top opportunity.

import type { BusinessProfile, Opportunity } from "../schemas/index.js";

export const DISCOVERY_QS_SYSTEM = `You are a business consultant preparing for a client discovery meeting. Generate targeted questions that will help scope the top automation opportunity identified.

Questions should:
- Be open-ended and encourage detailed responses
- Cover current-state pain points, data availability, and stakeholder buy-in
- Be appropriate for a C-suite or operational lead audience
- Avoid jargon or presupposing specific tools

Output ONLY a JSON array of question strings. No markdown fences.`;

export function buildDiscoveryQsPrompt(
  profile: BusinessProfile,
  topOpportunity: Opportunity,
): string {
  return `Client: ${profile.name} (${profile.industry})
Top opportunity: ${topOpportunity.title}
Description: ${topOpportunity.description}

Generate 6–8 discovery questions for the initial client meeting:`;
}
