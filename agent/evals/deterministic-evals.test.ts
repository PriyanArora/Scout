// Deterministic evals — no LLM calls, no network, no env vars required.
// Checks structural invariants on outputs that would never be caught by unit tests.

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG_IDS, assertValidToolIds } from "../src/utils/catalog.js";
import { validateWorkflow } from "../src/n8n/validator.js";
import { parseStructuredOutput } from "../src/utils/parser.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "../n8n_templates");
const FIXTURE_PATH = join(__dirname, "../fixtures/northbound-example.json");

// ─── 1. Tool Mapping Catalog Integrity ───────────────────────────────────────

describe("catalog integrity", () => {
  it("CATALOG_IDS contains at least 43 entries", () => {
    expect(CATALOG_IDS.size).toBeGreaterThanOrEqual(43);
  });

  it("all CATALOG_IDS are lowercase-kebab-case strings", () => {
    for (const id of CATALOG_IDS) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("assertValidToolIds passes for known IDs", () => {
    expect(() =>
      assertValidToolIds(["power-automate", "snowflake", "microsoft-teams"])
    ).not.toThrow();
  });

  it("assertValidToolIds throws for unknown IDs", () => {
    expect(() =>
      assertValidToolIds(["power-automate", "not-a-real-tool"])
    ).toThrow(/not-a-real-tool/);
  });

  it("assertValidToolIds throws for empty string IDs", () => {
    expect(() => assertValidToolIds([""])).toThrow();
  });
});

// ─── 2. n8n Template Importability ────────────────────────────────────────────

describe("n8n template importability", () => {
  const archetypes = [
    "scheduled-scrape-summarize-notify.json",
    "webhook-enrich-store.json",
    "form-to-crm.json",
    "inbound-email-triage.json",
    "rag-faq-skeleton.json",
  ];

  for (const filename of archetypes) {
    it(`${filename} has valid structure and required fields`, async () => {
      const raw = await readFile(join(TEMPLATES_DIR, filename), "utf-8");
      const workflow = JSON.parse(raw) as unknown;

      expect(workflow).toBeDefined();
      expect(typeof workflow).toBe("object");

      const w = workflow as Record<string, unknown>;

      // Required top-level fields
      expect(typeof w["name"]).toBe("string");
      expect(w["name"]).not.toBe("");
      expect(Array.isArray(w["nodes"])).toBe(true);
      expect((w["nodes"] as unknown[]).length).toBeGreaterThan(0);
      expect(typeof w["connections"]).toBe("object");

      // All templates must have at least one placeholder (they are parameterizable)
      const raw_str = raw;
      expect(raw_str).toMatch(/__[A-Z0-9_]+__/);
    });

    it(`${filename} nodes all have required fields`, async () => {
      const raw = await readFile(join(TEMPLATES_DIR, filename), "utf-8");
      const workflow = JSON.parse(raw) as Record<string, unknown>;
      const nodes = workflow["nodes"] as Array<Record<string, unknown>>;

      for (const node of nodes) {
        expect(typeof node["name"]).toBe("string");
        expect(typeof node["type"]).toBe("string");
        expect(typeof node["typeVersion"]).toBe("number");
        expect((node["typeVersion"] as number)).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(node["position"])).toBe(true);
        expect((node["position"] as unknown[]).length).toBe(2);
      }
    });

    it(`${filename} has no duplicate node names`, async () => {
      const raw = await readFile(join(TEMPLATES_DIR, filename), "utf-8");
      const workflow = JSON.parse(raw) as Record<string, unknown>;
      const nodes = workflow["nodes"] as Array<Record<string, unknown>>;
      const names = nodes.map((n) => n["name"] as string);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  }

  it("all template files in n8n_templates/ are known archetypes", async () => {
    const files = await readdir(TEMPLATES_DIR);
    // index.json is the generated offline template index (Wave 4 #16), not an archetype.
    const jsonFiles = files.filter((f) => f.endsWith(".json") && f !== "index.json");
    expect(jsonFiles.length).toBe(archetypes.length);
    for (const f of jsonFiles) {
      expect(archetypes).toContain(f);
    }
  });
});

// ─── 3. Structured-Output Parser ─────────────────────────────────────────────
// parseStructuredOutput throws StructuredOutputError on failure; callers catch and retry.

import { StructuredOutputError } from "../src/utils/parser.js";

describe("structured-output failure handling", () => {
  const schema = z.object({ name: z.string(), value: z.number() });

  it("parses clean JSON object", () => {
    const result = parseStructuredOutput('{"name":"test","value":42}', schema);
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("extracts JSON from markdown code fence", () => {
    const result = parseStructuredOutput(
      "```json\n{\"name\":\"test\",\"value\":42}\n```",
      schema
    );
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("extracts JSON from text with preamble", () => {
    const result = parseStructuredOutput(
      'Here is the result:\n{"name":"test","value":42}',
      schema
    );
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("throws NO_JSON for empty string", () => {
    expect(() => parseStructuredOutput("", schema)).toThrowError(StructuredOutputError);
    try {
      parseStructuredOutput("", schema);
    } catch (err) {
      expect((err as StructuredOutputError).code).toBe("NO_JSON");
    }
  });

  it("throws NO_JSON for plain prose with no JSON", () => {
    expect(() =>
      parseStructuredOutput("I cannot process this request.", schema)
    ).toThrowError(StructuredOutputError);
    try {
      parseStructuredOutput("I cannot process this request.", schema);
    } catch (err) {
      expect((err as StructuredOutputError).code).toBe("NO_JSON");
    }
  });

  it("throws VALIDATION_ERROR for JSON that does not match schema", () => {
    expect(() =>
      parseStructuredOutput('{"name":"test","value":"not-a-number"}', schema)
    ).toThrowError(StructuredOutputError);
    try {
      parseStructuredOutput('{"name":"test","value":"not-a-number"}', schema);
    } catch (err) {
      expect((err as StructuredOutputError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("parses JSON array with array schema", () => {
    const arraySchema = z.array(z.string());
    const result = parseStructuredOutput('["a","b","c"]', arraySchema);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

// ─── 4. Citation Mapping ─────────────────────────────────────────────────────

describe("evidence citation mapping", () => {
  it("fixture markdown contains all evidence citations from the mock report", async () => {
    const raw = await readFile(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { url: string; markdown: string };

    // These are the evidence citations produced by the mock LLM in fixture-runner.test.ts
    const expectedCitations = [
      "month-end close takes 12 days",
      "Regulatory change notifications arrive by email",
    ];

    for (const citation of expectedCitations) {
      expect(fixture.markdown.toLowerCase()).toContain(citation.toLowerCase());
    }
  });

  it("fixture markdown meets minimum content threshold", async () => {
    const raw = await readFile(FIXTURE_PATH, "utf-8");
    const fixture = JSON.parse(raw) as { url: string; markdown: string };

    const wordCount = fixture.markdown.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(200);
  });
});

// ─── 5. Merged Workflow Validation ────────────────────────────────────────────

describe("n8n validator on merged output", () => {
  it("validateWorkflow passes on a well-formed workflow", () => {
    const workflow = {
      name: "Test Workflow",
      nodes: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Start",
          type: "n8n-nodes-base.start",
          typeVersion: 1,
          position: [240, 300],
          parameters: {},
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4,
          position: [460, 300],
          parameters: { url: "https://example.com", method: "GET" },
        },
      ],
      connections: {
        Start: { main: [[{ node: "HTTP Request", type: "main", index: 0 }]] },
      },
      active: false,
      settings: {},
      staticData: null,
      pinData: {},
      meta: { instanceId: "test" },
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validateWorkflow rejects workflow with unresolved placeholder", () => {
    const workflow = {
      name: "Incomplete Workflow",
      nodes: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 2,
          position: [240, 300],
          parameters: { path: "__WEBHOOK_PATH__" },
        },
      ],
      connections: {},
      active: false,
      settings: {},
      staticData: null,
      pinData: {},
      meta: {},
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("__WEBHOOK_PATH__"))).toBe(true);
  });

  it("validateWorkflow rejects workflow with dangling connection", () => {
    const workflow = {
      name: "Bad Connections",
      nodes: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Start",
          type: "n8n-nodes-base.start",
          typeVersion: 1,
          position: [240, 300],
          parameters: {},
        },
      ],
      connections: {
        Start: { main: [[{ node: "NonExistentNode", type: "main", index: 0 }]] },
      },
      active: false,
      settings: {},
      staticData: null,
      pinData: {},
      meta: {},
    };

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("NonExistentNode"))).toBe(true);
  });
});

// ─── 6. No Client-Specific Credential Names in Templates ─────────────────────

describe("template credential hygiene", () => {
  const DISALLOWED_PATTERNS = [
    /northbound/i,
    /acme/i,
    /sk-[a-z0-9]{20,}/i,   // raw OpenAI key
    /Bearer [a-z0-9]{20,}/i,
  ];

  for (const filename of [
    "scheduled-scrape-summarize-notify.json",
    "webhook-enrich-store.json",
    "form-to-crm.json",
    "inbound-email-triage.json",
    "rag-faq-skeleton.json",
  ]) {
    it(`${filename} contains no client-specific credential names`, async () => {
      const raw = await readFile(join(TEMPLATES_DIR, filename), "utf-8");

      for (const pattern of DISALLOWED_PATTERNS) {
        expect(raw).not.toMatch(pattern);
      }
    });
  }
});
