import { describe, it, expect, vi } from "vitest";
import { safeDirectFetch } from "./direct-fetch.js";
import type { IPResolver } from "../utils/url.js";

const PUBLIC_RESOLVER: IPResolver = async () => ["8.8.8.8"];

describe("safeDirectFetch — conditional requests (Wave 3 #12)", () => {
  it("sends If-None-Match / If-Modified-Since when given validators and reports 304 as notModified", async () => {
    let sentHeaders: Record<string, string> = {};
    const fetchFn = vi.fn().mockImplementation(async (_url: string, opts?: RequestInit) => {
      sentHeaders = (opts?.headers ?? {}) as Record<string, string>;
      return new Response(null, { status: 304 });
    }) as unknown as typeof fetch;

    const result = await safeDirectFetch(
      "https://example.com/",
      PUBLIC_RESOLVER,
      fetchFn,
      { etag: '"abc123"', lastModified: "Wed, 01 Jan 2026 00:00:00 GMT" },
    );

    expect(sentHeaders["If-None-Match"]).toBe('"abc123"');
    expect(sentHeaders["If-Modified-Since"]).toBe("Wed, 01 Jan 2026 00:00:00 GMT");
    expect(result.notModified).toBe(true);
    expect(result.markdown).toBe("");
  });

  it("captures ETag / Last-Modified from a 200 response for later revalidation", async () => {
    const fetchFn = vi.fn().mockImplementation(async () =>
      new Response("<html><body><main><p>" + "x".repeat(600) + "</p></main></body></html>", {
        status: 200,
        headers: { ETag: '"v2"', "Last-Modified": "Thu, 02 Jan 2026 00:00:00 GMT" },
      }),
    ) as unknown as typeof fetch;

    const result = await safeDirectFetch("https://example.com/", PUBLIC_RESOLVER, fetchFn);
    expect(result.etag).toBe('"v2"');
    expect(result.lastModified).toBe("Thu, 02 Jan 2026 00:00:00 GMT");
    expect(result.notModified).toBeFalsy();
  });
});
