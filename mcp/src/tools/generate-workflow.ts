interface GenerateWorkflowArgs {
  opportunity: Record<string, unknown>;
  toolIds: string[];
}

const ARCHETYPES = [
  { id: "rag-faq-skeleton", signals: /knowledge|faq|search|answer|document/ },
  { id: "form-to-crm", signals: /lead|contact|crm|form|intake|onboard/ },
  { id: "inbound-email-triage", signals: /email|triage|inbox|ticket|support/ },
  { id: "webhook-enrich-store", signals: /integration|connect|ingest|event|trigger/ },
  { id: "scheduled-scrape-summarize-notify", signals: /monitor|track|alert|report|competitive/ },
];

export async function handleGenerateWorkflow(args: GenerateWorkflowArgs) {
  const { opportunity, toolIds } = args;
  const oppStr = JSON.stringify(opportunity).toLowerCase();

  const archetype = ARCHETYPES.find((a) => a.signals.test(oppStr))?.id ?? "webhook-enrich-store";

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ archetype, placeholders: {}, note: "ANTHROPIC_API_KEY not set — placeholder map not generated" }) }],
    };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: "You are an n8n workflow configuration expert. Return ONLY a JSON object mapping __PLACEHOLDER__ strings to their values. Skip __NODE_ID_N__ and __WEBHOOK_ID__.",
      messages: [{
        role: "user",
        content: `Archetype: ${archetype}\nOpportunity: ${JSON.stringify(opportunity).slice(0, 500)}\nTool IDs: ${toolIds.join(", ")}\n\nReturn placeholder map JSON:`,
      }],
    }),
  });

  const msg = await res.json() as { content: Array<{ type: string; text?: string }> };
  const text = msg.content.find((b) => b.type === "text")?.text ?? "{}";

  let placeholders: Record<string, string> = {};
  try { placeholders = JSON.parse(text) as Record<string, string>; } catch { /* ignore */ }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ archetype, placeholders, importInstructions: `Import agent/n8n_templates/${archetype}.json into n8n and apply the placeholder map above.` }, null, 2),
    }],
  };
}
