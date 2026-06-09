// Webhook signature verification (HMAC-SHA256).
// Format mirrors Slack's signing secret scheme:
//   signed string: "v0:{timestamp}:{rawBody}"
//   header:        "x-scout-signature: v0={hex}"
//   header:        "x-scout-timestamp: {unix_seconds}"

export class HmacError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_HEADER" | "TIMESTAMP_EXPIRED" | "SIGNATURE_MISMATCH",
  ) {
    super(message);
    this.name = "HmacError";
  }
}

const VERSION = "v0";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const keyMaterial = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null | undefined,
  timestampHeader: string | null | undefined,
  nowMs: number = Date.now(),
): Promise<void> {
  if (!signatureHeader || !timestampHeader) {
    throw new HmacError("Missing x-scout-signature or x-scout-timestamp header", "MISSING_HEADER");
  }

  const tsMs = parseInt(timestampHeader, 10) * 1000;
  if (isNaN(tsMs) || Math.abs(nowMs - tsMs) > MAX_AGE_MS) {
    throw new HmacError("Timestamp is expired or invalid", "TIMESTAMP_EXPIRED");
  }

  const signed = `${VERSION}:${timestampHeader}:${rawBody}`;
  const expected = `${VERSION}=${await hmacSha256Hex(secret, signed)}`;

  if (!timingSafeEqual(expected, signatureHeader)) {
    throw new HmacError("Signature mismatch", "SIGNATURE_MISMATCH");
  }
}

export async function signWebhookBody(
  secret: string,
  rawBody: string,
  timestampSeconds: number,
): Promise<string> {
  const signed = `${VERSION}:${timestampSeconds}:${rawBody}`;
  return `${VERSION}=${await hmacSha256Hex(secret, signed)}`;
}
