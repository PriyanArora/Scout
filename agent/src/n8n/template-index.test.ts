import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listTemplates, lookupTemplate } from "./template-index.js";
import { CATALOG_IDS } from "../utils/catalog.js";

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, "../../n8n_templates");

describe("offline n8n template index", () => {
  it("has one entry per shipped archetype template (no drift)", () => {
    const files = readdirSync(templatesDir)
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
    const indexed = listTemplates().map((t) => t.id).sort();
    expect(indexed).toEqual(files);
  });

  it("every indexed template's tools are canonical catalog ids (grounding)", () => {
    for (const t of listTemplates()) {
      for (const id of t.catalogTools) {
        expect(CATALOG_IDS.has(id), `${t.id} -> ${id}`).toBe(true);
      }
    }
  });

  it("looks up a template by archetype", () => {
    const t = lookupTemplate({ archetype: "form-to-crm" });
    expect(t?.archetype).toBe("form-to-crm");
  });

  it("returns null when nothing scores", () => {
    expect(lookupTemplate({ tools: ["definitely-not-a-tool"] })).toBeNull();
  });
});
