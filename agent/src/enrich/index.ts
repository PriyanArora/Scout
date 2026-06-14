// Flag-gated, keyless firmographic enrichment — PROTOTYPE (INTEGRATION_PLAN §3
// Wave 3 #13 / Decision Log Track 1). Default OFF via SCOUT_ENRICH_ENABLED so the
// keyless $0 core path is unchanged. Uses only keyless CC0/public-domain sources;
// Wikidata is implemented here. GLEIF (api.gleif.org) and SEC EDGAR (data.sec.gov,
// needs SCOUT_EDGAR_USER_AGENT) are documented extension points behind the same flag.
//
// Grounding: every returned field carries a source citation, so an enriched
// business_profile stays as grounded as the scraped one. Enrichment is meant to be
// summarized by a single cheap Haiku call downstream (not Opus), keeping tokens low.

export interface EnrichedFirmographics {
  fields: Record<string, string>;
  citations: string[];
  source: "wikidata";
}

export function isEnrichEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env["SCOUT_ENRICH_ENABLED"];
  return v === "1" || v === "true";
}

interface WikidataSearchHit {
  id: string;
  label?: string;
  description?: string;
  concepturi?: string;
}

// Resolve a company name to its top Wikidata entity and return cited firmographic
// fields. Returns null when enrichment is disabled or no confident match exists.
export async function enrichFromWikidata(
  name: string,
  fetchFn: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<EnrichedFirmographics | null> {
  if (!isEnrichEnabled(env)) return null;
  const q = name.trim();
  if (!q) return null;

  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", q);
  url.searchParams.set("language", "en");
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "1");
  url.searchParams.set("format", "json");

  let res: Response;
  try {
    res = await fetchFn(url.toString(), { headers: { Accept: "application/json" } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json()) as { search?: WikidataSearchHit[] };
  const hit = body.search?.[0];
  if (!hit) return null;

  const citation = hit.concepturi ?? `https://www.wikidata.org/wiki/${hit.id}`;
  const fields: Record<string, string> = {};
  if (hit.label) fields["legalName"] = hit.label;
  if (hit.description) fields["wikidataDescription"] = hit.description;
  if (Object.keys(fields).length === 0) return null;

  return { fields, citations: [citation], source: "wikidata" };
}
