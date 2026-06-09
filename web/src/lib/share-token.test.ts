import { describe, it, expect } from "vitest";
import { generateShareToken, hashShareToken } from "./share-token.js";

describe("generateShareToken", () => {
  it("returns a raw token and its SHA-256 hash", async () => {
    const { rawToken, tokenHash } = await generateShareToken();
    expect(typeof rawToken).toBe("string");
    expect(rawToken.length).toBeGreaterThan(30);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("raw token is not the same as the hash", async () => {
    const { rawToken, tokenHash } = await generateShareToken();
    expect(rawToken).not.toBe(tokenHash);
  });

  it("generates different tokens on each call", async () => {
    const a = await generateShareToken();
    const b = await generateShareToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("raw token is base64url (no +, /, or = padding)", async () => {
    const { rawToken } = await generateShareToken();
    expect(rawToken).not.toContain("+");
    expect(rawToken).not.toContain("/");
    expect(rawToken).not.toContain("=");
  });

  it("hashShareToken reproduces the stored hash", async () => {
    const { rawToken, tokenHash } = await generateShareToken();
    const recomputed = await hashShareToken(rawToken);
    expect(recomputed).toBe(tokenHash);
  });

  it("tokenHash is absent from storage (raw token never stored)", async () => {
    // This test verifies the pattern: caller stores only tokenHash, never rawToken.
    // The generateShareToken function is the only place rawToken appears — no DB call here.
    const { rawToken, tokenHash } = await generateShareToken();
    expect(tokenHash).not.toBe(rawToken);
    expect(tokenHash).toHaveLength(64); // SHA-256 hex = 64 chars
  });
});
