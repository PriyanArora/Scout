// Token cost calculator for Scout's Claude usage.
// Prices are per 1 million tokens in USD.
// Update these values if Anthropic changes pricing.

interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM: number;
  cacheCreationPerM: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-8": {
    inputPerM: 15.0,
    outputPerM: 75.0,
    cacheReadPerM: 1.5,
    cacheCreationPerM: 18.75,
  },
  "claude-haiku-4-5": {
    inputPerM: 0.8,
    outputPerM: 4.0,
    cacheReadPerM: 0.08,
    cacheCreationPerM: 1.0,
  },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function calculateCostUsd(model: string, usage: TokenUsage): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  const M = 1_000_000;
  return (
    (usage.inputTokens * pricing.inputPerM) / M +
    (usage.outputTokens * pricing.outputPerM) / M +
    (usage.cacheReadTokens * pricing.cacheReadPerM) / M +
    (usage.cacheCreationTokens * pricing.cacheCreationPerM) / M
  );
}

export function accumulateCost(
  existing: TokenUsage & { costUsd: number },
  delta: TokenUsage,
  model: string,
): typeof existing {
  const addedCost = calculateCostUsd(model, delta);
  return {
    inputTokens: existing.inputTokens + delta.inputTokens,
    outputTokens: existing.outputTokens + delta.outputTokens,
    cacheReadTokens: existing.cacheReadTokens + delta.cacheReadTokens,
    cacheCreationTokens: existing.cacheCreationTokens + delta.cacheCreationTokens,
    costUsd: existing.costUsd + addedCost,
  };
}
