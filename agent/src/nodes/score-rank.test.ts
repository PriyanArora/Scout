import { describe, it, expect } from "vitest";
import { scoreAndRankNode, assignQuadrant } from "./score-rank.js";
import { makeInitialState } from "../checkpoint/types.js";
import type { Opportunity } from "../schemas/index.js";

function makeOpp(id: string, impact: number, effort: number, confidence: number): Opportunity {
  return {
    id,
    title: `Opp ${id}`,
    description: "test",
    pillar: "Operations & Efficiency",
    impactScore: impact,
    effortScore: effort,
    confidenceScore: confidence,
    toolIds: [],
    quadrant: "fill-in",
    priority: 0,
    evidenceCitations: [],
  };
}

describe("assignQuadrant", () => {
  it("high impact, low effort → quick-win", () =>
    expect(assignQuadrant(4, 2)).toBe("quick-win"));
  it("high impact, high effort → strategic", () =>
    expect(assignQuadrant(4, 4)).toBe("strategic"));
  it("low impact, low effort → fill-in", () =>
    expect(assignQuadrant(2, 2)).toBe("fill-in"));
  it("low impact, high effort → thankless", () =>
    expect(assignQuadrant(2, 4)).toBe("thankless"));
  it("boundary impact=3, effort=3 → strategic", () =>
    expect(assignQuadrant(3, 3)).toBe("strategic"));
});

describe("scoreAndRankNode", () => {
  it("returns ranked opportunities with priority 1 = best", () => {
    const state = {
      ...makeInitialState("run-1"),
      opportunities: [
        makeOpp("low", 2, 4, 0.5),
        makeOpp("high", 5, 1, 0.9),
        makeOpp("mid", 3, 2, 0.7),
      ],
    };

    const update = scoreAndRankNode(state);
    const ranked = update.opportunities as Opportunity[];

    expect(ranked[0]!.id).toBe("high");
    expect(ranked[0]!.priority).toBe(1);
    expect(ranked).toHaveLength(3);
  });

  it("assigns correct quadrant to each opportunity", () => {
    const state = {
      ...makeInitialState("run-1"),
      opportunities: [makeOpp("q", 4, 2, 1.0)],
    };
    const update = scoreAndRankNode(state);
    expect((update.opportunities as Opportunity[])[0]!.quadrant).toBe("quick-win");
  });

  it("returns empty update for no opportunities", () => {
    const state = makeInitialState("run-1");
    const update = scoreAndRankNode(state);
    expect(update.nextNode).toBe("map_tools");
  });
});
