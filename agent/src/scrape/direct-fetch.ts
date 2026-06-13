// Safe direct fetch — follows redirects manually with SSRF validation at every hop.
// Used as fallback when Jina Reader returns low-signal content.

import { assertSafeRedirect, normalizeUrl, type IPResolver } from "../utils/url.js";
import { extractTitle, normalizeMarkdown } from "./normalize.js";
import { extractMainContent } from "./extract.js";
import { sha256Hex } from "./hash.js";
import { LOW_SIGNAL_THRESHOLD, type ScrapeResult } from "./types.js";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "ScoutBot/1.0 (+https://github.com/scout)";

export type FetchFn = typeof fetch;

export interface ConditionalValidators {
  etag?: string;
  lastModified?: string;
}

export async function safeDirectFetch(
  url: string,
  resolver: IPResolver,
  fetchFn: FetchFn = fetch,
  validators?: ConditionalValidators,
): Promise<ScrapeResult> {
  const t0 = Date.now();

  let currentUrl: URL;
  try {
    currentUrl = normalizeUrl(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  let prevUrl = currentUrl;
  let html = "";
  let redirectCount = 0;
  let etag: string | null = null;
  let lastModified: string | null = null;

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Conditional headers only on the first hop (validators belong to this URL).
    const condHeaders: Record<string, string> = {};
    if (redirectCount === 0 && validators?.etag) condHeaders["If-None-Match"] = validators.etag;
    if (redirectCount === 0 && validators?.lastModified) condHeaders["If-Modified-Since"] = validators.lastModified;

    let res: Response;
    try {
      res = await fetchFn(currentUrl.href, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*", ...condHeaders },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // 304 Not Modified — content unchanged; caller reuses the cached page (skips LLM).
    if (res.status === 304) {
      return {
        contentHash: "",
        markdown: "",
        title: undefined,
        source: "direct",
        lowSignal: false,
        scrapeMs: Date.now() - t0,
        notModified: true,
      };
    }

    if (res.status >= 300 && res.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
      }
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect response missing Location header");

      const nextUrl = new URL(location, currentUrl.href);
      await assertSafeRedirect(prevUrl, nextUrl, resolver);

      prevUrl = currentUrl;
      currentUrl = nextUrl;
      redirectCount++;
    } else {
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${currentUrl.href}`);
      etag = res.headers.get("etag");
      lastModified = res.headers.get("last-modified");
      html = await res.text();
      break;
    }
  }

  const title = extractTitle(html);
  const markdown = normalizeMarkdown(await extractMainContent(html, currentUrl.href));
  const contentHash = await sha256Hex(markdown);

  return {
    contentHash,
    markdown,
    title,
    source: "direct",
    lowSignal: markdown.length < LOW_SIGNAL_THRESHOLD,
    scrapeMs: Date.now() - t0,
    ...(etag ? { etag } : {}),
    ...(lastModified ? { lastModified } : {}),
  };
}
