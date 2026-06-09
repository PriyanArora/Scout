import { describe, it, expect } from "vitest";
import { verifyWebhookSignature, signWebhookBody, HmacError } from "./hmac.js";

const SECRET = "test-secret-key";
const BODY = '{"url":"https://example.com"}';
const NOW_MS = 1_700_000_000_000;
const TS = Math.floor(NOW_MS / 1000);

async function makeValidSignature(): Promise<string> {
  return signWebhookBody(SECRET, BODY, TS);
}

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature", async () => {
    const sig = await makeValidSignature();
    await expect(
      verifyWebhookSignature(SECRET, BODY, sig, String(TS), NOW_MS),
    ).resolves.not.toThrow();
  });

  it("rejects a tampered body", async () => {
    const sig = await makeValidSignature();
    await expect(
      verifyWebhookSignature(SECRET, "tampered", sig, String(TS), NOW_MS),
    ).rejects.toThrow(HmacError);
  });

  it("rejects an expired timestamp (> 5 minutes old)", async () => {
    const staleTs = TS - 6 * 60;
    const sig = await signWebhookBody(SECRET, BODY, staleTs);
    await expect(
      verifyWebhookSignature(SECRET, BODY, sig, String(staleTs), NOW_MS),
    ).rejects.toThrow(HmacError);
  });

  it("rejects a future timestamp beyond 5 minutes", async () => {
    const futureTs = TS + 6 * 60;
    const sig = await signWebhookBody(SECRET, BODY, futureTs);
    await expect(
      verifyWebhookSignature(SECRET, BODY, sig, String(futureTs), NOW_MS),
    ).rejects.toThrow(HmacError);
  });

  it("rejects missing signature header", async () => {
    await expect(
      verifyWebhookSignature(SECRET, BODY, null, String(TS), NOW_MS),
    ).rejects.toThrow(HmacError);
  });

  it("rejects missing timestamp header", async () => {
    const sig = await makeValidSignature();
    await expect(
      verifyWebhookSignature(SECRET, BODY, sig, null, NOW_MS),
    ).rejects.toThrow(HmacError);
  });

  it("rejects a wrong secret", async () => {
    const sig = await signWebhookBody("wrong-secret", BODY, TS);
    await expect(
      verifyWebhookSignature(SECRET, BODY, sig, String(TS), NOW_MS),
    ).rejects.toThrow(HmacError);
  });
});
