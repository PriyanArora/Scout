import { describe, it, expect } from "vitest";
import { generateShareToken, hashShareToken } from "./share-token.js";

describe("generateShareToken", () => {
  it("returns a rawToken and tokenHash", async () => {
    const { rawToken, tokenHash } = await generateShareToken();
    expect(typeof rawToken).toBe("string");
    expect(typeof tokenHash).toBe("string");
  });

  it("rawToken is base64url (no +, /, or = chars)", async () => {
    const { rawToken } = await generateShareToken();
    expect(rawToken).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("tokenHash is a 64-character lowercase hex string", async () => {
    const { tokenHash } = await generateShareToken();
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).toMatch(/^[0-9a-f]+$/);
  });

  it("rawToken and tokenHash differ", async () => {
    const { rawToken, tokenHash } = await generateShareToken();
    expect(rawToken).not.toBe(tokenHash);
  });

  it("generates unique tokens on each call", async () => {
    const a = await generateShareToken();
    const b = await generateShareToken();
    expect(a.rawToken).not.toBe(b.rawToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hashShareToken", () => {
  it("produces the same hash as generateShareToken", async () => {
    const { rawToken, tokenHash } = await generateShareToken();
    const recomputed = await hashShareToken(rawToken);
    expect(recomputed).toBe(tokenHash);
  });
});
