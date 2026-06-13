export type ScrapeSource = "jina" | "direct" | "firecrawl" | "manual";

export interface ScrapeResult {
  contentHash: string;
  markdown: string;
  title: string | undefined;
  source: ScrapeSource;
  lowSignal: boolean;
  scrapeMs: number;
  // Conditional-request validators (Wave 3 #12): captured from response headers
  // and replayed as If-None-Match / If-Modified-Since on a later re-scrape.
  etag?: string;
  lastModified?: string;
  // true when a conditional GET returned 304 Not Modified — caller reuses cache.
  notModified?: boolean;
}

export interface PersistedScrapeResult extends ScrapeResult {
  pageId: string;
}

export interface ScrapeOptions {
  orgId: string;
  normalizedUrl: string;
  maxPages?: number;
}

export interface ScrapeCacheRow {
  id: string;
  markdown: string;
  title: string | null;
  content_hash: string;
  scrape_meta: Record<string, unknown>;
}

// Minimum markdown length to be considered non-trivial content.
export const LOW_SIGNAL_THRESHOLD = 500;
// Maximum pages to scrape per run.
export const MAX_PAGES = 5;
