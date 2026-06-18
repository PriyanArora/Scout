export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

const PRIVATE_RANGES_V4: Array<[number, number]> = [
  // 10.0.0.0/8
  [0x0a000000, 0x0affffff],
  // 172.16.0.0/12
  [0xac100000, 0xac1fffff],
  // 192.168.0.0/16
  [0xc0a80000, 0xc0a8ffff],
  // 100.64.0.0/10 — carrier-grade NAT
  [0x64400000, 0x647fffff],
];

const LOOPBACK_RANGE_V4: [number, number] = [0x7f000000, 0x7fffffff]; // 127.0.0.0/8
const LINK_LOCAL_V4: [number, number] = [0xa9fe0000, 0xa9feffff]; // 169.254.0.0/16

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const byte = parseInt(part, 10);
    if (isNaN(byte) || byte < 0 || byte > 255) return null;
    n = (n << 8) | byte;
  }
  return n >>> 0; // unsigned 32-bit
}

function inRange(n: number, [lo, hi]: [number, number]): boolean {
  return n >= lo && n <= hi;
}

export function isSafeIp(ip: string): boolean {
  const v4 = ipv4ToInt(ip);
  if (v4 !== null) {
    if (v4 === 0) return false; // 0.0.0.0
    if (inRange(v4, LOOPBACK_RANGE_V4)) return false;
    if (inRange(v4, LINK_LOCAL_V4)) return false;
    for (const range of PRIVATE_RANGES_V4) {
      if (inRange(v4, range)) return false;
    }
    return true;
  }

  // IPv6
  const lower = ip.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (lower === "::1") return false; // loopback
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false; // ULA fc00::/7
  if (lower.startsWith("fe80")) return false; // link-local
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped: check the embedded IPv4
    const embedded = lower.slice(7);
    return isSafeIp(embedded);
  }

  return true;
}

export function normalizeUrl(raw: string): URL {
  if (raw.length > 2048) {
    throw new UrlValidationError("URL exceeds 2048 characters");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UrlValidationError(`Invalid URL: ${raw}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlValidationError(`Scheme must be http or https, got ${parsed.protocol}`);
  }

  // Normalize: lowercase host, remove default ports, remove fragment
  parsed.hostname = parsed.hostname.toLowerCase();
  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }
  parsed.hash = "";

  return parsed;
}

export type IPResolver = (hostname: string) => Promise<string[]>;

export async function assertSsrfSafe(url: URL, resolver: IPResolver): Promise<void> {
  const { hostname } = url;

  // Direct IP address — no DNS needed
  const v4 = ipv4ToInt(hostname);
  if (v4 !== null || hostname.startsWith("[")) {
    if (!isSafeIp(hostname)) {
      throw new UrlValidationError(`IP address ${hostname} is not allowed`);
    }
    return;
  }

  const resolved = await resolver(hostname);
  for (const ip of resolved) {
    if (!isSafeIp(ip)) {
      throw new UrlValidationError(`Hostname ${hostname} resolves to disallowed IP ${ip}`);
    }
  }
}

export async function assertSafeRedirect(
  from: URL,
  to: URL,
  resolver: IPResolver,
): Promise<void> {
  if (from.protocol === "https:" && to.protocol === "http:") {
    throw new UrlValidationError(`Redirect from HTTPS to HTTP is not allowed: ${to.href}`);
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") {
    throw new UrlValidationError(`Redirect target scheme must be http or https, got ${to.protocol}`);
  }
  await assertSsrfSafe(to, resolver);
}
