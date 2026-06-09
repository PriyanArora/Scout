import { describe, expect, it } from "vitest";
import { mcpWorkspaceName } from "./tooling-smoke.js";

describe("mcp workspace tooling", () => {
  it("exposes the workspace name", () => {
    expect(mcpWorkspaceName).toBe("@scout/mcp");
  });
});
