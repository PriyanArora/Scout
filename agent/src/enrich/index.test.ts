import { describe, it, expect, vi } from "vitest";
import { enrichFromWikidata, isEnrichEnabled } from "./index.js";

const ON = { SCOUT_ENRICH_ENABLED: "1" };

describe("firmographic enrichment (flag-gated prototype)", () => {
  it("is off by default", () => {
    expect(isEnrichEnabled({})).toBe(false);
    expect(isEnrichEnabled({ SCOUT_ENRICH_ENABLED: "1" })).toBe(true);
  });

  it("returns null when disabled (no network call)", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const result = await enrichFromWikidata("Acme Corp", fetchFn, {});
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns cited firmographic fields from Wikidata when enabled", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          search: [
            {
              id: "Q312",
              label: "Apple Inc.",
              description: "American multinational technology company",
              concepturi: "http://www.wikidata.org/entity/Q312",
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await enrichFromWikidata("Apple", fetchFn, ON);
    expect(result).not.toBeNull();
    expect(result!.fields["legalName"]).toBe("Apple Inc.");
    expect(result!.citations[0]).toContain("Q312");
    expect(result!.source).toBe("wikidata");
  });

  it("returns null on no match", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ search: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await enrichFromWikidata("zzzznotacompany", fetchFn, ON)).toBeNull();
  });
});
