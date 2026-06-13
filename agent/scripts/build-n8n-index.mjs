#!/usr/bin/env node
// Offline n8n template-index build (INTEGRATION_PLAN §3 Wave 4 #16).
//
// Produces agent/n8n_templates/index.json from the bundled archetype templates so
// the runtime looks up templates locally and NEVER calls api.n8n.io. Only the
// templates Scout actually ships are bundled; the full official-API + Zie619
// corpus build is a separate offline step (documented in docs/RUNBOOK.md) and is
// filtered to the catalog-mappable SaaS subset. Re-run: `node agent/scripts/build-n8n-index.mjs`.
//
// Provenance/licensing: the 5 archetypes are Scout-authored (this repo, MIT-aligned).
// Any community templates added to the corpus must carry per-author attribution and
// honor n8n's Sustainable Use License (deliverable use OK; not a paid n8n-as-SaaS).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, "../n8n_templates");

// n8n node type → canonical catalog id (SaaS-mappable subset; Power Platform stays
// a report recommendation, not an n8n artifact — deepdive §4.3).
const NODE_TO_CATALOG = [
  [/slack/i, "slack"],
  [/microsoftTeams|teams/i, "microsoft-teams"],
  [/hubspot/i, "hubspot"],
  [/salesforce/i, "salesforce"],
  [/notion/i, "notion"],
  [/airtable/i, "airtable"],
  [/postgres/i, "postgres"],
  [/supabase/i, "supabase"],
  [/jira/i, "jira"],
  [/github/i, "github"],
  [/zendesk/i, "zendesk"],
  [/intercom/i, "intercom"],
  [/openAi|anthropic|\.ai\.|langchain/i, "claude-api"],
];

function deriveTools(nodes) {
  const tools = new Set();
  for (const n of nodes) {
    for (const [re, id] of NODE_TO_CATALOG) {
      if (re.test(n.type)) tools.add(id);
    }
  }
  tools.add("n8n"); // every shipped workflow is an n8n artifact
  return [...tools].sort();
}

function deriveTrigger(nodes) {
  const t = nodes.find((n) => /trigger|webhook/i.test(n.type));
  return t ? t.type : (nodes[0]?.type ?? "unknown");
}

const files = readdirSync(templatesDir).filter((f) => f.endsWith(".json") && f !== "index.json");
const templates = files
  .map((f) => {
    const wf = JSON.parse(readFileSync(join(templatesDir, f), "utf8"));
    const archetype = f.replace(/\.json$/, "");
    return {
      id: archetype,
      archetype,
      name: wf.name ?? archetype,
      trigger: deriveTrigger(wf.nodes ?? []),
      catalogTools: deriveTools(wf.nodes ?? []),
      nodeCount: (wf.nodes ?? []).length,
      typeVersion: wf.meta?.n8nVersion ?? null,
      provenance: "scout-authored",
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const index = {
  generatedAt: new Date().toISOString().slice(0, 10),
  provenance: {
    shipped: "Scout-authored archetypes (this repo).",
    corpusBuild:
      "Full corpus (official api.n8n.io + Zie619/n8n-workflows) is an offline step filtered to the catalog-mappable SaaS subset; only shipped templates are bundled. See docs/RUNBOOK.md.",
    licensing: "n8n Sustainable Use License for any bundled community templates; attribute authors per-template.",
  },
  templates,
};

writeFileSync(join(templatesDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`[build-n8n-index] wrote ${templates.length} templates to n8n_templates/index.json`);
