import { describe, it, expect } from "vitest";
import { isLeaseExpired, isStaleWrite, buildAcquireLeaseParams } from "./lease.js";

const NOW = 1_700_000_000_000;

describe("isLeaseExpired", () => {
  it("returns true when lease_until is null", () => {
    expect(isLeaseExpired({ lease_until: null, node_execution_id: null, locked_by: null }, NOW)).toBe(true);
  });

  it("returns true when lease_until is in the past", () => {
    const past = new Date(NOW - 1000).toISOString();
    expect(isLeaseExpired({ lease_until: past, node_execution_id: "x", locked_by: "y" }, NOW)).toBe(true);
  });

  it("returns false when lease_until is in the future", () => {
    const future = new Date(NOW + 60_000).toISOString();
    expect(isLeaseExpired({ lease_until: future, node_execution_id: "x", locked_by: "y" }, NOW)).toBe(false);
  });
});

describe("isStaleWrite", () => {
  it("returns false when node_execution_id matches", () => {
    expect(isStaleWrite({ node_execution_id: "abc", lease_until: null, locked_by: null }, "abc")).toBe(false);
  });

  it("returns true when node_execution_id differs", () => {
    expect(isStaleWrite({ node_execution_id: "abc", lease_until: null, locked_by: null }, "xyz")).toBe(true);
  });

  it("returns true when node_execution_id is null", () => {
    expect(isStaleWrite({ node_execution_id: null, lease_until: null, locked_by: null }, "xyz")).toBe(true);
  });
});

describe("buildAcquireLeaseParams", () => {
  it("returns correct RPC parameter shape", () => {
    const params = buildAcquireLeaseParams("run-1", "edge-1", "exec-1", 90);
    expect(params).toEqual({
      p_run_id: "run-1",
      p_locked_by: "edge-1",
      p_node_execution_id: "exec-1",
      p_lease_seconds: 90,
    });
  });

  it("defaults lease to 120 seconds", () => {
    const params = buildAcquireLeaseParams("run-1", "edge-1", "exec-1");
    expect(params.p_lease_seconds).toBe(120);
  });
});
