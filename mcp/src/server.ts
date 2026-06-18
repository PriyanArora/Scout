// Scout MCP server — pure data utilities only.
//
// Design (host-does-the-reasoning): the tools NEVER call an LLM. They fetch raw
// data (scrape a site, hand back the grounded catalog, read a stored report).
// Claude — the host, on the user's Claude Desktop subscription — does ALL the
// reasoning: profiling, opportunity discovery, scoring, tool mapping, workflow
// design, playbook writing. So there is no ANTHROPIC_API_KEY anywhere in this
// package; the only cost is the user's existing subscription tokens.
//
// The orchestration is steered by `instructions` below (surfaced to the model by
// MCP hosts) plus the per-tool descriptions.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { handleScrapeCompany } from "./tools/scrape-company.js";
import { handleGetReport } from "./tools/get-report.js";
import { handleGetCatalog, CATALOG_IDS } from "./catalog.js";

const INSTRUCTIONS = `Scout is NorthBound Advisory's AI discovery agent. These tools are pure data
utilities — they do no reasoning. YOU do all of it, using your own analysis.

When the user asks to "run discovery on <company-url>", orchestrate the full
Scout flow yourself:

1. scrape_company(url) — get the site as markdown. Scrape 1–3 high-value pages
   (home, about, services/products) if useful. If a result is flagged lowSignal,
   say so and work from what you have.
2. get_catalog() — load the 43 grounded NorthBound tools. You MUST map
   opportunities ONLY to ids from this catalog. Never invent tool ids.
3. Reason over the scraped text to produce a discovery report (schema below).

Produce a single JSON object matching Scout's report schema:

{
  "businessProfile": {
    "name", "industry", "size"?, "description",
    "primaryServices": string[], "technologyIndicators": string[],
    "marketPosition"?, "evidenceSnippets": string[]   // quote the scraped text
  },
  "opportunities": [{
    "id": string,                  // short kebab slug
    "title", "description",
    "pillar": one of
      "Customer Experience & Marketing" | "Cybersecurity & Risk" |
      "Operations & Efficiency" | "Data & Decision Intelligence",
    "impactScore": 1-5, "effortScore": 1-5,   // integers
    "confidenceScore": 0-1,
    "roiEstimate"?: string,
    "evidenceCitations": string[],            // ground each in scraped text
    "toolIds": string[],                      // ONLY catalog ids
    "quadrant": "quick-win" | "strategic" | "fill-in" | "thankless",
        // high impact + low effort = quick-win; high+high = strategic;
        // low+low = fill-in; low impact + high effort = thankless
    "priority": integer >= 1
  }],
  "topOpportunity": <the highest-priority opportunity object>,
  "requirements": {                            // for the top opportunity
    "opportunityId", "title", "businessObjective",
    "scopeIn": string[], "scopeOut": string[], "constraints": string[],
    "successCriteria": string[], "stakeholders": string[]
  },
  "solutionDesign": {                          // for the top opportunity
    "opportunityId", "architecture",
    "components": [{ "name", "role", "toolId"? }],   // toolId from catalog
    "integrationPoints": string[], "dataFlows": string[], "riskMitigations": string[]
  },
  "discoveryQuestions": string[],              // open questions for the client
  "playbook": string,                          // concise markdown implementation plan
  "lowSignal": boolean                         // true if scrape was weak
}

Rank opportunities by impact-over-effort; set priority 1 = best. Keep every
claim grounded in the scraped evidence — no hallucinated facts.

get_report(run_id) reads a previously stored report instead of re-discovering.`;

export function createScoutServer(): McpServer {
  const server = new McpServer(
    { name: "scout-mcp", version: "0.2.0" },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "scrape_company",
    {
      title: "Scrape company site",
      description:
        "Fetch a company web page as Markdown (keyless Jina Reader). Pure data — no analysis. Returns a small metadata header (title, lowSignal flag, char count) followed by the page text. Call this on the home/about/services pages, then YOU profile the business and identify opportunities from the text.",
      inputSchema: {
        url: z.string().url().describe("Company website URL to scrape (https)"),
      },
    },
    async ({ url }) => handleScrapeCompany({ url }),
  );

  server.registerTool(
    "get_catalog",
    {
      title: "Get NorthBound tool catalog",
      description:
        `Return NorthBound's 43 grounded tools as structured JSON (id, name, category, whatItDoes). Pure data — no analysis. When you map opportunities to tools, use ONLY ids from this catalog (e.g. ${CATALOG_IDS.slice(0, 4).join(", ")}, …). Never invent tool ids.`,
      inputSchema: {},
    },
    async () => handleGetCatalog(),
  );

  server.registerTool(
    "get_report",
    {
      title: "Get a stored discovery report",
      description:
        "Read a previously stored Scout discovery report by run_id (pure Supabase read, no analysis). Use this to inspect or build on a prior run instead of re-scraping. Requires Supabase read credentials.",
      inputSchema: {
        runId: z.string().describe("Scout run id of an existing report"),
      },
    },
    async ({ runId }) => handleGetReport({ runId }),
  );

  return server;
}
