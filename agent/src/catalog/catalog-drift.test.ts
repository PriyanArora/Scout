import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG_TOOLS } from "./data.js";

// Single-source-of-truth enforcement (INTEGRATION_PLAN §3 Wave 2 #8 / Decision
// Log Area E). The catalog identity is mirrored across five heterogeneous
// runtimes that cannot share one import — the canonical TS source (data.ts), the
// human-authored YAML, the SQL seed, the standalone Deno Edge function, and the
// separate MCP package. This test fails the moment any mirror drifts.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

const canonical = CATALOG_TOOLS.map((t) => t.id).sort();

function matchAll(re: RegExp, text: string): string[] {
  return [...text.matchAll(re)].map((m) => m[1]!);
}

function idsInArrayLiteral(source: string, varName: string): string[] {
  const block = new RegExp(`${varName}\\s*=\\s*\\[([\\s\\S]*?)\\]`).exec(source);
  if (!block) throw new Error(`${varName} array literal not found`);
  return matchAll(/"([a-z0-9-]+)"/g, block[1]!).sort();
}

describe("catalog single source (no drift across representations)", () => {
  it("canonical data.ts holds the 43 grounded tools, unique", () => {
    expect(canonical.length).toBe(43);
    expect(new Set(canonical).size).toBe(43);
  });

  it("agent/catalog.yaml ids match the canonical source", () => {
    const ids = matchAll(/^\s*- id:\s*([a-z0-9-]+)/gm, read("agent/catalog.yaml")).sort();
    expect(ids).toEqual(canonical);
  });

  it("supabase seed ids match the canonical source", () => {
    const ids = matchAll(/^\(\s*'([a-z0-9-]+)'/gm, read("supabase/seed/001_catalog.sql")).sort();
    expect(ids).toEqual(canonical);
  });

  it("Edge function CATALOG_IDS and CATALOG_BLOCK match the canonical source", () => {
    const edge = read("supabase/functions/agent/index.ts");
    expect(idsInArrayLiteral(edge, "CATALOG_IDS")).toEqual(canonical);
    // First block entry shares the line with the opening backtick, so anchor on
    // line-start OR a preceding backtick.
    const blockIds = matchAll(/(?:^|`)- ([a-z0-9-]+) \(/gm, edge).sort();
    expect(blockIds).toEqual(canonical);
  });

  it("MCP catalog ids match the canonical source", () => {
    // mcp/src/catalog.ts mirrors data.ts as an array of object literals; pull the
    // `id:` field from each entry.
    const src = read("mcp/src/catalog.ts");
    const block = /CATALOG_TOOLS[\s\S]*?=\s*\[([\s\S]*?)\];/.exec(src);
    if (!block) throw new Error("CATALOG_TOOLS array literal not found in mcp/src/catalog.ts");
    const ids = matchAll(/id:\s*"([a-z0-9-]+)"/g, block[1]!).sort();
    expect(ids).toEqual(canonical);
  });
});
