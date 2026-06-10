import type { Opportunity } from "../schemas/index.js";
import type { ArchetypeId } from "./types.js";

// Tool IDs that suggest specific archetypes.
// IDs must exist in agent/catalog.yaml — toolIds are catalog-filtered upstream,
// so an off-catalog signal here can never match.
const RAG_TOOL_SIGNALS = new Set([
  "azure-ai",
  "copilot-studio",
  "sharepoint",
  "snowflake",
  "pgvector",
  "pinecone",
]);

const CRM_TOOL_SIGNALS = new Set([
  "dynamics-365",
  "power-apps",
  "salesforce",
  "hubspot",
]);

const EMAIL_TOOL_SIGNALS = new Set([
  "microsoft-teams",
  "intercom",
  "zendesk",
]);

function scoreArchetype(
  archetype: ArchetypeId,
  opp: Opportunity,
  toolIds: string[],
): number {
  let score = 0;
  const toolSet = new Set(toolIds);
  const pillar = opp.pillar;
  const title = opp.title.toLowerCase();
  const desc = opp.description.toLowerCase();

  switch (archetype) {
    case "rag-faq-skeleton":
      for (const t of RAG_TOOL_SIGNALS) if (toolSet.has(t)) score += 2;
      if (/knowledge|faq|search|answer|document/.test(title + desc)) score += 2;
      if (pillar === "Data & Decision Intelligence") score += 1;
      break;

    case "form-to-crm":
      for (const t of CRM_TOOL_SIGNALS) if (toolSet.has(t)) score += 2;
      if (/lead|contact|crm|form|intake|onboard/.test(title + desc)) score += 2;
      if (pillar === "Customer Experience & Marketing") score += 1;
      break;

    case "inbound-email-triage":
      for (const t of EMAIL_TOOL_SIGNALS) if (toolSet.has(t)) score += 2;
      if (/email|triage|inbox|ticket|support/.test(title + desc)) score += 2;
      if (pillar === "Customer Experience & Marketing" || pillar === "Operations & Efficiency") score += 1;
      break;

    case "webhook-enrich-store":
      if (/integration|connect|ingest|event|trigger/.test(title + desc)) score += 2;
      if (pillar === "Operations & Efficiency" || pillar === "Data & Decision Intelligence") score += 1;
      break;

    case "scheduled-scrape-summarize-notify":
      if (/monitor|track|alert|report|competitive|intelligence/.test(title + desc)) score += 2;
      if (pillar === "Data & Decision Intelligence" || pillar === "Cybersecurity & Risk") score += 1;
      break;
  }

  // Boost by impact/quadrant
  if (opp.quadrant === "quick-win") score += 1;
  score += Math.floor(opp.impactScore / 2);

  return score;
}

export function selectArchetype(opp: Opportunity, toolIds: string[]): ArchetypeId {
  const archetypes: ArchetypeId[] = [
    "rag-faq-skeleton",
    "form-to-crm",
    "inbound-email-triage",
    "webhook-enrich-store",
    "scheduled-scrape-summarize-notify",
  ];

  let best: ArchetypeId = "webhook-enrich-store";
  let bestScore = -1;

  for (const a of archetypes) {
    const s = scoreArchetype(a, opp, toolIds);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }

  return best;
}
