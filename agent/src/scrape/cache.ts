// Scrape page cache — reads from and inserts into the scrape_pages Supabase table.
// Uses PostgREST fetch (no Supabase client dependency).

import type { PersistedScrapeResult, ScrapeCacheRow, ScrapeResult } from "./types.js";

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, apikey: key };
}

export async function lookupScrapeCache(
  supabaseUrl: string,
  serviceRoleKey: string,
  orgId: string,
  normalizedUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<PersistedScrapeResult | null> {
  const q = new URL(`${supabaseUrl}/rest/v1/scrape_pages`);
  q.searchParams.set("org_id", `eq.${orgId}`);
  q.searchParams.set("normalized_url", `eq.${normalizedUrl}`);
  q.searchParams.set("expires_at", `gt.${new Date().toISOString()}`);
  q.searchParams.set("order", "created_at.desc");
  q.searchParams.set("limit", "1");

  const res = await fetchFn(q.toString(), { headers: authHeaders(serviceRoleKey) });
  if (!res.ok) throw new Error(`Scrape cache lookup failed: ${res.status}`);

  const rows = (await res.json()) as ScrapeCacheRow[];
  if (rows.length === 0) return null;

  const row = rows[0]!;
  return {
    pageId: row.id,
    contentHash: row.content_hash,
    markdown: row.markdown,
    title: row.title ?? undefined,
    source: (row.scrape_meta["source"] as PersistedScrapeResult["source"]) ?? "direct",
    lowSignal: Boolean(row.scrape_meta["lowSignal"]),
    scrapeMs: 0,
  };
}

export async function insertScrapeCache(
  supabaseUrl: string,
  serviceRoleKey: string,
  orgId: string,
  normalizedUrl: string,
  sourceUrl: string,
  result: ScrapeResult,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchFn(`${supabaseUrl}/rest/v1/scrape_pages`, {
    method: "POST",
    headers: {
      ...authHeaders(serviceRoleKey),
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify({
      org_id: orgId,
      normalized_url: normalizedUrl,
      source_url: sourceUrl,
      content_hash: result.contentHash,
      title: result.title ?? null,
      markdown: result.markdown,
      scrape_meta: { source: result.source, lowSignal: result.lowSignal },
    }),
  });

  if (!res.ok) throw new Error(`Scrape cache insert failed: ${res.status}`);

  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? "";
}
