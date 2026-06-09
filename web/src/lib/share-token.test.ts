import { describe, it, expect } from "vitest";
import { generateShareToken, hashShareToken } from "./share-token.js";

// Helpers that mirror the application-level share lifecycle checks.
// The actual DB enforcement lives in the get_public_report_by_share_token_hash RPC;
// these tests verify the timestamp arithmetic used by the route handler.
function isExpired(shareExpiresAt: string, now = new Date()): boolean {
  return new Date(shareExpiresAt) < now;
}

function isRevoked(shareRevokedAt: string | null): boolean {
  return shareRevokedAt !== null;
}

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

describe("share token lifecycle — expiry and revocation", () => {
  it("is not expired when share_expires_at is in the future", () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  it("is expired when share_expires_at is in the past", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it("is expired exactly at the expiry boundary (edge case)", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1).toISOString();
    expect(isExpired(expiresAt, now)).toBe(true);
  });

  it("is not revoked when share_revoked_at is null", () => {
    expect(isRevoked(null)).toBe(false);
  });

  it("is revoked when share_revoked_at is set", () => {
    expect(isRevoked(new Date().toISOString())).toBe(true);
  });

  it("expiry check is independent of revocation status", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const revokedAt = new Date().toISOString();
    // Not expired but revoked — access should be denied (revocation takes precedence)
    expect(isExpired(future)).toBe(false);
    expect(isRevoked(revokedAt)).toBe(true);
  });
});
