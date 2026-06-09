import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  isSafeIp,
  assertSsrfSafe,
  assertSafeRedirect,
  UrlValidationError,
  type IPResolver,
} from "./url.js";

describe("normalizeUrl", () => {
  it("lowercases the host", () => {
    expect(normalizeUrl("https://EXAMPLE.COM/path").hostname).toBe("example.com");
  });

  it("strips the fragment", () => {
    expect(normalizeUrl("https://example.com/page#section").hash).toBe("");
  });

  it("removes default HTTP port 80", () => {
    expect(normalizeUrl("http://example.com:80/").port).toBe("");
  });

  it("removes default HTTPS port 443", () => {
    expect(normalizeUrl("https://example.com:443/").port).toBe("");
  });

  it("keeps non-default ports", () => {
    expect(normalizeUrl("https://example.com:8443/").port).toBe("8443");
  });

  it("rejects ftp scheme", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrow(UrlValidationError);
  });

  it("rejects URLs over 2048 characters", () => {
    expect(() => normalizeUrl("https://example.com/" + "a".repeat(2040))).toThrow(UrlValidationError);
  });

  it("rejects obviously invalid input", () => {
    expect(() => normalizeUrl("not-a-url")).toThrow(UrlValidationError);
  });
});

describe("isSafeIp", () => {
  it("allows public IPs", () => {
    expect(isSafeIp("8.8.8.8")).toBe(true);
    expect(isSafeIp("1.1.1.1")).toBe(true);
  });

  it("blocks loopback 127.0.0.1", () => expect(isSafeIp("127.0.0.1")).toBe(false));
  it("blocks loopback 127.x.x.x range", () => expect(isSafeIp("127.255.255.255")).toBe(false));
  it("blocks 10.x.x.x private range", () => expect(isSafeIp("10.0.0.1")).toBe(false));
  it("blocks 172.16.x.x private range", () => expect(isSafeIp("172.16.0.1")).toBe(false));
  it("blocks 192.168.x.x private range", () => expect(isSafeIp("192.168.1.1")).toBe(false));
  it("blocks 169.254.x.x link-local (metadata IP)", () => expect(isSafeIp("169.254.169.254")).toBe(false));
  it("blocks 0.0.0.0", () => expect(isSafeIp("0.0.0.0")).toBe(false));
  it("blocks IPv6 loopback ::1", () => expect(isSafeIp("::1")).toBe(false));
  it("blocks IPv6 link-local fe80::", () => expect(isSafeIp("fe80::1")).toBe(false));
  it("blocks IPv6 ULA fc00::", () => expect(isSafeIp("fc00::1")).toBe(false));
});

describe("assertSsrfSafe", () => {
  const fakeResolver = (ip: string): IPResolver => () => Promise.resolve([ip]);

  it("allows a public hostname resolving to a public IP", async () => {
    const url = new URL("https://example.com/");
    await expect(assertSsrfSafe(url, fakeResolver("8.8.8.8"))).resolves.not.toThrow();
  });

  it("rejects a hostname that resolves to a private IP", async () => {
    const url = new URL("https://internal.corp/");
    await expect(assertSsrfSafe(url, fakeResolver("10.0.0.1"))).rejects.toThrow(UrlValidationError);
  });

  it("rejects a hostname that resolves to the metadata IP", async () => {
    const url = new URL("https://metadata.example.com/");
    await expect(
      assertSsrfSafe(url, fakeResolver("169.254.169.254")),
    ).rejects.toThrow(UrlValidationError);
  });

  it("rejects a direct private IPv4 host without DNS", async () => {
    const url = new URL("http://192.168.1.1/");
    await expect(assertSsrfSafe(url, async () => [])).rejects.toThrow(UrlValidationError);
  });
});

describe("assertSafeRedirect", () => {
  const allowResolver = async () => ["8.8.8.8"];

  it("allows https → https redirect", async () => {
    const from = new URL("https://a.com/");
    const to = new URL("https://b.com/");
    await expect(assertSafeRedirect(from, to, allowResolver)).resolves.not.toThrow();
  });

  it("rejects https → http downgrade", async () => {
    const from = new URL("https://a.com/");
    const to = new URL("http://b.com/");
    await expect(assertSafeRedirect(from, to, allowResolver)).rejects.toThrow(UrlValidationError);
  });

  it("rejects redirect to private IP target", async () => {
    const from = new URL("https://a.com/");
    const to = new URL("https://b.com/");
    const privateResolver = async () => ["10.0.0.1"];
    await expect(assertSafeRedirect(from, to, privateResolver)).rejects.toThrow(UrlValidationError);
  });
});
