# ADR 005 — Jina Reader as Primary Scraper

**Status:** Accepted
**Date:** 2026-06-09

## Context

Scout needs to fetch and extract readable text from arbitrary public company websites. Websites range from simple static pages to JavaScript-heavy SPAs. Requirements:

- Works inside a Deno Edge Function (no headless browser, no Puppeteer)
- Free or low-cost for moderate volume (20–50 runs/month)
- Returns clean markdown without boilerplate navigation and ads
- Handles JavaScript-rendered content

Options evaluated:

| Option | Verdict |
|--------|---------|
| Direct `fetch()` + HTML stripping | Poor for JS-heavy sites; low extraction quality |
| Puppeteer / Playwright | Cannot run in Deno Edge; heavy dependency |
| Firecrawl API | Good quality; costs ~$0.01/page; requires API key |
| Jina Reader (`r.jina.ai/{url}`) | **Chosen as primary** — free, returns clean markdown, zero setup |
| Firecrawl as fallback | **Chosen as secondary** — enabled via `FIRECRAWL_API_KEY` |

## Decision

Use Jina Reader (`https://r.jina.ai/{url}`) as the primary scrape path. Jina is a free public service that renders the page server-side and returns clean markdown. No API key required.

If Jina returns content below the low-signal threshold (< 200 words), or if `FIRECRAWL_API_KEY` is set, the scrape service falls back to Firecrawl.

SSRF protection is applied before every fetch: `isSafeUrl()` rejects private IPs (RFC 1918, link-local, loopback). Every redirect hop is validated against the same check — not just the initial URL.

Scraped content is cached in `scrape_pages` (7-day TTL). Cache hits skip the external HTTP call entirely.

## Consequences

**Positive**
- Zero extra cost for the primary path; Jina is free and requires no account
- Jina handles SPAs well; extraction quality is comparable to Firecrawl for most company sites
- The Edge Function makes a single HTTP call to Jina rather than running a browser
- Cache reduces duplicate scraping for the same URL across multiple runs

**Negative / risks**
- Jina is a third-party service with no SLA; downtime causes low-signal fallback
- Jina proxies the request through their servers — scraped content transits through Jina's infrastructure
- Pages behind authentication or bot-detection (e.g., Cloudflare challenges) will return low/no content
- The `r.jina.ai` URL format must not be SSRF-checked as a private IP — the internal check validates the *original* URL, not the Jina URL
