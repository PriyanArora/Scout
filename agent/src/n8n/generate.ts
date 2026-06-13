import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Opportunity } from "../schemas/index.js";
import type { LlmDeps } from "../nodes/types.js";
import { extractUsage, firstTextContent } from "../nodes/types.js";
import { accumulateCost } from "../utils/cost.js";
import type { UsageAccumulator } from "../checkpoint/types.js";
import { parseStructuredOutput, StructuredOutputError } from "../utils/parser.js";
import { N8N_FILL_SYSTEM, buildN8nFillPrompt } from "../prompts/n8n-fill.js";
import { buildSystemPrefix } from "../prompts/system-prefix.js";
import { selectArchetype } from "./select-archetype.js";
import { mergeWorkflow } from "./merger.js";
import { validateWorkflow } from "./validator.js";
import type { ArchetypeId, N8nWorkflow, PlaceholderMap } from "./types.js";

const MODEL = "claude-haiku-4-5";

const TEMPLATES: Record<ArchetypeId, () => N8nWorkflow> = {
  "scheduled-scrape-summarize-notify": () =>
    JSON.parse(
      // Inline at build time via importSync pattern — fallback to dynamic in tests
      // In Deno/edge this is inlined; tests inject via loadTemplate override
      readTemplateSync("scheduled-scrape-summarize-notify"),
    ) as N8nWorkflow,
  "webhook-enrich-store": () =>
    JSON.parse(readTemplateSync("webhook-enrich-store")) as N8nWorkflow,
  "form-to-crm": () =>
    JSON.parse(readTemplateSync("form-to-crm")) as N8nWorkflow,
  "inbound-email-triage": () =>
    JSON.parse(readTemplateSync("inbound-email-triage")) as N8nWorkflow,
  "rag-faq-skeleton": () =>
    JSON.parse(readTemplateSync("rag-faq-skeleton")) as N8nWorkflow,
};

// Injectable loader — override in tests or edge function where fs is unavailable
let templateLoader: ((id: ArchetypeId) => string) | null = null;

export function setTemplateLoader(fn: (id: ArchetypeId) => string): void {
  templateLoader = fn;
}

function readTemplateSync(id: string): string {
  if (templateLoader) return templateLoader(id as ArchetypeId);
  // Node.js path (agent tests / local dev). This package is ESM, so
  // require/__dirname don't exist — recreate them from import.meta.url.
  const require = createRequire(import.meta.url);
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const tplPath = path.resolve(here, "../../n8n_templates", `${id}.json`);
  return fs.readFileSync(tplPath, "utf8");
}

const PlaceholderMapSchema = z.record(z.string(), z.string());

export interface GenerateResult {
  archetype: ArchetypeId;
  workflow: N8nWorkflow;
  usage: UsageAccumulator;
}

export async function generateWorkflow(
  opp: Opportunity,
  toolIds: string[],
  deps: LlmDeps,
  baseUsage?: UsageAccumulator,
): Promise<GenerateResult> {
  const archetype = selectArchetype(opp, toolIds);
  const template = TEMPLATES[archetype]();
  let usage: UsageAccumulator = baseUsage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 };

  let lastError: string | null = null;
  let filledMap: PlaceholderMap | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionPrefix =
      attempt > 0 && lastError
        ? `Your previous response failed: ${lastError}\n\nOutput ONLY valid JSON.\n\n`
        : "";

    const message = await deps.createMessage({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: buildSystemPrefix(), cache_control: { type: "ephemeral" } },
        { type: "text", text: N8N_FILL_SYSTEM },
      ],
      messages: [
        {
          role: "user",
          content: correctionPrefix + buildN8nFillPrompt(archetype, opp, toolIds),
        },
      ],
    });

    const delta = extractUsage(message);
    usage = accumulateCost(usage, delta, delta.model);

    try {
      filledMap = parseStructuredOutput<PlaceholderMap>(
        firstTextContent(message),
        PlaceholderMapSchema,
      );
      break;
    } catch (err) {
      lastError = err instanceof StructuredOutputError ? err.message : String(err);
    }
  }

  // Fall back to empty map if LLM failed — workflow will have unresolved placeholders
  // which the validator will flag but we still return a best-effort result
  const merged = mergeWorkflow(template, filledMap ?? {});
  const validation = validateWorkflow(merged);

  if (!validation.valid) {
    // Non-fatal — caller decides whether to surface errors
    console.warn(
      `[n8n:generate] workflow validation warnings for archetype "${archetype}":`,
      validation.errors,
    );
  }

  return { archetype, workflow: merged, usage };
}
