#!/usr/bin/env node
// Scout MCP Server — stdio transport
// Exposes Scout agent tools to Claude Code and other MCP clients.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { handleRunDiscovery } from "./tools/run-discovery.js";
import { handleScrapeCompany } from "./tools/scrape-company.js";
import { handleMapTools } from "./tools/map-tools.js";
import { handleGenerateWorkflow } from "./tools/generate-workflow.js";
import { handleWritePlaybook } from "./tools/write-playbook.js";

const server = new Server(
  { name: "scout-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_discovery",
      description:
        "Run a full Scout discovery pipeline for a company URL. Returns a run_id. Use get_run_status to poll for completion, then get_report to retrieve the full report.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "Company website URL (must be HTTPS)" },
          notes: { type: "string", description: "Optional context or notes about this company" },
        },
        required: ["url"],
      },
    },
    {
      name: "scrape_company",
      description:
        "Scrape and extract content from a company website using Jina Reader. Returns markdown content.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: { type: "string", description: "Company website URL to scrape" },
        },
        required: ["url"],
      },
    },
    {
      name: "map_tools",
      description:
        "Map a list of opportunities to NorthBound's grounded tool catalog (43 tools). Returns tool IDs per opportunity.",
      inputSchema: {
        type: "object" as const,
        properties: {
          opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                pillar: { type: "string" },
              },
              required: ["id", "title", "pillar"],
            },
            description: "Array of opportunities to map to tools",
          },
        },
        required: ["opportunities"],
      },
    },
    {
      name: "generate_n8n_workflow",
      description:
        "Select the best n8n archetype for an opportunity and generate a configured workflow template.",
      inputSchema: {
        type: "object" as const,
        properties: {
          opportunity: {
            type: "object",
            description: "Opportunity object with id, title, description, pillar, quadrant",
          },
          toolIds: {
            type: "array",
            items: { type: "string" },
            description: "Catalog tool IDs mapped to this opportunity",
          },
        },
        required: ["opportunity", "toolIds"],
      },
    },
    {
      name: "write_playbook",
      description:
        "Generate an implementation playbook for the top opportunity from a discovery run.",
      inputSchema: {
        type: "object" as const,
        properties: {
          runId: {
            type: "string",
            description: "Scout run ID to generate a playbook for",
          },
        },
        required: ["runId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "run_discovery":
      return handleRunDiscovery(args as { url: string; notes?: string });
    case "scrape_company":
      return handleScrapeCompany(args as { url: string });
    case "map_tools":
      return handleMapTools(args as { opportunities: Array<{ id: string; title: string; pillar: string }> });
    case "generate_n8n_workflow":
      return handleGenerateWorkflow(
        args as { opportunity: Record<string, unknown>; toolIds: string[] },
      );
    case "write_playbook":
      return handleWritePlaybook(args as { runId: string });
    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Scout MCP fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
