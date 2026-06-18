import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { BusinessProfileSchema } from "../schemas/index.js";
import { parseStructuredOutput, StructuredOutputError } from "../utils/parser.js";
import { accumulateCost } from "../utils/cost.js";
import {
  PROFILE_BUSINESS_SYSTEM,
  buildProfileBusinessPrompt,
} from "../prompts/profile-business.js";
import { buildSystemPrefix } from "../prompts/system-prefix.js";
import type { ScoutGraphState } from "../checkpoint/types.js";
import type { NodeDeps } from "./types.js";
import { extractUsage, firstTextContent } from "./types.js";

const MODEL = "claude-opus-4-8";

export async function profileBusinessNode(
  state: ScoutGraphState,
  markdown: string,
  deps: NodeDeps,
): Promise<Partial<ScoutGraphState>> {
  const userPrompt = buildProfileBusinessPrompt(markdown);

  let lastError: string | null = null;
  let usage = { ...state.usage };

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionPrefix =
      attempt > 0 && lastError
        ? `Your previous response failed validation: ${lastError}\n\nPlease output ONLY valid JSON.\n\n`
        : "";

    const message = await deps.createMessage({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: "text", text: buildSystemPrefix(), cache_control: { type: "ephemeral" } },
        { type: "text", text: PROFILE_BUSINESS_SYSTEM },
      ],
      // Structured outputs: schema-valid by construction. zodOutputFormat strips
      // unsupported keywords (min/max/format) and sets additionalProperties:false.
      // parseStructuredOutput below stays as the client-side validator + jsonrepair net.
      output_config: { format: zodOutputFormat(BusinessProfileSchema) },
      messages: [{ role: "user", content: correctionPrefix + userPrompt }],
    });

    const delta = extractUsage(message);
    usage = accumulateCost(usage, delta, delta.model);

    if (message.stop_reason === "max_tokens") {
      lastError = "Response truncated by max_tokens";
      continue;
    }

    try {
      const profile = parseStructuredOutput(firstTextContent(message), BusinessProfileSchema);
      return {
        businessProfile: profile as Record<string, unknown>,
        usage,
        nextNode: "identify_opportunities",
        step: state.step + 1,
        error: null,
      };
    } catch (err) {
      lastError = err instanceof StructuredOutputError ? err.message : String(err);
    }
  }

  return {
    usage,
    error: `profile_business failed: ${lastError}`,
    nextNode: "identify_opportunities",
    step: state.step + 1,
  };
}

// Export schema for fixture validation
export { BusinessProfileSchema as ProfileSchema };

// Zod type alias for use in tests
export type BusinessProfileOut = z.infer<typeof BusinessProfileSchema>;
