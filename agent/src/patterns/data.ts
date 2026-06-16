// In-code mirror of agent/patterns.yaml (Wave 4 #14). The YAML is the human spec;
// this is the typed source the agent consumes. A drift test keeps them in lockstep
// and enforces that every catalog_tools id is canonical (grounding) and every
// n8n_archetype is a real shipped archetype.

import type { ArchetypeId } from "../n8n/types.js";

export interface Pattern {
  id: string;
  opportunityTypes: string[];
  pillars: string[];
  n8nArchetype: ArchetypeId;
  catalogTools: string[];
}

export const PATTERNS: readonly Pattern[] = [
  { id: "intake-triage", opportunityTypes: ["lead routing", "lead capture", "support triage", "form intake", "ticket routing"], pillars: ["Customer Experience & Marketing", "Operations & Efficiency"], n8nArchetype: "form-to-crm", catalogTools: ["power-automate", "dynamics-365", "hubspot", "salesforce", "microsoft-teams", "slack", "n8n"] },
  { id: "inbound-message-triage", opportunityTypes: ["email triage", "inbox automation", "support classification", "complaint routing"], pillars: ["Customer Experience & Marketing", "Operations & Efficiency"], n8nArchetype: "inbound-email-triage", catalogTools: ["intercom", "zendesk", "microsoft-teams", "slack", "claude-api", "n8n"] },
  { id: "knowledge-assistant", opportunityTypes: ["faq automation", "internal knowledge search", "document q&a", "self-service"], pillars: ["Customer Experience & Marketing", "Data & Decision Intelligence"], n8nArchetype: "rag-faq-skeleton", catalogTools: ["sharepoint", "pgvector", "pinecone", "supabase", "claude-api", "copilot-studio", "n8n"] },
  { id: "system-data-sync", opportunityTypes: ["data sync", "system integration", "crm sync", "record replication"], pillars: ["Operations & Efficiency", "Data & Decision Intelligence"], n8nArchetype: "webhook-enrich-store", catalogTools: ["power-automate", "dynamics-365", "hubspot", "salesforce", "postgres", "supabase", "n8n"] },
  { id: "event-enrich-store", opportunityTypes: ["webhook ingestion", "event enrichment", "signup enrichment", "data capture"], pillars: ["Operations & Efficiency", "Data & Decision Intelligence"], n8nArchetype: "webhook-enrich-store", catalogTools: ["supabase", "postgres", "airtable", "claude-api", "hubspot", "n8n"] },
  { id: "scheduled-monitor-notify", opportunityTypes: ["competitive monitoring", "site monitoring", "scheduled reporting", "alerting"], pillars: ["Data & Decision Intelligence", "Operations & Efficiency"], n8nArchetype: "scheduled-scrape-summarize-notify", catalogTools: ["jina-reader", "firecrawl", "claude-api", "slack", "microsoft-teams", "notion", "n8n"] },
  { id: "compliance-watch", opportunityTypes: ["regulatory change alerting", "compliance monitoring", "audit logging"], pillars: ["Cybersecurity & Risk", "Operations & Efficiency"], n8nArchetype: "scheduled-scrape-summarize-notify", catalogTools: ["jina-reader", "claude-api", "sharepoint", "microsoft-teams", "slack", "n8n"] },
  { id: "approval-workflow", opportunityTypes: ["approval routing", "document approval", "expense approval", "sign-off"], pillars: ["Operations & Efficiency"], n8nArchetype: "form-to-crm", catalogTools: ["power-automate", "power-apps", "sharepoint", "microsoft-teams", "dataverse", "n8n"] },
  { id: "lead-enrichment", opportunityTypes: ["lead enrichment", "lead scoring", "account research", "prospecting"], pillars: ["Customer Experience & Marketing", "Data & Decision Intelligence"], n8nArchetype: "webhook-enrich-store", catalogTools: ["hubspot", "salesforce", "claude-api", "tavily", "postgres", "n8n"] },
  { id: "reporting-pipeline", opportunityTypes: ["kpi reporting", "dashboard automation", "analytics pipeline", "data marts"], pillars: ["Data & Decision Intelligence"], n8nArchetype: "scheduled-scrape-summarize-notify", catalogTools: ["snowflake", "postgres", "power-bi", "metabase", "microsoft-fabric", "hex", "n8n"] },
  { id: "customer-onboarding", opportunityTypes: ["client onboarding", "customer onboarding", "provisioning", "welcome flow"], pillars: ["Customer Experience & Marketing", "Operations & Efficiency"], n8nArchetype: "form-to-crm", catalogTools: ["hubspot", "dynamics-365", "microsoft-teams", "slack", "asana", "notion", "n8n"] },
  { id: "content-ops", opportunityTypes: ["content generation", "content distribution", "social automation", "marketing ops"], pillars: ["Customer Experience & Marketing", "Operations & Efficiency"], n8nArchetype: "webhook-enrich-store", catalogTools: ["claude-api", "notion", "hubspot", "slack", "airtable", "n8n"] },
];

// Deterministic pattern classifier: score each pattern against an opportunity's
// title/description/pillar and return the best match (rules-first, no LLM call —
// keeps tokens at zero). Returns the highest-scoring pattern, biased to the
// opportunity's pillar; ties break to the first declared pattern.
export function selectPattern(opp: { title: string; description: string; pillar: string }): Pattern {
  const hay = `${opp.title} ${opp.description}`.toLowerCase();
  let best = PATTERNS[0]!;
  let bestScore = -1;
  for (const p of PATTERNS) {
    let score = 0;
    for (const type of p.opportunityTypes) {
      // count word overlap between the opportunity type phrase and the text
      const words = type.split(/\s+/);
      const hits = words.filter((w) => w.length > 2 && hay.includes(w)).length;
      if (hits === words.length) score += 3; // full phrase match
      else score += hits; // partial
    }
    if (p.pillars.includes(opp.pillar)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
