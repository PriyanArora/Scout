// Slim URL normalization and SSRF protection for web API routes.

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

export function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/.test(h)) return false;
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
