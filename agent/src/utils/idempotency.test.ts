import { describe, it, expect } from "vitest";
import { hashNotes, makeIdempotencyKey } from "./idempotency.js";

describe("hashNotes", () => {
  it("returns a 64-character hex string", async () => {
    const hash = await hashNotes("some notes");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic for the same input", async () => {
    const a = await hashNotes("notes");
    const b = await hashNotes("notes");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashNotes("notes-a");
    const b = await hashNotes("notes-b");
    expect(a).not.toBe(b);
  });

  it("treats empty string differently from non-empty", async () => {
    const a = await hashNotes("");
    const b = await hashNotes("x");
    expect(a).not.toBe(b);
  });
});

describe("makeIdempotencyKey", () => {
  it("returns a 64-character hex string", async () => {
    const key = await makeIdempotencyKey("https://example.com", "abc");
    expect(key).toHaveLength(64);
  });

  it("is deterministic for the same inputs", async () => {
    const a = await makeIdempotencyKey("https://example.com", "abc");
    const b = await makeIdempotencyKey("https://example.com", "abc");
    expect(a).toBe(b);
  });

  it("differs for different URLs", async () => {
    const a = await makeIdempotencyKey("https://a.com", "abc");
    const b = await makeIdempotencyKey("https://b.com", "abc");
    expect(a).not.toBe(b);
  });

  it("differs for different note hashes", async () => {
    const a = await makeIdempotencyKey("https://example.com", "hash-1");
    const b = await makeIdempotencyKey("https://example.com", "hash-2");
    expect(a).not.toBe(b);
  });
});
