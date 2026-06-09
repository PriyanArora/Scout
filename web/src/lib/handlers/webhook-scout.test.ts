import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWebhookScout, type WebhookDeps } from "./webhook-scout.js";
import { signWebhookBody } from "../hmac.js";

const SECRET = "test-webhook-secret";
const NOW_MS = 1_700_000_000_000;
const TS = Math.floor(NOW_MS / 1000);

const BASE_DEPS: WebhookDeps = {
  webhookSecret: SECRET,
  serviceRoleUrl: "https://db.example.com",
  serviceRoleKey: "service-key",
  agentUrl: "https://agent.example.com",
  internalSecret: "internal-secret",
  orgId: "org-webhook-1",
  nowMs: NOW_MS,
};

function mockFetch(...responses: Array<{ ok: boolean; status?: number; body: unknown }>) {
  const mock = vi.fn();
  responses.forEach((r) => {
    mock.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    });
  });
  mock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" });
  return mock;
}

async function makeRequest(body: unknown) {
  const rawBody = JSON.stringify(body);
  const sig = await signWebhookBody(SECRET, rawBody, TS);
  return { rawBody, sig, ts: String(TS) };
}

describe("handleWebhookScout", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects request with missing signature", async () => {
    const result = await handleWebhookScout(
      '{"url":"https://example.com"}',
      null,
      null,
      BASE_DEPS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects request with wrong signature", async () => {
    const { rawBody, ts } = await makeRequest({ url: "https://example.com" });
    const result = await handleWebhookScout(rawBody, "v0=badbad", ts, BASE_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects request with expired timestamp", async () => {
    const staleTs = String(Math.floor(NOW_MS / 1000) - 600); // 10 min ago
    const rawBody = '{"url":"https://example.com"}';
    const sig = await signWebhookBody(SECRET, rawBody, parseInt(staleTs, 10));
    const result = await handleWebhookScout(rawBody, sig, staleTs, BASE_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("accepts valid signed request and inserts run", async () => {
    vi.stubGlobal("fetch", mockFetch(
      { ok: true, body: [] },                     // dedup: none
      { ok: true, body: [{ id: "wh-run-1" }] },  // insert
    ));

    const { rawBody, sig, ts } = await makeRequest({ url: "https://acme.com" });
    const result = await handleWebhookScout(rawBody, sig, ts, BASE_DEPS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.runId).toBe("wh-run-1");
      expect(result.isNew).toBe(true);
    }
  });

  it("deduplicates signed request with matching idempotency key", async () => {
    vi.stubGlobal("fetch", mockFetch(
      { ok: true, body: [{ id: "existing-wh-run" }] }, // dedup hit
    ));

    const { rawBody, sig, ts } = await makeRequest({ url: "https://acme.com" });
    const result = await handleWebhookScout(rawBody, sig, ts, BASE_DEPS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.runId).toBe("existing-wh-run");
      expect(result.isNew).toBe(false);
    }
  });

  it("rejects private IP URL in webhook payload", async () => {
    const { rawBody, sig, ts } = await makeRequest({ url: "https://10.0.0.1/internal" });
    const result = await handleWebhookScout(rawBody, sig, ts, BASE_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
  });
});
