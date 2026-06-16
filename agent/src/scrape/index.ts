// Scout scrape layer — layered: Jina Reader → safe direct fetch → manual.
// Caches results in scrape_pages and returns page IDs + content hashes.

import { assertSsrfSafe, normalizeUrl, type IPResolver } from "../utils/url.js";
import { scrapeWithJina, type FetchFn } from "./jina.js";
import { safeDirectFetch } from "./direct-fetch.js";
import { lookupScrapeCache, insertScrapeCache } from "./cache.js";
import type { PersistedScrapeResult, ScrapeOptions, ScrapeResult } from "./types.js";

export interface ScrapeLayerDeps {
  supabaseUrl: string;
  serviceRoleKey: string;
  resolver: IPResolver;
  fetchFn?: FetchFn;
}

function manualFallback(url: string): ScrapeResult {
  return {
    contentHash: "",
    markdown: `<!-- manual-content-required: ${url} -->`,
    title: undefined,
    source: "manual",
    lowSignal: true,
    scrapeMs: 0,
  };
}

export async function scrapeSite(
  rawUrl: string,
  opts: ScrapeOptions,
  deps: ScrapeLayerDeps,
): Promise<PersistedScrapeResult[]> {
  const { supabaseUrl, serviceRoleKey, resolver, fetchFn = fetch } = deps;
  const { orgId, maxPages = 1 } = opts;

  // Validate and normalize URL
  const normalizedUrlObj = normalizeUrl(rawUrl);
  await assertSsrfSafe(normalizedUrlObj, resolver);
  const normalizedUrl = normalizedUrlObj.href;

  // Check cache first
  const cached = await lookupScrapeCache(supabaseUrl, serviceRoleKey, orgId, normalizedUrl, fetchFn);
  if (cached) return [cached];

  // Scrape with layered fallback
  let result: ScrapeResult;

  try {
    result = await scrapeWithJina(normalizedUrl, fetchFn);
  } catch {
    result = { contentHash: "", markdown: "", title: undefined, source: "jina", lowSignal: true, scrapeMs: 0 };
  }

  if (result.lowSignal) {
    try {
      const directResult = await safeDirectFetch(normalizedUrl, resolver, fetchFn);
      if (!directResult.lowSignal || result.contentHash === "") {
        result = directResult;
      }
    } catch {
      // direct fetch failed; continue with current result
    }
  }

  if (result.contentHash === "") {
    result = manualFallback(normalizedUrl);
  }

  // Persist to cache and return
  const pageId = await insertScrapeCache(
    supabaseUrl,
    serviceRoleKey,
    orgId,
    normalizedUrl,
    rawUrl,
    result,
    fetchFn,
  );

  const pages: PersistedScrapeResult[] = [{ ...result, pageId }];

  // High-signal page discovery: find up to (maxPages - 1) additional sub-pages
  if (!result.lowSignal && maxPages > 1) {
    const links = discoverHighSignalLinks(result.markdown, normalizedUrlObj, maxPages - 1);
    for (const link of links) {
      try {
        const subResult = await scrapeSite(link, { ...opts, maxPages: 1 }, deps);
        pages.push(...subResult);
      } catch {
        // skip inaccessible sub-pages
      }
    }
  }

  return pages;
}

function discoverHighSignalLinks(markdown: string, base: URL, max: number): string[] {
  // Constructed per call: a shared `g`-flag regex keeps lastIndex across calls
  // when the loop exits early, silently skipping links on the next invocation.
  const highSignalPathRe = /\/(about|services|solutions|products|pricing|capabilities|team|company)[^\s"')>]*/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = highSignalPathRe.exec(markdown)) !== null && found.size < max) {
    try {
      const url = new URL(m[0], base).href;
      found.add(url);
    } catch {
      // skip malformed
    }
  }

  return [...found];
}
