// Scout MCP remote endpoint — Streamable HTTP transport for Claude.ai web connector.
// Stateless: one transport + server instance per request; no session state.
// Auth: Bearer token via SCOUT_WEBHOOK_SECRET (set in Vercel env + Claude.ai connector config).

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createScoutServer } from "@scout/mcp";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(req: Request): Promise<Response> {
  const secret = process.env.SCOUT_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — new instance per request
  });
  const server = createScoutServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
