// Offline n8n template-index adapter (INTEGRATION_PLAN §3 Wave 4 #16). Reads the
// committed agent/n8n_templates/index.json — the runtime NEVER calls api.n8n.io.
// Lookup is by (archetype, trigger, tools); falls back to the pinned archetypes.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ArchetypeId } from "./types.js";

export interface TemplateIndexEntry {
  id: string;
  archetype: ArchetypeId;
  name: string;
  trigger: string;
  catalogTools: string[];
  nodeCount: number;
  provenance: string;
}

interface TemplateIndex {
  generatedAt: string;
  provenance: Record<string, string>;
  templates: TemplateIndexEntry[];
}

let cached: TemplateIndex | null = null;

function load(): TemplateIndex {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "../../n8n_templates/index.json");
  cached = JSON.parse(readFileSync(path, "utf8")) as TemplateIndex;
  return cached;
}

export function listTemplates(): TemplateIndexEntry[] {
  return load().templates;
}

export interface TemplateQuery {
  archetype?: ArchetypeId;
  trigger?: string;
  tools?: string[];
}

// Score each indexed template against the query and return the best match, or null.
export function lookupTemplate(query: TemplateQuery): TemplateIndexEntry | null {
  const templates = load().templates;
  if (templates.length === 0) return null;
  const toolSet = new Set(query.tools ?? []);

  let best: TemplateIndexEntry | null = null;
  let bestScore = -1;
  for (const t of templates) {
    let score = 0;
    if (query.archetype && t.archetype === query.archetype) score += 5;
    if (query.trigger && t.trigger === query.trigger) score += 2;
    for (const tool of t.catalogTools) if (toolSet.has(tool)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore > 0 ? best : null;
}
