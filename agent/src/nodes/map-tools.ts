import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type Opportunity } from "../schemas/index.js";
import { parseStructuredOutput, StructuredOutputError } from "../utils/parser.js";
import { filterValidToolIds } from "../utils/catalog.js";
import { accumulateCost } from "../utils/cost.js";
import {
  MAP_TOOLS_SYSTEM_SUFFIX,
  buildMapToolsPrompt,
} from "../prompts/map-tools.js";
import { buildSystemPrefix } from "../prompts/system-prefix.js";
import type { ScoutGraphState } from "../checkpoint/types.js";
import type { NodeDeps } from "./types.js";
import { extractUsage, firstTextContent } from "./types.js";

const MODEL = "claude-opus-4-8";

const ToolMappingSchema = z.array(
  z.object({ opportunityId: z.string(), toolIds: z.array(z.string()) }),
);

export async function mapToolsNode(
  state: ScoutGraphState,
  deps: NodeDeps,
): Promise<Partial<ScoutGraphState>> {
  const opps = state.opportunities as Opportunity[];
  if (!opps || opps.length === 0) {
    return { nextNode: "discovery_questions", step: state.step + 1 };
  }

  const userPrompt = buildMapToolsPrompt(opps);

  let lastError: string | null = null;
  let usage = { ...state.usage };

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionPrefix =
      attempt > 0 && lastError
        ? `Validation failed: ${lastError}\n\nOutput ONLY catalog IDs from the list above.\n\n`
        : "";

    const message = await deps.createMessage({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: buildSystemPrefix(), cache_control: { type: "ephemeral" } },
        { type: "text", text: MAP_TOOLS_SYSTEM_SUFFIX },
      ],
      output_config: { format: zodOutputFormat(ToolMappingSchema) },
      messages: [{ role: "user", content: correctionPrefix + userPrompt }],
    });

    const delta = extractUsage(message);
    usage = accumulateCost(usage, delta, delta.model);

    if (message.stop_reason === "max_tokens") {
      lastError = "Response truncated";
      continue;
    }

    try {
      type ToolMapping = { opportunityId: string; toolIds: string[] };
      const mappings = parseStructuredOutput<ToolMapping[]>(firstTextContent(message), ToolMappingSchema);

      // Build updated opportunities with filtered tool IDs
      const mapped: Opportunity[] = opps.map((opp) => {
        const match = mappings.find((m) => m.opportunityId === opp.id);
        if (!match) return opp;
        const validIds = filterValidToolIds(match.toolIds);
        return { ...opp, toolIds: validIds };
      });

      return {
        opportunities: mapped,
        usage,
        nextNode: "discovery_questions",
        step: state.step + 1,
        error: null,
      };
    } catch (err) {
      lastError = err instanceof StructuredOutputError ? err.message : String(err);
    }
  }

  return {
    usage,
    error: `map_tools failed: ${lastError}`,
    nextNode: "discovery_questions",
    step: state.step + 1,
  };
}

export const _MODEL = MODEL;
