-- Wave 3 #12 — conditional-request crawl support (INTEGRATION_PLAN §3 Wave 3).
-- Store validators so a re-scrape can send If-None-Match / If-Modified-Since and
-- a 304 skips both the body download and the downstream LLM. Additive/reversible:
-- nullable columns; existing rows and the happy path are unaffected.

alter table public.scrape_pages
  add column if not exists etag text,
  add column if not exists last_modified text;

-- New columns inherit pglz TOAST by default; markdown stays lz4 from Wave 0.
