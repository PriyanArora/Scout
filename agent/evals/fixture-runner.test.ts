// Fixture test — runs the full discovery graph with mock LLM responses.
// Verifies the pipeline produces a valid structured output without real API calls.

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { runLocalGraph } from "../src/graph/runner.js";
import type { NodeDeps } from "../src/nodes/types.js";
import type { Opportunity } from "../src/schemas/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "../fixtures/northbound-example.json");

function mockMessage(text: string): Anthropic.Message {
  return {
    id: "msg_mock",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-opus-4-8",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 200,
      cache_read_input_tokens: 50,
      cache_creation_input_tokens: 0,
    } as Anthropic.Usage,
  } as Anthropic.Message;
}

function makeMockDeps(): NodeDeps {
  return {
    createMessage: async (params) => {
      // Key off the node-specific block (last text block, after the shared
      // cacheable prefix) — the prefix mentions every report section.
      const systemText = Array.isArray(params.system)
        ? (params.system.filter((s) => s.type === "text").at(-1)?.text ?? "")
        : String(params.system ?? "");

      if (systemText.includes("business profile") || systemText.includes("business analyst")) {
        return mockMessage(JSON.stringify({
          name: "NorthBound Solutions",
          industry: "Professional services",
          description: "A finance and compliance consulting firm.",
          primaryServices: ["Regulatory Compliance", "Finance Transformation"],
          technologyIndicators: ["Microsoft 365", "Snowflake"],
          evidenceSnippets: ["mid-market professional services firm"],
        }));
      }

      if (systemText.includes("automation") || systemText.includes("opportunities")) {
        return mockMessage(JSON.stringify([{
          id: "month-end-close",
          title: "Month-End Close Automation",
          description: "Automate 40+ reconciliation steps.",
          pillar: "Operations & Efficiency",
          impactScore: 5,
          effortScore: 3,
          confidenceScore: 0.9,
          roiEstimate: "High",
          evidenceCitations: ["month-end close takes 12 days"],
          toolIds: [],
          quadrant: "",
          priority: 0,
        }]));
      }

      if (systemText.includes("tool") && systemText.includes("catalog")) {
        return mockMessage(JSON.stringify([
          { opportunityId: "month-end-close", toolIds: ["power-automate", "snowflake"] },
        ]));
      }

      // discovery questions
      return mockMessage(JSON.stringify([
        "Can you walk us through your current month-end close process?",
        "Which steps consume the most manual effort?",
        "What data systems are involved?",
      ]));
    },
  };
}

describe("fixture runner", () => {
  it("runs the full discovery pipeline with mock LLM and produces structured output", async () => {
    const raw = await readFile(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { url: string; markdown: string };
    const deps = makeMockDeps();

    // Start from profile_business — fixture provides markdown directly, no scraping needed
    const result = await runLocalGraph(fixture.url, fixture.markdown, deps, "profile_business");

    // Pipeline completed all non-LLM-dependent nodes
    expect(result.completedNodes).toContain("profile_business");
    expect(result.completedNodes).toContain("score_and_rank");
    expect(result.completedNodes).toContain("map_tools");

    // Business profile extracted
    expect(result.state.businessProfile).not.toBeNull();
    expect((result.state.businessProfile as { name: string }).name).toBe("NorthBound Solutions");

    // Opportunities ranked with quadrant and priority
    const opps = result.state.opportunities as Opportunity[];
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0]!.quadrant).not.toBe(""); // quadrant assigned
    expect(opps[0]!.priority).toBeGreaterThan(0);

    // Tool IDs validated against catalog
    expect(opps[0]!.toolIds).toContain("power-automate");

    // Usage accumulated
    expect(result.state.usage.inputTokens).toBeGreaterThan(0);

    console.log("\n[fixture] report JSON:\n", JSON.stringify(result.state, null, 2));
  }, 15_000);
});
