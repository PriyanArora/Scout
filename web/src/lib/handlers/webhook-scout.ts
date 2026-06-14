import { z } from "zod";
import { verifyWebhookSignature } from "../hmac.js";
import { normalizeUrl, assertSsrfSafe, UrlValidationError } from "../url.js";

// .strict() rejects unexpected top-level keys (defense-in-depth — Wave 5 #21 /
// Decision Log Area C). The permissive `data` record still allows arbitrary
// nested payload, but the envelope shape is now locked down.
const WebhookBodySchema = z
  .object({
    url: z.string().min(1).max(2048),
    notes: z.string().max(20000).default(""),
    event: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type WebhookDeps = {
  webhookSecret: string;
  serviceRoleUrl: string;
  serviceRoleKey: string;
  agentUrl: string;
  internalSecret: string;
  orgId: string;
  nowMs?: number;
};

export type WebhookResult =
  | { ok: true; runId: string; isNew: boolean }
  | { ok: false; status: number; error: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
}

export async function handleWebhookScout(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  // Verify HMAC
  try {
    await verifyWebhookSignature(
      deps.webhookSecret,
      rawBody,
      signatureHeader,
      timestampHeader,
      deps.nowMs,
    );
  } catch (err) {
    return { ok: false, status: 401, error: `Unauthorized: ${String(err)}` };
  }

  // Parse body
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }

  const parsed = WebhookBodySchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: 400, error: `Invalid payload: ${parsed.error.message}` };
  }

  const { url: rawUrl, notes } = parsed.data;

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(rawUrl);
    assertSsrfSafe(normalizedUrl);
  } catch (err) {
    const msg = err instanceof UrlValidationError ? err.message : "URL validation failed";
    return { ok: false, status: 422, error: msg };
  }

  const notesHash = await sha256Hex(notes);
  const idempotencyKey = await sha256Hex(`${deps.orgId}:${normalizedUrl}:${notesHash}`);

  // Dedupe
  const checkQ = new URLSearchParams({
    idempotency_key: `eq.${idempotencyKey}`,
    org_id: `eq.${deps.orgId}`,
    status: "in.(queued,running,retrying)",
    limit: "1",
    select: "id",
  });
  const checkRes = await fetch(`${deps.serviceRoleUrl}/rest/v1/runs?${checkQ}`, {
    headers: authHeaders(deps.serviceRoleKey),
  });
  if (!checkRes.ok) {
    return { ok: false, status: 503, error: "Database unavailable" };
  }
  const existing = (await checkRes.json()) as Array<{ id: string }>;
  if (existing.length > 0) {
    return { ok: true, runId: existing[0]!.id, isNew: false };
  }

  // Insert run
  const insertRes = await fetch(`${deps.serviceRoleUrl}/rest/v1/runs`, {
    method: "POST",
    headers: { ...authHeaders(deps.serviceRoleKey), Prefer: "return=representation" },
    body: JSON.stringify({
      org_id: deps.orgId,
      trigger_source: "webhook",
      submitted_url: rawUrl.slice(0, 2048),
      normalized_url: normalizedUrl,
      notes,
      notes_hash: notesHash,
      idempotency_key: idempotencyKey,
      status: "queued",
      next_node: "scrape_site",
    }),
  });

  if (!insertRes.ok) {
    const t = await insertRes.text();
    if (insertRes.status === 409) {
      const retryRes = await fetch(`${deps.serviceRoleUrl}/rest/v1/runs?${checkQ}`, {
        headers: authHeaders(deps.serviceRoleKey),
      });
      const retryRows = retryRes.ok ? ((await retryRes.json()) as Array<{ id: string }>) : [];
      if (retryRows.length > 0) return { ok: true, runId: retryRows[0]!.id, isNew: false };
    }
    return { ok: false, status: 503, error: `Insert run failed: ${t}` };
  }

  const [run] = (await insertRes.json()) as [{ id: string }];
  const runId = run!.id;

  fetch(deps.agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deps.serviceRoleKey}`,
      "x-scout-internal": deps.internalSecret,
    },
    body: JSON.stringify({ run_id: runId, source: "webhook" }),
  }).catch(() => {});

  return { ok: true, runId, isNew: true };
}
