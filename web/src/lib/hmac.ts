// HMAC-SHA256 webhook verification — Web Crypto API (Node.js 18+).

const MAX_TIMESTAMP_DRIFT_S = 300;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  nowMs = Date.now(),
): Promise<void> {
  if (!signatureHeader || !timestampHeader) {
    throw new Error("Missing signature headers");
  }

  const tsSeconds = parseInt(timestampHeader, 10);
  if (isNaN(tsSeconds) || Math.abs(nowMs / 1000 - tsSeconds) > MAX_TIMESTAMP_DRIFT_S) {
    throw new Error("Timestamp out of acceptable range");
  }

  const expected = await hmacSha256(secret, `v0:${tsSeconds}:${rawBody}`);
  const provided = signatureHeader.startsWith("v0=") ? signatureHeader.slice(3) : signatureHeader;

  // Timing-safe comparison (hex length = 64 for SHA-256)
  const a = hexToBytes(expected);
  const b = hexToBytes(provided.padEnd(expected.length, "0").slice(0, expected.length));
  if (a.length !== b.length) throw new Error("Invalid signature");

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i]! ^ b[i]!);
  if (diff !== 0) throw new Error("Signature mismatch");
}

export async function signWebhookBody(secret: string, rawBody: string, timestampSeconds: number): Promise<string> {
  const hex = await hmacSha256(secret, `v0:${timestampSeconds}:${rawBody}`);
  return `v0=${hex}`;
}
