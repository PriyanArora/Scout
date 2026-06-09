// Share token generation — Web Crypto API (Node 18+ / edge compatible)

export interface ShareTokenPair {
  rawToken: string;  // returned once to caller; never stored
  tokenHash: string; // SHA-256 hex; stored in DB
}

export async function generateShareToken(): Promise<ShareTokenPair> {
  const buffer = new ArrayBuffer(32);
  const bytes = new Uint8Array(buffer);
  crypto.getRandomValues(bytes);

  // base64url encode
  const rawToken = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  const tokenHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { rawToken, tokenHash };
}

export async function hashShareToken(rawToken: string): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
