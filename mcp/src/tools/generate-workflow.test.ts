import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleGenerateWorkflow } from "./generate-workflow.js";

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("handleGenerateWorkflow", () => {
  it("selects correct archetype from opportunity keywords", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{"__SLACK_CHANNEL_ID__":"C123"}' }] }),
    }));

    const result = await handleGenerateWorkflow({
      opportunity: { id: "faq-bot", title: "FAQ Knowledge Bot", description: "Build a knowledge base search tool" },
      toolIds: ["ms-sharepoint"],
    });

    const json = JSON.parse(result.content[0]!.text) as { archetype: string };
    expect(json.archetype).toBe("rag-faq-skeleton");
  });

  it("falls back to webhook-enrich-store for generic opportunity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{}' }] }),
    }));

    const result = await handleGenerateWorkflow({
      opportunity: { id: "generic", title: "General Improvement", description: "Improve things" },
      toolIds: [],
    });

    const json = JSON.parse(result.content[0]!.text) as { archetype: string };
    expect(json.archetype).toBe("webhook-enrich-store");
  });

  it("works without API key (returns archetype without placeholders)", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await handleGenerateWorkflow({
      opportunity: { id: "lead-intake", title: "Lead Intake Form", description: "CRM form" },
      toolIds: ["ms-dynamics-crm"],
    });

    const json = JSON.parse(result.content[0]!.text) as { archetype: string; note?: string };
    expect(json.archetype).toBe("form-to-crm");
    expect(json.note).toContain("ANTHROPIC_API_KEY");
  });
});
