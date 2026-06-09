import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { profileBusinessNode } from "./profile-business.js";
import { makeInitialState } from "../checkpoint/types.js";
import type { NodeDeps } from "./types.js";

function mockMessage(text: string, stopReason: string = "end_turn"): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-opus-4-8",
    stop_reason: stopReason as Anthropic.Message["stop_reason"],
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 20,
      cache_creation_input_tokens: 0,
    } as Anthropic.Usage,
  } as Anthropic.Message;
}

const VALID_PROFILE = JSON.stringify({
  name: "Acme Corp",
  industry: "Technology",
  description: "A software company.",
  primaryServices: ["SaaS"],
  technologyIndicators: ["AWS"],
  evidenceSnippets: ["Acme is a software company"],
});

const MARKDOWN = "# Acme Corp\nWe are a software company using AWS. " + "A".repeat(600);

describe("profileBusinessNode", () => {
  it("returns businessProfile on valid response", async () => {
    const deps: NodeDeps = {
      createMessage: async () => mockMessage(VALID_PROFILE),
    };
    const state = makeInitialState("run-1");
    const update = await profileBusinessNode(state, MARKDOWN, deps);

    expect(update.businessProfile).toBeDefined();
    expect((update.businessProfile as { name: string }).name).toBe("Acme Corp");
    expect(update.error).toBeNull();
    expect(update.nextNode).toBe("identify_opportunities");
  });

  it("retries once on invalid JSON and uses second response", async () => {
    let callCount = 0;
    const deps: NodeDeps = {
      createMessage: async () => {
        callCount++;
        return callCount === 1 ? mockMessage("not valid json") : mockMessage(VALID_PROFILE);
      },
    };
    const state = makeInitialState("run-1");
    const update = await profileBusinessNode(state, MARKDOWN, deps);

    expect(callCount).toBe(2);
    expect(update.businessProfile).toBeDefined();
  });

  it("persists error in state after two failures", async () => {
    const deps: NodeDeps = {
      createMessage: async () => mockMessage("not json"),
    };
    const state = makeInitialState("run-1");
    const update = await profileBusinessNode(state, MARKDOWN, deps);

    expect(update.error).toContain("profile_business failed");
    expect(update.nextNode).toBe("identify_opportunities"); // continues to next node
  });

  it("accumulates token usage", async () => {
    const deps: NodeDeps = {
      createMessage: async () => mockMessage(VALID_PROFILE),
    };
    const state = makeInitialState("run-1");
    const update = await profileBusinessNode(state, MARKDOWN, deps);

    expect(update.usage!.inputTokens).toBeGreaterThan(0);
  });
});
