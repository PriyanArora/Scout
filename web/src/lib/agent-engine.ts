// Adapter that lets the Next.js (Node runtime) routes drive the shared Scout
// engine. The engine's n8n generator reads its 5 pinned archetypes from disk via
// `fs`, which doesn't survive bundling — so we register a loader backed by the
// JSON templates imported as modules (webpack inlines them). Same engine, same
// templates, no filesystem at runtime.

import {
  setTemplateLoader,
  createAnthropicDeps,
  type ArchetypeId,
} from "@scout/agent";

import scheduled from "@scout/agent/n8n_templates/scheduled-scrape-summarize-notify.json";
import webhookEnrich from "@scout/agent/n8n_templates/webhook-enrich-store.json";
import formToCrm from "@scout/agent/n8n_templates/form-to-crm.json";
import inboundEmail from "@scout/agent/n8n_templates/inbound-email-triage.json";
import ragFaq from "@scout/agent/n8n_templates/rag-faq-skeleton.json";

const TEMPLATES: Record<ArchetypeId, unknown> = {
  "scheduled-scrape-summarize-notify": scheduled,
  "webhook-enrich-store": webhookEnrich,
  "form-to-crm": formToCrm,
  "inbound-email-triage": inboundEmail,
  "rag-faq-skeleton": ragFaq,
};

let registered = false;
function ensureTemplateLoader(): void {
  if (registered) return;
  setTemplateLoader((id) => JSON.stringify(TEMPLATES[id]));
  registered = true;
}

/** Build LLM deps from the server env, registering the n8n loader on first use. */
export function getEngineDeps() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on the server");
  ensureTemplateLoader();
  return createAnthropicDeps(key);
}

export * from "@scout/agent";
