import { describe, it, expect, vi, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createScoutServer } from "./server.js";

// Spin up the Scout MCP server and a client linked by an in-memory transport —
// a protocol-level round-trip over the pure-data tool surface.
async function connectClient(): Promise<Client> {
  const server = createScoutServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "scout-test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Scout MCP server (InMemoryTransport round-trip)", () => {
  it("lists exactly the three pure-data tools", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["get_catalog", "get_report", "scrape_company"]);
    const scrape = tools.find((t) => t.name === "scrape_company")!;
    expect(scrape.inputSchema.type).toBe("object");
    expect(scrape.inputSchema.properties).toHaveProperty("url");
  });

  it("get_catalog returns the 43 grounded tools (no network, no LLM)", async () => {
    const client = await connectClient();
    const res = await client.callTool({ name: "get_catalog", arguments: {} });
    const content = res.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text) as { count: number; tools: Array<{ id: string }> };
    expect(parsed.count).toBe(43);
    expect(parsed.tools.map((t) => t.id)).toContain("slack");
  });

  it("rejects input that violates the Zod input schema", async () => {
    const client = await connectClient();
    let threw = false;
    let result: Awaited<ReturnType<Client["callTool"]>> | undefined;
    try {
      result = await client.callTool({ name: "scrape_company", arguments: { url: "not-a-valid-url" } });
    } catch {
      threw = true;
    }
    expect(threw || result?.isError).toBeTruthy();
  });
});
