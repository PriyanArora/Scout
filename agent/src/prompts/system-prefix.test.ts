import { describe, it, expect } from "vitest";
import { SCOUT_SYSTEM_PREFIX, NORTHBOUND_PILLARS, buildSystemPrefix } from "./system-prefix.js";
import { CATALOG_TOOLS } from "../catalog/data.js";

describe("SCOUT_SYSTEM_PREFIX (shared cacheable prefix)", () => {
  it("contains every catalog tool id (grounding lives in the cached prefix)", () => {
    for (const tool of CATALOG_TOOLS) {
      expect(SCOUT_SYSTEM_PREFIX).toContain(tool.id);
    }
  });

  it("states all four NorthBound pillars in canonical spelling", () => {
    for (const pillar of NORTHBOUND_PILLARS) {
      expect(SCOUT_SYSTEM_PREFIX).toContain(pillar);
    }
    // F-7: canonical short spelling, not "Cybersecurity & Risk Management".
    expect(SCOUT_SYSTEM_PREFIX).toContain("Cybersecurity & Risk\n");
  });

  it("clears the prompt-cache minimum (~1024 tokens) so the prefix actually caches", () => {
    // INTEGRATION_PLAN §4: a sub-minimum prefix silently caches nothing.
    // ~3.5 chars/token is a conservative English estimate; require comfortably
    // more than 1024 tokens of prefix so both the Opus and (higher-minimum)
    // Haiku caches engage.
    const approxTokens = SCOUT_SYSTEM_PREFIX.length / 3.5;
    expect(approxTokens).toBeGreaterThan(1100);
  });

  it("is byte-identical per call (cache key stability)", () => {
    expect(buildSystemPrefix()).toBe(buildSystemPrefix());
    expect(buildSystemPrefix()).toBe(SCOUT_SYSTEM_PREFIX);
  });
});
