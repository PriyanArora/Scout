import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRunDiscovery } from "./run-discovery.js";

beforeEach(() => {
  process.env.SCOUT_WEBHOOK_URL = "https://scout.example.com/api/webhook/scout";
  process.env.SCOUT_WEBHOOK_SECRET = "test-secret";
  process.env.PUBLIC_APP_URL = "https://scout.example.com";
});

describe("handleRunDiscovery", () => {
  it("returns run_id on successful 202 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ run_id: "test-run-123", accepted: true }),
    }));

    const result = await handleRunDiscovery({ url: "https://acme.com" });
    expect(result.isError).toBeFalsy();
    const text = JSON.parse(result.content[0]!.text);
    expect(text.run_id).toBe("test-run-123");
  });

  it("returns error on webhook failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "Invalid signature" }),
    }));

    const result = await handleRunDiscovery({ url: "https://acme.com" });
    expect(result.isError).toBe(true);
  });

  it("sends x-scout-signature header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ run_id: "run-abc" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await handleRunDiscovery({ url: "https://acme.com", notes: "test" });
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["x-scout-signature"]).toMatch(/^v0=/);
  });
});
