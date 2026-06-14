// Slim URL normalization and SSRF protection for web API routes.

import ipaddr from "ipaddr.js";

export class UrlValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_URL" | "UNSAFE_SCHEME" | "PRIVATE_IP" | "REDIRECT_MISMATCH",
  ) {
    super(message);
    this.name = "UrlValidationError";
  }
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:") throw new UrlValidationError("Only HTTPS is allowed", "UNSAFE_SCHEME");
    return u.href;
  } catch (err) {
    if (err instanceof UrlValidationError) throw err;
    throw new UrlValidationError(`Invalid URL: ${raw}`, "INVALID_URL");
  }
}

// Ranges that must never be reachable from a server-side fetch.
const BLOCKED_IP_RANGES = new Set([
  "unspecified", // 0.0.0.0/8, ::
  "broadcast",
  "loopback", // 127/8, ::1
  "private", // 10/8, 172.16/12, 192.168/16
  "linkLocal", // 169.254/16, fe80::/10
  "uniqueLocal", // fc00::/7
  "carrierGradeNat", // 100.64/10
  "reserved",
]);

// Coerce decimal / hex / octal integer hosts (SSRF bypass forms the WHATWG URL
// parser leaves as-is, e.g. http://2130706433 = 127.0.0.1) into dotted-quad so
// ipaddr.js can classify them. Returns the original host if it isn't a bare integer.
function coerceIntegerHost(host: string): string {
  let n: number | null = null;
  if (/^\d{1,10}$/.test(host)) n = Number(host);
  else if (/^0x[0-9a-f]+$/i.test(host)) n = parseInt(host, 16);
  else if (/^0[0-7]+$/.test(host)) n = parseInt(host, 8);
  if (n === null || !Number.isInteger(n) || n < 0 || n > 0xffffffff) return host;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;

    // Strip IPv6 brackets; coerce integer-form IPv4.
    let host = u.hostname;
    if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
    host = coerceIntegerHost(host);

    // IP literal → classify the range with ipaddr.js (catches decimal/octal/hex,
    // IPv4-mapped IPv6, 0.0.0.0/8, CGNAT, ULA — all missed by a hostname regex).
    if (ipaddr.isValid(host)) {
      let addr = ipaddr.parse(host);
      // Unwrap IPv4-mapped IPv6 (::ffff:127.0.0.1) before classifying.
      if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
        addr = (addr as ipaddr.IPv6).toIPv4Address();
      }
      return !BLOCKED_IP_RANGES.has(addr.range());
    }

    // Hostname (not an IP literal): block obvious private names. DNS-resolution
    // pinning isn't possible on the Edge runtime — see claude/OPERATIONS.md (security) residual.
    if (/^(localhost$|.*\.local$|.*\.internal$)/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function assertSsrfSafe(url: string): void {
  if (!isSafeUrl(url)) {
    throw new UrlValidationError(`URL is not safe: ${url}`, "PRIVATE_IP");
  }
}
