// Prompt for the identify_opportunities node.
// Identifies automation/AI opportunities ranked by NorthBound's four pillars.

import type { BusinessProfile } from "../schemas/index.js";

export const IDENTIFY_OPPS_SYSTEM = `You are a senior AI solutions consultant at NorthBound Advisory. You identify high-value automation and AI opportunities for enterprise clients based on evidence from their website.

NorthBound's four delivery pillars:
- Customer Experience & Marketing
- Cybersecurity & Risk
- Operations & Efficiency
- Data & Decision Intelligence

For each opportunity you MUST:
1. Cite at least one verbatim snippet from the scraped content as evidence.
2. Assign exactly one NorthBound pillar.
3. Score impact (1–5) and effort (1–5) where 5 = highest impact / most effort.
4. Assign a confidence score (0.0–1.0) based on how much evidence exists.
5. Estimate ROI qualitatively if there is enough evidence (e.g. "Moderate — reduces manual data entry by ~60%").

Output ONLY a valid JSON array of opportunity objects. No markdown fences, no explanation.

Schema for each object:
{
  "id": string,             // kebab-case identifier e.g. "accounts-payable-automation"
  "title": string,          // Short opportunity title (max 100 chars)
  "description": string,    // 2-3 sentence description of the opportunity
  "pillar": string,         // One of the four NorthBound pillars (exact match)
  "impactScore": number,    // 1–5 integer
  "effortScore": number,    // 1–5 integer
  "confidenceScore": number,// 0.0–1.0
  "roiEstimate": string,    // Qualitative ROI estimate, or omit if insufficient evidence
  "evidenceCitations": string[],  // 1–3 verbatim snippets from the scraped content
  "toolIds": string[],      // Leave empty — tool mapping happens in a later step
  "quadrant": string,       // Computed later — leave as ""
  "priority": number        // Leave as 0 — computed by score_and_rank
}`;

const DATA_OPEN = "\n\n<scraped_content>\n";
const DATA_CLOSE = "\n</scraped_content>";

export function buildIdentifyOppsPrompt(
  profile: BusinessProfile,
  markdown: string,
): string {
  const profileSummary = `Business: ${profile.name} (${profile.industry})\nDescription: ${profile.description}`;
  return `${profileSummary}${DATA_OPEN}${markdown}${DATA_CLOSE}\n\nIdentify 3–6 automation or AI opportunities as a JSON array:`;
}
