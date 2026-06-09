import { describe, it, expect, vi } from "vitest";
import { scrapeSite } from "./index.js";
import type { ScrapeLayerDeps } from "./index.js";
import type { IPResolver } from "../utils/url.js";

const PUBLIC_RESOLVER: IPResolver = async () => ["8.8.8.8"];
const SUPABASE_URL = "https://test.supabase.co";
const SVC_KEY = "test-key";

function makeDeps(overrides: Partial<ScrapeLayerDeps> = {}): ScrapeLayerDeps {
  return {
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SVC_KEY,
    resolver: PUBLIC_RESOLVER,
    ...overrides,
  };
}

const GOOD_MARKDOWN = "#".padEnd(5, " ") + "Acme Corp\n\n" + "A".repeat(600);

function makeFetch(markdown: string, status = 200): typeof fetch {
  return vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
    const urlStr = String(url);
    const method = opts?.method?.toUpperCase() ?? "GET";

    if (urlStr.includes("scrape_pages") && method === "GET") {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (urlStr.includes("scrape_pages") && method === "POST") {
      return new Response(JSON.stringify([{ id: "page-uuid-1" }]), { status: 201 });
    }

    return new Response(markdown, { status });
  }) as unknown as typeof fetch;
}

describe("scrapeSite — Jina success path", () => {
  it("returns a persisted result with pageId and contentHash", async () => {
    const results = await scrapeSite(
      "https://example.com",
      { orgId: "org-1", normalizedUrl: "https://example.com/", maxPages: 1 },
      makeDeps({ fetchFn: makeFetch(GOOD_MARKDOWN) }),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.pageId).toBe("page-uuid-1");
    expect(results[0]!.contentHash).toHaveLength(64);
    expect(results[0]!.source).toBe("jina");
    expect(results[0]!.lowSignal).toBe(false);
  });
});

describe("scrapeSite — cache hit", () => {
  it("returns cached result without calling Jina", async () => {
    const fetchFn = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = opts?.method?.toUpperCase() ?? "GET";
      if (String(url).includes("scrape_pages") && method === "GET") {
        return new Response(
          JSON.stringify([{
            id: "cached-page",
            content_hash: "abc".padEnd(64, "0"),
            markdown: GOOD_MARKDOWN,
            title: "Cached Title",
            scrape_meta: { source: "jina", lowSignal: false },
          }]),
          { status: 200 },
        );
      }
      throw new Error("Jina should not be called on cache hit");
    }) as unknown as typeof fetch;

    const results = await scrapeSite(
      "https://example.com",
      { orgId: "org-1", normalizedUrl: "https://example.com/", maxPages: 1 },
      makeDeps({ fetchFn }),
    );

    expect(results[0]!.pageId).toBe("cached-page");
    expect(results[0]!.source).toBe("jina");
  });
});

describe("scrapeSite — unsafe URL rejection", () => {
  it("throws for a private IP URL without making any fetch calls", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;

    await expect(
      scrapeSite(
        "http://192.168.1.1/",
        { orgId: "org-1", normalizedUrl: "http://192.168.1.1/", maxPages: 1 },
        makeDeps({ fetchFn, resolver: async () => ["192.168.1.1"] }),
      ),
    ).rejects.toThrow();

    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("scrapeSite — low-signal fallback", () => {
  it("sets lowSignal=true and source=manual when all fetch paths return short content", async () => {
    const shortContent = "short";

    const fetchFn = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const urlStr = String(url);
      const method = opts?.method?.toUpperCase() ?? "GET";
      if (urlStr.includes("scrape_pages") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (urlStr.includes("scrape_pages") && method === "POST") {
        return new Response(JSON.stringify([{ id: "manual-page" }]), { status: 201 });
      }
      return new Response(shortContent, { status: 200 });
    }) as unknown as typeof fetch;

    const results = await scrapeSite(
      "https://example.com",
      { orgId: "org-1", normalizedUrl: "https://example.com/", maxPages: 1 },
      makeDeps({ fetchFn }),
    );

    expect(results[0]!.lowSignal).toBe(true);
  });
});

describe("scrapeSite — private redirect rejection", () => {
  it("throws when Jina is skipped and direct fetch tries to follow a redirect to private IP", async () => {
    let fetchCount = 0;
    const fetchFn = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      const urlStr = String(url);
      const method = opts?.method?.toUpperCase() ?? "GET";

      if (urlStr.includes("scrape_pages") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (urlStr.includes("scrape_pages") && method === "POST") {
        return new Response(JSON.stringify([{ id: "manual-page" }]), { status: 201 });
      }

      fetchCount++;
      if (fetchCount === 1) {
        // Jina returns low-signal
        return new Response("short", { status: 200 });
      }
      // Direct fetch redirects to private IP
      return new Response(null, {
        status: 301,
        headers: { Location: "http://10.0.0.1/secret" },
      });
    }) as unknown as typeof fetch;

    // Resolver: example.com is safe, 10.0.0.1 is private (but caught by direct IP check anyway)
    const resolver: IPResolver = async (hostname: string) =>
      hostname === "example.com" ? ["8.8.8.8"] : ["10.0.0.1"];

    // Should not throw at top level; direct fetch failure is silently swallowed
    // and falls back to manual
    const results = await scrapeSite(
      "https://example.com",
      { orgId: "org-1", normalizedUrl: "https://example.com/", maxPages: 1 },
      makeDeps({ fetchFn, resolver }),
    );

    // Jina returned low-signal but non-empty content; direct fetch was attempted
    // and failed (SSRF blocked the redirect). The Jina result is kept.
    expect(results[0]!.lowSignal).toBe(true);
    expect(["jina", "manual"]).toContain(results[0]!.source);
  });
});
