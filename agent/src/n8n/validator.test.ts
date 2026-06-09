import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./validator.js";
import type { N8nWorkflow } from "./types.js";

function makeNode(overrides: Partial<N8nWorkflow["nodes"][0]> = {}): N8nWorkflow["nodes"][0] {
  return {
    id: "abc123",
    name: "Test Node",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4,
    position: [240, 300],
    parameters: { url: "https://example.com" },
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<N8nWorkflow> = {}): N8nWorkflow {
  return {
    name: "Test Workflow",
    meta: { n8nVersion: "1.88.0" },
    nodes: [makeNode()],
    connections: {},
    active: false,
    settings: { executionOrder: "v1" },
    staticData: null,
    pinData: {},
    ...overrides,
  };
}

describe("validateWorkflow", () => {
  it("passes a valid minimal workflow", () => {
    const result = validateWorkflow(makeWorkflow());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when workflow is null", () => {
    const result = validateWorkflow(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not an object/);
  });

  it("fails when name is empty", () => {
    const result = validateWorkflow(makeWorkflow({ name: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("fails when nodes is empty", () => {
    const result = validateWorkflow(makeWorkflow({ nodes: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("nodes"))).toBe(true);
  });

  it("fails when node id is a placeholder", () => {
    const result = validateWorkflow(
      makeWorkflow({ nodes: [makeNode({ id: "__NODE_ID_1__" })] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("placeholder"))).toBe(true);
  });

  it("fails when duplicate node names exist", () => {
    const result = validateWorkflow(
      makeWorkflow({
        nodes: [makeNode({ id: "a1" }), makeNode({ id: "a2" })],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("fails when connection references a missing node", () => {
    const result = validateWorkflow(
      makeWorkflow({
        connections: {
          "Test Node": { main: [[{ node: "Nonexistent", type: "main", index: 0 }]] },
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Nonexistent"))).toBe(true);
  });

  it("fails when parameter contains an unresolved placeholder", () => {
    const result = validateWorkflow(
      makeWorkflow({
        nodes: [makeNode({ parameters: { url: "__TARGET_URL__" } })],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("__TARGET_URL__"))).toBe(true);
  });

  it("passes when all connections reference valid nodes", () => {
    const nodeA = makeNode({ id: "a1", name: "Node A" });
    const nodeB = makeNode({ id: "b1", name: "Node B" });
    const result = validateWorkflow(
      makeWorkflow({
        nodes: [nodeA, nodeB],
        connections: {
          "Node A": { main: [[{ node: "Node B", type: "main", index: 0 }]] },
        },
      }),
    );
    expect(result.valid).toBe(true);
  });
});
