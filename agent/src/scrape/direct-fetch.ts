// Safe direct fetch — follows redirects manually with SSRF validation at every hop.
// Used as fallback when Jina Reader returns low-signal content.

import { assertSafeRedirect, normalizeUrl, type IPResolver } from "../utils/url.js";
import { htmlToText, extractTitle, normalizeMarkdown } from "./normalize.js";
import { sha256Hex } from "./hash.js";
import { LOW_SIGNAL_THRESHOLD, type ScrapeResult } from "./types.js";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "ScoutBot/1.0 (+https://github.com/scout)";

export type FetchFn = typeof fetch;

export async function safeDirectFetch(
  url: string,
  resolver: IPResolver,
  fetchFn: FetchFn = fetch,
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

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetchFn(currentUrl.href, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
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
      html = await res.text();
      break;
    }
  }

  const title = extractTitle(html);
  const text = htmlToText(html);
  const markdown = normalizeMarkdown(text);
  const contentHash = await sha256Hex(markdown);

  return {
    contentHash,
    markdown,
    title,
    source: "direct",
    lowSignal: markdown.length < LOW_SIGNAL_THRESHOLD,
    scrapeMs: Date.now() - t0,
  };
}
