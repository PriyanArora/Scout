import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PATTERNS, CONTROL_FLOWS, selectPattern } from "./data.js";
import { CATALOG_IDS } from "../utils/catalog.js";
import { NORTHBOUND_PILLARS } from "../prompts/system-prefix.js";

const ARCHETYPES = new Set([
  "rag-faq-skeleton",
  "form-to-crm",
  "inbound-email-triage",
  "webhook-enrich-store",
  "scheduled-scrape-summarize-notify",
]);

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

describe("patterns.yaml grounding", () => {
  it("every pattern references only canonical catalog tool ids", () => {
    for (const p of PATTERNS) {
      for (const id of p.catalogTools) {
        expect(CATALOG_IDS.has(id), `${p.id} references non-catalog tool ${id}`).toBe(true);
      }
    }
  });

  it("every pattern maps to a real shipped n8n archetype", () => {
    for (const p of PATTERNS) {
      expect(ARCHETYPES.has(p.n8nArchetype), `${p.id} -> ${p.n8nArchetype}`).toBe(true);
    }
  });

  it("every control_flow is a Workflow-Patterns primitive and pillars are canonical", () => {
    for (const p of PATTERNS) {
      expect(CONTROL_FLOWS).toContain(p.controlFlow);
      for (const pillar of p.pillars) {
        expect(NORTHBOUND_PILLARS as readonly string[]).toContain(pillar);
      }
    }
  });

  it("pattern ids match agent/patterns.yaml (no drift) and catalog refs in YAML are canonical", () => {
    const yaml = readFileSync(resolve(repoRoot, "agent/patterns.yaml"), "utf8");
    const yamlIds = [...yaml.matchAll(/^- id:\s*([a-z0-9-]+)/gm)].map((m) => m[1]!).sort();
    const tsIds = PATTERNS.map((p) => p.id).sort();
    expect(yamlIds).toEqual(tsIds);

    // Every id token in a `catalog_tools: [...]` line must be canonical.
    for (const m of yaml.matchAll(/catalog_tools:\s*\[([^\]]*)\]/g)) {
      for (const id of m[1]!.split(",").map((s) => s.trim()).filter(Boolean)) {
        expect(CATALOG_IDS.has(id), `YAML catalog_tools has non-catalog id ${id}`).toBe(true);
      }
    }
  });

  it("selectPattern classifies a clear opportunity deterministically", () => {
    const p = selectPattern({
      title: "Regulatory change alerting",
      description: "Monitor regulatory sources and alert the compliance team.",
      pillar: "Cybersecurity & Risk",
    });
    expect(p.id).toBe("compliance-watch");
  });
});
