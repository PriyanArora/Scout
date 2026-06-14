#!/usr/bin/env node
// Scout MCP Server — stdio transport entry point.
// Exposes Scout agent tools to Claude Code and other MCP clients.
// Tool registration lives in server.ts (createScoutServer) so it can be
// exercised by the InMemoryTransport round-trip test.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createScoutServer } from "./server.js";

async function main() {
  const server = createScoutServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Scout MCP fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
