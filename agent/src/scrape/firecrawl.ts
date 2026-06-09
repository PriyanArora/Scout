// Optional Firecrawl adapter — guarded behind FIRECRAWL_API_KEY.
// Used as a third-tier fallback when both Jina and direct fetch return low-signal.

import { normalizeMarkdown } from "./normalize.js";
import { sha256Hex } from "./hash.js";
import { type ScrapeResult } from "./types.js";

export function isFirecrawlEnabled(): boolean {
  return typeof process !== "undefined" && !!process.env["FIRECRAWL_API_KEY"];
}

export async function scrapeWithFirecrawl(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<ScrapeResult> {
  const apiKey = process.env["FIRECRAWL_API_KEY"];
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not set");

  const t0 = Date.now();

  const res = await fetchFn("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!res.ok) throw new Error(`Firecrawl returned HTTP ${res.status}`);

  const json = (await res.json()) as {
    success: boolean;
    data?: { markdown?: string; title?: string };
  };

  if (!json.success || !json.data?.markdown) {
    throw new Error("Firecrawl returned no markdown content");
  }

  const markdown = normalizeMarkdown(json.data.markdown);
  const contentHash = await sha256Hex(markdown);

  return {
    contentHash,
    markdown,
    title: json.data.title,
    source: "firecrawl",
    lowSignal: markdown.length < 500,
    scrapeMs: Date.now() - t0,
  };
}
