// Shared dependency types for agent graph nodes.

import type Anthropic from "@anthropic-ai/sdk";
import type { ScrapeLayerDeps } from "../scrape/index.js";

export interface LlmDeps {
  createMessage: (
    params: Anthropic.MessageCreateParamsNonStreaming,
  ) => Promise<Anthropic.Message>;
}

export interface NodeDeps extends LlmDeps {
  scrapeDeps?: ScrapeLayerDeps;
}

export interface NodeUsageDelta {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  model: string;
}

export function extractUsage(message: Anthropic.Message): NodeUsageDelta {
  const u = message.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    model: message.model,
  };
}

export function firstTextContent(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No text content in response");
  return block.text;
}
