// Jina Reader client — keyless Markdown extraction via https://r.jina.ai/{url}
// Primary scrape path: fast, returns clean Markdown, no authentication required.

import { LOW_SIGNAL_THRESHOLD, type ScrapeResult } from "./types.js";
import { normalizeMarkdown } from "./normalize.js";
import { sha256Hex } from "./hash.js";

const JINA_BASE = "https://r.jina.ai/";
const JINA_TIMEOUT_MS = 30_000;

const LOW_SIGNAL_PATTERNS = [
  /access denied/i,
  /enable javascript/i,
  /captcha/i,
  /cloudflare/i,
  /please turn javascript on/i,
  /checking your browser/i,
  /robot.*check/i,
];

export function buildJinaUrl(targetUrl: string): string {
  return JINA_BASE + encodeURIComponent(targetUrl);
}

function isLowSignal(markdown: string): boolean {
  if (markdown.length < LOW_SIGNAL_THRESHOLD) return true;
  return LOW_SIGNAL_PATTERNS.some((re) => re.test(markdown));
}

export type FetchFn = typeof fetch;

export async function scrapeWithJina(
  url: string,
  fetchFn: FetchFn = fetch,
): Promise<ScrapeResult> {
  const t0 = Date.now();
  const jinaUrl = buildJinaUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  let raw: string;
  try {
    const res = await fetchFn(jinaUrl, {
      headers: { Accept: "text/markdown, text/plain, */*" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Jina returned HTTP ${res.status}`);
    }
    raw = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const markdown = normalizeMarkdown(raw);
  const contentHash = await sha256Hex(markdown);

  return {
    contentHash,
    markdown,
    title: extractJinaTitle(markdown),
    source: "jina",
    lowSignal: isLowSignal(markdown),
    scrapeMs: Date.now() - t0,
  };
}

function extractJinaTitle(markdown: string): string | undefined {
  const firstHeading = /^#+ (.+)$/m.exec(markdown);
  return firstHeading?.[1]?.trim();
}
