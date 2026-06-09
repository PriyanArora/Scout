import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { mapToolsNode } from "./map-tools.js";
import { makeInitialState } from "../checkpoint/types.js";
import type { Opportunity } from "../schemas/index.js";
import type { NodeDeps } from "./types.js";

function mockMessage(text: string): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-opus-4-8",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 80, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } as Anthropic.Usage,
  } as Anthropic.Message;
}

const OPP: Opportunity = {
  id: "close-automation",
  title: "Month-End Close Automation",
  description: "Automate reconciliation",
  pillar: "Operations & Efficiency",
  impactScore: 5,
  effortScore: 3,
  confidenceScore: 0.9,
  toolIds: [],
  quadrant: "strategic",
  priority: 1,
  evidenceCitations: ["month-end close takes 12 days"],
};

describe("mapToolsNode", () => {
  it("assigns valid catalog tool IDs to opportunities", async () => {
    const response = JSON.stringify([
      { opportunityId: "close-automation", toolIds: ["power-automate", "snowflake"] },
    ]);
    const deps: NodeDeps = { createMessage: async () => mockMessage(response) };
    const state = { ...makeInitialState("run-1"), opportunities: [OPP] };

    const update = await mapToolsNode(state, deps);
    const mapped = update.opportunities as Opportunity[];

    expect(mapped[0]!.toolIds).toContain("power-automate");
    expect(mapped[0]!.toolIds).toContain("snowflake");
  });

  it("filters out tool IDs that are not in the catalog", async () => {
    const response = JSON.stringify([
      { opportunityId: "close-automation", toolIds: ["power-automate", "MADE_UP_TOOL"] },
    ]);
    const deps: NodeDeps = { createMessage: async () => mockMessage(response) };
    const state = { ...makeInitialState("run-1"), opportunities: [OPP] };

    const update = await mapToolsNode(state, deps);
    const mapped = update.opportunities as Opportunity[];

    expect(mapped[0]!.toolIds).toContain("power-automate");
    expect(mapped[0]!.toolIds).not.toContain("MADE_UP_TOOL");
  });

  it("returns without error for empty opportunities list", async () => {
    const deps: NodeDeps = { createMessage: async () => mockMessage("[]") };
    const state = makeInitialState("run-1");

    const update = await mapToolsNode(state, deps);
    expect(update.nextNode).toBe("discovery_questions");
  });
});
