// HMAC-SHA256 signing — Web Crypto API (Node 18+)

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

export async function signWebhookBody(
  secret: string,
  rawBody: string,
  timestampSeconds: number,
): Promise<string> {
  const hex = await hmacSha256(secret, `v0:${timestampSeconds}:${rawBody}`);
  return `v0=${hex}`;
}
