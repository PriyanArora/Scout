import { describe, expect, it } from "vitest";
import { webWorkspaceName } from "./tooling-smoke.js";

describe("web workspace tooling", () => {
  it("exposes the workspace name", () => {
    expect(webWorkspaceName).toBe("@scout/web");
  });
});
