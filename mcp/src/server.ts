// Scout MCP server factory — McpServer + registerTool (Zod input schemas).
// Modernized from the low-level Server + setRequestHandler + hand-written JSON
// Schema (INTEGRATION_PLAN §3 Wave 2 #9 / Decision Log Area F). Stays on SDK 1.x.
// Split from index.ts so the InMemoryTransport round-trip test can build the
// server without spawning a stdio transport.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { handleRunDiscovery } from "./tools/run-discovery.js";
import { handleScrapeCompany } from "./tools/scrape-company.js";
import { handleMapTools } from "./tools/map-tools.js";
import { handleGenerateWorkflow } from "./tools/generate-workflow.js";
import { handleWritePlaybook } from "./tools/write-playbook.js";

export function createScoutServer(): McpServer {
  const server = new McpServer({ name: "scout-mcp", version: "0.1.0" });

  server.registerTool(
    "run_discovery",
    {
      title: "Run Scout discovery",
      description:
        "Run a full Scout discovery pipeline for a company URL. Returns a run_id; poll the run page for completion, then use the report.",
      inputSchema: {
        url: z.string().url().describe("Company website URL (must be HTTPS)"),
        notes: z.string().optional().describe("Optional context or notes about this company"),
      },
    },
    async ({ url, notes }) => handleRunDiscovery(notes === undefined ? { url } : { url, notes }),
  );

  server.registerTool(
    "scrape_company",
    {
      title: "Scrape company site",
      description:
        "Scrape and extract content from a company website using Jina Reader. Returns markdown content.",
      inputSchema: {
        url: z.string().url().describe("Company website URL to scrape"),
      },
    },
    async ({ url }) => handleScrapeCompany({ url }),
  );

  server.registerTool(
    "map_tools",
    {
      title: "Map opportunities to catalog tools",
      description:
        "Map a list of opportunities to NorthBound's grounded tool catalog (43 tools). Returns catalog tool ids per opportunity (non-catalog ids are filtered out).",
      inputSchema: {
        opportunities: z
          .array(
            z.object({
              id: z.string(),
              title: z.string(),
              pillar: z.string(),
            }),
          )
          .describe("Array of opportunities to map to tools"),
      },
    },
    async ({ opportunities }) => handleMapTools({ opportunities }),
  );

  server.registerTool(
    "generate_n8n_workflow",
    {
      title: "Generate n8n workflow",
      description:
        "Select the best n8n archetype for an opportunity and generate a configured workflow template.",
      inputSchema: {
        opportunity: z
          .record(z.string(), z.unknown())
          .describe("Opportunity object with id, title, description, pillar, quadrant"),
        toolIds: z.array(z.string()).describe("Catalog tool ids mapped to this opportunity"),
      },
    },
    async ({ opportunity, toolIds }) => handleGenerateWorkflow({ opportunity, toolIds }),
  );

  server.registerTool(
    "write_playbook",
    {
      title: "Write implementation playbook",
      description:
        "Generate (or fetch) an implementation playbook for the top opportunity from a discovery run.",
      inputSchema: {
        runId: z.string().describe("Scout run id to generate a playbook for"),
      },
    },
    async ({ runId }) => handleWritePlaybook({ runId }),
  );

  return server;
}
