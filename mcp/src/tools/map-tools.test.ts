import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleMapTools } from "./map-tools.js";

const MOCK_OPPS = [
  { id: "email-automation", title: "Email Automation", pillar: "Customer Experience & Marketing" },
  { id: "data-insights", title: "Data Insights", pillar: "Data & Decision Intelligence" },
];

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("handleMapTools", () => {
  it("returns tool mapping JSON on success and filters out non-catalog ids", async () => {
    const mockResponse = [
      // microsoft-teams is canonical; made-up-tool must be filtered out (grounding).
      { opportunityId: "email-automation", toolIds: ["microsoft-teams", "made-up-tool"] },
      { opportunityId: "data-insights", toolIds: ["snowflake", "power-bi"] },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify(mockResponse) }],
      }),
    }));

    const result = await handleMapTools({ opportunities: MOCK_OPPS });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text) as Array<{ opportunityId: string; toolIds: string[] }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.opportunityId).toBe("email-automation");
    expect(parsed[0]!.toolIds).toContain("microsoft-teams");
    expect(parsed[0]!.toolIds).not.toContain("made-up-tool");
    expect(parsed[1]!.toolIds).toEqual(["snowflake", "power-bi"]);
  });

  it("returns error message when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await handleMapTools({ opportunities: MOCK_OPPS });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("ANTHROPIC_API_KEY");
  });
});
