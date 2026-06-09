// Deterministic scoring and ranking — no LLM calls.
// Computes priority score and assigns 2x2 quadrant from impact/effort scores.

import type { Opportunity } from "../schemas/index.js";
import type { ScoutGraphState } from "../checkpoint/types.js";

type Quadrant = "quick-win" | "strategic" | "fill-in" | "thankless";

function assignQuadrant(impact: number, effort: number): Quadrant {
  const highImpact = impact >= 3;
  const highEffort = effort >= 3;
  if (highImpact && !highEffort) return "quick-win";
  if (highImpact && highEffort) return "strategic";
  if (!highImpact && !highEffort) return "fill-in";
  return "thankless";
}

function computePriority(opp: Opportunity): number {
  // Weighted score: impact × confidence is the primary signal; effort is a tiebreaker (lower effort = better)
  return opp.impactScore * opp.confidenceScore * 10 - opp.effortScore;
}

export function scoreAndRankNode(state: ScoutGraphState): Partial<ScoutGraphState> {
  const opps = state.opportunities as Opportunity[];
  if (!opps || opps.length === 0) {
    return { nextNode: "map_tools", step: state.step + 1 };
  }

  const ranked: Opportunity[] = opps
    .map((opp) => ({
      ...opp,
      quadrant: assignQuadrant(opp.impactScore, opp.effortScore),
      priority: Math.round(computePriority(opp) * 100) / 100,
    }))
    .sort((a, b) => b.priority - a.priority)
    .map((opp, idx) => ({ ...opp, priority: idx + 1 })); // final priority = rank position

  return {
    opportunities: ranked,
    nextNode: "map_tools",
    step: state.step + 1,
  };
}

export { assignQuadrant, computePriority };
