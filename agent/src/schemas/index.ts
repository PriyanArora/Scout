import { z } from "zod";

// NorthBound Advisory's four delivery pillars.
export const NorthBoundPillarSchema = z.enum([
  "Customer Experience & Marketing",
  "Cybersecurity & Risk",
  "Operations & Efficiency",
  "Data & Decision Intelligence",
]);
export type NorthBoundPillar = z.infer<typeof NorthBoundPillarSchema>;

// Mirrors the public.scout_node DB enum exactly.
export const ScoutNodeNameSchema = z.enum([
  "scrape_site",
  "profile_business",
  "identify_opportunities",
  "score_and_rank",
  "map_tools",
  "draft_requirements",
  "solution_design",
  "generate_workflow",
  "discovery_questions",
  "write_playbook",
  "critique",
  "finalize",
]);
export type ScoutNodeName = z.infer<typeof ScoutNodeNameSchema>;

// ---------------------------------------------------------------------------
// Input / webhook
// ---------------------------------------------------------------------------

export const UrlInputSchema = z.object({
  url: z.string().url().max(2048),
  notes: z.string().max(20000).default(""),
});
export type UrlInput = z.infer<typeof UrlInputSchema>;

export const WebhookPayloadSchema = z.object({
  url: z.string().url().max(2048),
  notes: z.string().max(20000).optional(),
  clientId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// ---------------------------------------------------------------------------
// Catalog tool
// ---------------------------------------------------------------------------

export const CostTierSchema = z.enum(["free", "freemium", "paid"]);

export const CatalogToolSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1),
  category: z.string().min(1),
  pillars: z.array(z.string()),
  whatItDoes: z.string(),
  bestFor: z.array(z.string()),
  integratesWith: z.array(z.string()),
  effort: z.number().int().min(1).max(5),
  costTier: CostTierSchema,
  notes: z.string(),
  enabled: z.boolean(),
});
export type CatalogTool = z.infer<typeof CatalogToolSchema>;

// ---------------------------------------------------------------------------
// Agent graph state
// ---------------------------------------------------------------------------

export const UsageAccumulatorSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0),
  cacheCreationTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
});
export type UsageAccumulator = z.infer<typeof UsageAccumulatorSchema>;

export const ScoutStateSchema = z.object({
  runId: z.string().uuid(),
  nextNode: ScoutNodeNameSchema,
  step: z.number().int().min(0),
  startedAt: z.string().datetime(),
  scrapePageIds: z.array(z.string().uuid()),
  businessProfile: z.record(z.string(), z.unknown()).nullable(),
  opportunities: z.array(z.unknown()),
  usage: UsageAccumulatorSchema,
  error: z.string().nullable(),
});
export type ScoutState = z.infer<typeof ScoutStateSchema>;

// ---------------------------------------------------------------------------
// Business profile
// ---------------------------------------------------------------------------

export const BusinessProfileSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().max(100),
  size: z.string().optional(),
  description: z.string().max(5000),
  primaryServices: z.array(z.string()),
  technologyIndicators: z.array(z.string()),
  marketPosition: z.string().optional(),
  evidenceSnippets: z.array(z.string()),
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

// ---------------------------------------------------------------------------
// Opportunity
// ---------------------------------------------------------------------------

export const OpportunitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  pillar: NorthBoundPillarSchema,
  impactScore: z.number().int().min(1).max(5),
  effortScore: z.number().int().min(1).max(5),
  confidenceScore: z.number().min(0).max(1),
  roiEstimate: z.string().optional(),
  evidenceCitations: z.array(z.string()),
  toolIds: z.array(z.string()),
  quadrant: z.enum(["quick-win", "strategic", "fill-in", "thankless"]),
  priority: z.number().int().min(1),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

// ---------------------------------------------------------------------------
// Requirements brief
// ---------------------------------------------------------------------------

export const RequirementsBriefSchema = z.object({
  opportunityId: z.string().min(1),
  title: z.string().min(1).max(200),
  businessObjective: z.string().max(2000),
  scopeIn: z.array(z.string()),
  scopeOut: z.array(z.string()),
  constraints: z.array(z.string()),
  successCriteria: z.array(z.string()),
  stakeholders: z.array(z.string()),
});
export type RequirementsBrief = z.infer<typeof RequirementsBriefSchema>;

// ---------------------------------------------------------------------------
// Solution design
// ---------------------------------------------------------------------------

export const SolutionComponentSchema = z.object({
  name: z.string().min(1),
  role: z.string(),
  toolId: z.string().optional(),
});

export const SolutionDesignSchema = z.object({
  opportunityId: z.string().min(1),
  architecture: z.string().max(3000),
  components: z.array(SolutionComponentSchema),
  integrationPoints: z.array(z.string()),
  dataFlows: z.array(z.string()),
  riskMitigations: z.array(z.string()),
});
export type SolutionDesign = z.infer<typeof SolutionDesignSchema>;

// ---------------------------------------------------------------------------
// Discovery report (full output)
// ---------------------------------------------------------------------------

export const DiscoveryReportSchema = z.object({
  runId: z.string().uuid(),
  orgId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  businessProfile: BusinessProfileSchema,
  opportunities: z.array(OpportunitySchema),
  ranked: z.array(OpportunitySchema),
  topOpportunity: OpportunitySchema,
  requirements: RequirementsBriefSchema,
  solutionDesign: SolutionDesignSchema,
  discoveryQuestions: z.array(z.string()),
  playbook: z.string(),
  readiness: z.record(z.string(), z.unknown()),
  lowSignal: z.boolean(),
  generatedAt: z.string().datetime(),
});
export type DiscoveryReport = z.infer<typeof DiscoveryReportSchema>;

// ---------------------------------------------------------------------------
// n8n parameter fill
// ---------------------------------------------------------------------------

export const N8nParameterFillSchema = z.object({
  archetypeId: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});
export type N8nParameterFill = z.infer<typeof N8nParameterFillSchema>;
