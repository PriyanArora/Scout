// Secure share token: 32-byte random token (base64url), SHA-256 hash for DB storage.
// The raw token is returned exactly once (on generation) and never stored.

export interface ShareToken {
  rawToken: string;
  tokenHash: string;
}

export async function generateShareToken(): Promise<ShareToken> {
  const buffer = new ArrayBuffer(32);
  const bytes = new Uint8Array(buffer);
  crypto.getRandomValues(bytes);
  const rawToken = base64url(bytes);

  const hashBytes = await crypto.subtle.digest("SHA-256", buffer);
  const tokenHash = Array.from(new Uint8Array(hashBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { rawToken, tokenHash };
}

export async function hashShareToken(rawToken: string): Promise<string> {
  const bytes = base64urlDecode(rawToken);
  const hashBytes = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hashBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
