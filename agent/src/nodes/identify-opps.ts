import { z } from "zod";
import { OpportunitySchema, type BusinessProfile, type Opportunity } from "../schemas/index.js";

// Partial schema for raw LLM output — quadrant/priority are computed later.
const RawOpportunitySchema = OpportunitySchema.extend({
  quadrant: z.string().default(""),
  priority: z.number().int().min(0).default(0),
});

import { parseStructuredOutput, StructuredOutputError } from "../utils/parser.js";
import { accumulateCost } from "../utils/cost.js";
import {
  IDENTIFY_OPPS_SYSTEM,
  buildIdentifyOppsPrompt,
} from "../prompts/identify-opps.js";
import { buildCatalogPrefix } from "../prompts/map-tools.js";
import type { ScoutGraphState } from "../checkpoint/types.js";
import type { NodeDeps } from "./types.js";
import { extractUsage, firstTextContent } from "./types.js";

const MODEL = "claude-opus-4-8";
const OpportunitiesSchema = z.array(RawOpportunitySchema);

export async function identifyOppsNode(
  state: ScoutGraphState,
  markdown: string,
  deps: NodeDeps,
): Promise<Partial<ScoutGraphState>> {
  const profile = state.businessProfile as BusinessProfile | null;
  if (!profile) {
    return {
      error: "identify_opportunities: no business profile in state",
      nextNode: "score_and_rank",
      step: state.step + 1,
    };
  }

  const catalogPrefix = buildCatalogPrefix();
  const userPrompt = buildIdentifyOppsPrompt(profile, markdown);

  let lastError: string | null = null;
  let usage = { ...state.usage };

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionPrefix =
      attempt > 0 && lastError
        ? `Your previous response failed validation: ${lastError}\n\nOutput ONLY a valid JSON array.\n\n`
        : "";

    const message = await deps.createMessage({
      model: MODEL,
      max_tokens: 4096,
      system: [
        { type: "text", text: catalogPrefix + "\n\n" + IDENTIFY_OPPS_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: correctionPrefix + userPrompt }],
    });

    const delta = extractUsage(message);
    usage = accumulateCost(usage, delta, delta.model);

    if (message.stop_reason === "max_tokens") {
      lastError = "Response truncated by max_tokens";
      continue;
    }

    try {
      const opps = parseStructuredOutput<Opportunity[]>(
        firstTextContent(message),
        OpportunitiesSchema,
      );
      return {
        opportunities: opps,
        usage,
        nextNode: "score_and_rank",
        step: state.step + 1,
        error: null,
      };
    } catch (err) {
      lastError = err instanceof StructuredOutputError ? err.message : String(err);
    }
  }

  return {
    usage,
    error: `identify_opportunities failed: ${lastError}`,
    nextNode: "score_and_rank",
    step: state.step + 1,
  };
}

export const _MODEL = MODEL;
