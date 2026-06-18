// Live interactive surface — one import for the Next.js live route + future MCP
// reuse. No new pipeline logic lives here: it re-exports the existing engine and
// adds an Anthropic deps factory so the web app shares the exact same nodes the
// MCP server / evals use.
// ponytail: thin barrel, not a new runtime — same brain, one front door.

import Anthropic from "@anthropic-ai/sdk";
import type { NodeDeps } from "./nodes/types.js";

export { scrapeWithJina } from "./scrape/jina.js";
export { profileBusinessNode } from "./nodes/profile-business.js";
export { identifyOppsNode } from "./nodes/identify-opps.js";
export { scoreAndRankNode } from "./nodes/score-rank.js";
export { mapToolsNode } from "./nodes/map-tools.js";
export { generateWorkflow, setTemplateLoader } from "./n8n/generate.js";
export { makeInitialState } from "./checkpoint/types.js";
export type { ScoutGraphState } from "./checkpoint/types.js";
export { CATALOG_TOOLS, renderCatalogBlock } from "./catalog/data.js";
export { buildSystemPrefix } from "./prompts/system-prefix.js";
export type { Opportunity, BusinessProfile } from "./schemas/index.js";
export type { ArchetypeId } from "./n8n/types.js";

export function createAnthropicDeps(apiKey: string): NodeDeps {
  const client = new Anthropic({ apiKey });
  return {
    createMessage: (params) =>
      client.messages.create(params) as Promise<Anthropic.Message>,
  };
}

export type { Anthropic };
