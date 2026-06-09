import { describe, it, expect } from "vitest";
import { mergeWorkflow } from "./merger.js";
import type { N8nWorkflow } from "./types.js";

const TEMPLATE: N8nWorkflow = {
  name: "Test Template",
  meta: { n8nVersion: "1.88.0" },
  nodes: [
    {
      id: "__NODE_ID_1__",
      name: "Trigger",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [240, 300],
      parameters: { path: "__WEBHOOK_PATH__", httpMethod: "POST" },
      webhookId: "__WEBHOOK_ID__",
    },
    {
      id: "__NODE_ID_2__",
      name: "Process",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [460, 300],
      parameters: { jsCode: "return [{ json: { url: '__TARGET_URL__' } }];" },
    },
  ],
  connections: {
    Trigger: { main: [[{ node: "Process", type: "main", index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: "v1" },
  staticData: null,
  pinData: {},
};

describe("mergeWorkflow", () => {
  it("replaces all placeholder strings with provided values", () => {
    const result = mergeWorkflow(TEMPLATE, {
      __WEBHOOK_PATH__: "my-hook",
      __TARGET_URL__: "https://example.com",
    });

    const trigger = result.nodes.find((n) => n.name === "Trigger")!;
    expect((trigger.parameters as Record<string, string>).path).toBe("my-hook");

    const process = result.nodes.find((n) => n.name === "Process")!;
    expect((process.parameters as Record<string, string>).jsCode).toContain("https://example.com");
  });

  it("assigns fresh UUID node IDs (not placeholders)", () => {
    const result = mergeWorkflow(TEMPLATE, {});
    for (const node of result.nodes) {
      expect(node.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it("assigns fresh UUID to webhookId", () => {
    const result = mergeWorkflow(TEMPLATE, {});
    const trigger = result.nodes.find((n) => n.name === "Trigger")!;
    expect(trigger.webhookId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("preserves node names and connections", () => {
    const result = mergeWorkflow(TEMPLATE, {});
    expect(result.nodes.map((n) => n.name)).toEqual(["Trigger", "Process"]);
    expect(result.connections["Trigger"]!.main[0]![0]!.node).toBe("Process");
  });

  it("sets active to false regardless of template", () => {
    const result = mergeWorkflow({ ...TEMPLATE, active: true }, {});
    expect(result.active).toBe(false);
  });

  it("repositions nodes starting at x=240 with 220px steps", () => {
    const result = mergeWorkflow(TEMPLATE, {});
    expect(result.nodes[0]!.position).toEqual([240, 300]);
    expect(result.nodes[1]!.position).toEqual([460, 300]);
  });

  it("leaves unmatched placeholders intact", () => {
    const result = mergeWorkflow(TEMPLATE, { __TARGET_URL__: "https://test.com" });
    const trigger = result.nodes.find((n) => n.name === "Trigger")!;
    expect((trigger.parameters as Record<string, string>).path).toBe("__WEBHOOK_PATH__");
  });
});
