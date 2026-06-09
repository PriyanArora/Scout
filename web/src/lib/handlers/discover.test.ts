import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleDiscover, type DiscoverDeps } from "./discover.js";

const BASE_DEPS: DiscoverDeps = {
  orgId: "org-test-1",
  userId: "user-test-1",
  serviceRoleUrl: "https://db.example.com",
  serviceRoleKey: "service-key",
  agentUrl: "https://agent.example.com",
  internalSecret: "secret",
};

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetch(...responses: Array<{ ok: boolean; status?: number; body: unknown }>): FetchMock {
  const mock = vi.fn();
  responses.forEach((r, i) => {
    mock.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    });
  });
  // Default: agent fire-and-forget
  mock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" });
  return mock;
}

describe("handleDiscover", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects invalid body", async () => {
    const result = await handleDiscover({}, BASE_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects private IP URLs", async () => {
    const result = await handleDiscover({ url: "https://192.168.1.1/path" }, BASE_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
  });

  it("rejects HTTP URLs", async () => {
    const result = await handleDiscover({ url: "http://example.com" }, BASE_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
  });

  it("returns existing run ID when active duplicate exists", async () => {
    const mockFetchFn = mockFetch(
      { ok: true, body: [{ id: "existing-run-id" }] }, // dedup check returns existing
    );
    vi.stubGlobal("fetch", mockFetchFn);

    const result = await handleDiscover({ url: "https://example.com" }, BASE_DEPS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.runId).toBe("existing-run-id");
      expect(result.isNew).toBe(false);
    }
  });

  it("inserts new run when no duplicate exists", async () => {
    const mockFetchFn = mockFetch(
      { ok: true, body: [] },                       // dedup: no existing
      { ok: true, body: [{ id: "new-run-id" }] },   // insert
    );
    vi.stubGlobal("fetch", mockFetchFn);

    const result = await handleDiscover({ url: "https://acme.example.com" }, BASE_DEPS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.runId).toBe("new-run-id");
      expect(result.isNew).toBe(true);
    }
  });

  it("returns 503 when DB is unavailable", async () => {
    const mockFetchFn = mockFetch(
      { ok: false, status: 500, body: { message: "DB error" } },
    );
    vi.stubGlobal("fetch", mockFetchFn);

    const result = await handleDiscover({ url: "https://example.com" }, BASE_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("normalizes bare URL (adds https scheme) and creates run", async () => {
    const mockFetchFn = mockFetch(
      { ok: true, body: [] },                      // dedup: no existing
      { ok: true, body: [{ id: "run-123" }] },     // insert
    );
    vi.stubGlobal("fetch", mockFetchFn);

    const result = await handleDiscover({ url: "example.com" }, BASE_DEPS);
    // Should succeed — url normalization adds https://
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isNew).toBe(true);
  });
});
