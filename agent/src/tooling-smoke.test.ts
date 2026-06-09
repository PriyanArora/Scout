import { describe, expect, it } from "vitest";
import { agentWorkspaceName } from "./tooling-smoke.js";

describe("agent workspace tooling", () => {
  it("exposes the workspace name", () => {
    expect(agentWorkspaceName).toBe("@scout/agent");
  });
});
