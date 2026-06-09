import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWritePlaybook } from "./write-playbook.js";

beforeEach(() => {
  process.env.SUPABASE_URL = "https://db.example.com";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("handleWritePlaybook", () => {
  it("returns existing playbook if non-empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: "rep-1",
        playbook: "# Implementation Playbook\n\nStep 1: do this\nStep 2: do that\n".repeat(5),
        opportunities: [],
        requirements: {},
        solution_design: {},
      }],
    }));

    const result = await handleWritePlaybook({ runId: "run-abc" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain("Implementation Playbook");
  });

  it("returns error when report not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));

    const result = await handleWritePlaybook({ runId: "nonexistent" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("No report found");
  });

  it("generates playbook via Anthropic when existing playbook is empty", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "rep-1", playbook: "", opportunities: [{ title: "Email Auto" }], requirements: {}, solution_design: {} }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "# Generated Playbook\n\nPhase 1: ..." }] }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const result = await handleWritePlaybook({ runId: "run-xyz" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain("Generated Playbook");
  });
});
