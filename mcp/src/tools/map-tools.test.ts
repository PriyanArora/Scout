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
  it("returns tool mapping JSON on success", async () => {
    const mockResponse = [
      { opportunityId: "email-automation", toolIds: ["ms-exchange", "ms-outlook"] },
      { opportunityId: "data-insights", toolIds: ["snowflake", "ms-power-bi"] },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: JSON.stringify(mockResponse) }],
      }),
    }));

    const result = await handleMapTools({ opportunities: MOCK_OPPS });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text) as Array<{ opportunityId: string }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.opportunityId).toBe("email-automation");
  });

  it("returns error message when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await handleMapTools({ opportunities: MOCK_OPPS });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("ANTHROPIC_API_KEY");
  });
});
