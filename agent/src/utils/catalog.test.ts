import { describe, it, expect } from "vitest";
import { assertValidToolIds, filterValidToolIds, CatalogValidationError, CATALOG_IDS } from "./catalog.js";

const MOCK_IDS = new Set(["tool-a", "tool-b", "tool-c"]);

describe("assertValidToolIds", () => {
  it("passes when all IDs are in the catalog", () => {
    expect(() => assertValidToolIds(["tool-a", "tool-b"], MOCK_IDS)).not.toThrow();
  });

  it("passes for an empty list", () => {
    expect(() => assertValidToolIds([], MOCK_IDS)).not.toThrow();
  });

  it("throws when an ID is not in the catalog", () => {
    expect(() => assertValidToolIds(["tool-a", "unknown-tool"], MOCK_IDS)).toThrow(CatalogValidationError);
  });

  it("includes all invalid IDs in the error", () => {
    try {
      assertValidToolIds(["bad-1", "tool-a", "bad-2"], MOCK_IDS);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CatalogValidationError);
      expect((err as CatalogValidationError).invalidIds).toEqual(["bad-1", "bad-2"]);
    }
  });
});

describe("filterValidToolIds", () => {
  it("returns only IDs present in the catalog", () => {
    expect(filterValidToolIds(["tool-a", "ghost", "tool-c"], MOCK_IDS)).toEqual(["tool-a", "tool-c"]);
  });

  it("returns empty array when none match", () => {
    expect(filterValidToolIds(["ghost-1", "ghost-2"], MOCK_IDS)).toEqual([]);
  });
});

describe("CATALOG_IDS", () => {
  it("contains 43 tools matching the seeded catalog", () => {
    expect(CATALOG_IDS.size).toBe(43);
  });

  it("contains NorthBound core tools", () => {
    expect(CATALOG_IDS.has("microsoft-365-copilot")).toBe(true);
    expect(CATALOG_IDS.has("power-automate")).toBe(true);
    expect(CATALOG_IDS.has("snowflake")).toBe(true);
    expect(CATALOG_IDS.has("n8n")).toBe(true);
  });
});
