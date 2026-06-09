// Pre-scrape idempotency key: deterministic hash of (normalizedUrl, notesHash).
// Generated before any scraping so duplicate requests with the same inputs
// return the existing run without re-invoking Claude.

async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashNotes(notes: string): Promise<string> {
  return sha256Hex(notes);
}

export async function makeIdempotencyKey(
  normalizedUrl: string,
  notesHash: string,
): Promise<string> {
  return sha256Hex(`${normalizedUrl}:${notesHash}`);
}
