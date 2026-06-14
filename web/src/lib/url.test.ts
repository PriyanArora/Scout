import { describe, it, expect } from "vitest";
import { isSafeUrl } from "./url.js";

describe("isSafeUrl — ipaddr.js SSRF range classification (Wave 5 #21)", () => {
  it("allows ordinary public https hosts", () => {
    expect(isSafeUrl("https://example.com/")).toBe(true);
    expect(isSafeUrl("https://www.northbound.example/about")).toBe(true);
    expect(isSafeUrl("https://8.8.8.8/")).toBe(true);
  });

  it("rejects non-https", () => {
    expect(isSafeUrl("http://example.com/")).toBe(false);
  });

  it("rejects dotted-quad private / loopback / link-local / CGNAT", () => {
    for (const h of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0"]) {
      expect(isSafeUrl(`https://${h}/`), h).toBe(false);
    }
  });

  it("rejects decimal / hex / octal integer-form loopback (regex bypass)", () => {
    expect(isSafeUrl("https://2130706433/")).toBe(false); // 127.0.0.1 decimal
    expect(isSafeUrl("https://0x7f000001/")).toBe(false); // 127.0.0.1 hex
    expect(isSafeUrl("https://0177.0.0.1/")).toBe(false); // octal first octet
  });

  it("rejects IPv6 loopback and IPv4-mapped IPv6 loopback", () => {
    expect(isSafeUrl("https://[::1]/")).toBe(false);
    expect(isSafeUrl("https://[::ffff:127.0.0.1]/")).toBe(false);
  });

  it("rejects obvious private hostnames", () => {
    expect(isSafeUrl("https://localhost/")).toBe(false);
    expect(isSafeUrl("https://db.internal/")).toBe(false);
    expect(isSafeUrl("https://printer.local/")).toBe(false);
  });
});
