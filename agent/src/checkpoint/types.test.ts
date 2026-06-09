import { describe, it, expect } from "vitest";
import { makeInitialState, INITIAL_USAGE } from "./types.js";

describe("makeInitialState", () => {
  it("sets scrape_site as the first node", () => {
    const state = makeInitialState("run-abc");
    expect(state.nextNode).toBe("scrape_site");
  });

  it("starts at step 0 with empty collections", () => {
    const state = makeInitialState("run-abc");
    expect(state.step).toBe(0);
    expect(state.scrapePageIds).toEqual([]);
    expect(state.opportunities).toEqual([]);
    expect(state.businessProfile).toBeNull();
    expect(state.error).toBeNull();
  });

  it("initializes with zero usage matching INITIAL_USAGE", () => {
    const state = makeInitialState("run-abc");
    expect(state.usage).toEqual(INITIAL_USAGE);
  });

  it("sets startedAt to a valid ISO 8601 timestamp", () => {
    const before = new Date().toISOString();
    const state = makeInitialState("run-abc");
    const after = new Date().toISOString();
    expect(state.startedAt >= before).toBe(true);
    expect(state.startedAt <= after).toBe(true);
  });

  it("does not share usage object across calls", () => {
    const a = makeInitialState("run-1");
    const b = makeInitialState("run-2");
    a.usage.inputTokens = 100;
    expect(b.usage.inputTokens).toBe(0);
  });
});
