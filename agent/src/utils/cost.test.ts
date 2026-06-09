import { describe, it, expect } from "vitest";
import { calculateCostUsd, accumulateCost } from "./cost.js";

describe("calculateCostUsd", () => {
  it("calculates opus cost correctly for 1M tokens each", () => {
    const cost = calculateCostUsd("claude-opus-4-8", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(15.0 + 75.0 + 1.5 + 18.75, 2);
  });

  it("calculates haiku cost correctly for 1M tokens each", () => {
    const cost = calculateCostUsd("claude-haiku-4-5", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.8 + 4.0 + 0.08 + 1.0, 2);
  });

  it("returns 0 for unknown model", () => {
    expect(calculateCostUsd("unknown-model", { inputTokens: 1000, outputTokens: 1000, cacheReadTokens: 0, cacheCreationTokens: 0 })).toBe(0);
  });

  it("returns 0 for zero usage", () => {
    expect(calculateCostUsd("claude-opus-4-8", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 })).toBe(0);
  });
});

describe("accumulateCost", () => {
  const base = { inputTokens: 100, outputTokens: 200, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0.001 };
  const delta = { inputTokens: 50, outputTokens: 100, cacheReadTokens: 10, cacheCreationTokens: 5 };

  it("sums token counts", () => {
    const result = accumulateCost(base, delta, "claude-haiku-4-5");
    expect(result.inputTokens).toBe(150);
    expect(result.outputTokens).toBe(300);
    expect(result.cacheReadTokens).toBe(10);
    expect(result.cacheCreationTokens).toBe(5);
  });

  it("adds calculated cost to existing costUsd", () => {
    const result = accumulateCost(base, delta, "claude-haiku-4-5");
    expect(result.costUsd).toBeGreaterThan(base.costUsd);
  });
});
