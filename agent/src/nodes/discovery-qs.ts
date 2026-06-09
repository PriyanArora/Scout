import { z } from "zod";
import { type BusinessProfile, type Opportunity } from "../schemas/index.js";
import { parseStructuredOutput, StructuredOutputError } from "../utils/parser.js";
import { accumulateCost } from "../utils/cost.js";
import {
  DISCOVERY_QS_SYSTEM,
  buildDiscoveryQsPrompt,
} from "../prompts/discovery-qs.js";
import type { ScoutGraphState } from "../checkpoint/types.js";
import type { NodeDeps } from "./types.js";
import { extractUsage, firstTextContent } from "./types.js";

const MODEL = "claude-haiku-4-5";
const QuestionsSchema = z.array(z.string().min(1));

export async function discoveryQuestionsNode(
  state: ScoutGraphState,
  deps: NodeDeps,
): Promise<Partial<ScoutGraphState>> {
  const profile = state.businessProfile as BusinessProfile | null;
  const opps = state.opportunities as Opportunity[];
  const topOpp = opps?.[0];

  if (!profile || !topOpp) {
    return { nextNode: "finalize", step: state.step + 1 };
  }

  const userPrompt = buildDiscoveryQsPrompt(profile, topOpp);
  let usage = { ...state.usage };

  const message = await deps.createMessage({
    model: MODEL,
    max_tokens: 1024,
    system: DISCOVERY_QS_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const delta = extractUsage(message);
  usage = accumulateCost(usage, delta, delta.model);

  let questions: string[] = [];
  try {
    questions = parseStructuredOutput<string[]>(firstTextContent(message), QuestionsSchema);
  } catch (err) {
    const msg = err instanceof StructuredOutputError ? err.message : String(err);
    return {
      usage,
      error: `discovery_questions parse failed: ${msg}`,
      nextNode: "finalize",
      step: state.step + 1,
    };
  }

  return {
    // Questions stored in state for graph runner to pick up and write to report
    opportunities: (state.opportunities as Opportunity[]).map((o, i) =>
      i === 0 ? { ...o, discoveryQuestions: questions } : o,
    ) as Opportunity[],
    usage,
    nextNode: "finalize",
    step: state.step + 1,
    error: null,
  };
}

export const _MODEL = MODEL;
