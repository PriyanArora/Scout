import { describe, it, expect, vi, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createScoutServer } from "./server.js";

// Spin up the Scout MCP server and a client linked by an in-memory transport —
// the protocol-level round-trip test Scout previously lacked (Wave 2 #9).
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
  it("lists all five tools with Zod-derived input schemas", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "generate_n8n_workflow",
      "map_tools",
      "run_discovery",
      "scrape_company",
      "write_playbook",
    ]);
    const run = tools.find((t) => t.name === "run_discovery")!;
    expect(run.inputSchema.type).toBe("object");
    expect(run.inputSchema.properties).toHaveProperty("url");
  });

  it("calls map_tools end-to-end and filters non-catalog ids", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            { type: "text", text: JSON.stringify([{ opportunityId: "o1", toolIds: ["slack", "made-up"] }]) },
          ],
        }),
      }),
    );

    const client = await connectClient();
    const res = await client.callTool({
      name: "map_tools",
      arguments: { opportunities: [{ id: "o1", title: "Triage", pillar: "Operations & Efficiency" }] },
    });

    const content = res.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0]!.text) as Array<{ toolIds: string[] }>;
    expect(parsed[0]!.toolIds).toContain("slack");
    expect(parsed[0]!.toolIds).not.toContain("made-up");
  });

  it("rejects input that violates the Zod input schema", async () => {
    const client = await connectClient();
    let threw = false;
    let result: Awaited<ReturnType<Client["callTool"]>> | undefined;
    try {
      result = await client.callTool({ name: "run_discovery", arguments: { url: "not-a-valid-url" } });
    } catch {
      threw = true;
    }
    expect(threw || result?.isError).toBeTruthy();
  });
});
