const CATALOG_IDS = [
  "ms-365","ms-azure-openai","ms-copilot-studio","ms-copilot","ms-teams",
  "ms-sharepoint","ms-onedrive","ms-exchange","ms-outlook","ms-power-apps",
  "ms-power-automate","power-automate","ms-power-bi","ms-power-pages",
  "ms-dynamics-crm","ms-dynamics-365","ms-azure-ai-search","ms-purview",
  "ms-sentinel","ms-defender","ms-entra","ms-intune","microsoft-365-copilot",
  "snowflake","n8n","zapier","make","slack","sendgrid","hubspot","salesforce",
  "zendesk","twilio","stripe","aws-bedrock","google-vertex-ai","openai",
  "anthropic","firecrawl","jina-reader","notion","airtable","monday",
] as const;

interface Opportunity {
  id: string;
  title: string;
  pillar: string;
}

interface MapToolsArgs {
  opportunities: Opportunity[];
}

export async function handleMapTools(args: MapToolsArgs) {
  const { opportunities } = args;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return {
      content: [{ type: "text" as const, text: "ANTHROPIC_API_KEY not configured" }],
      isError: true,
    };
  }

  const oppSummary = opportunities.map((o) => `- ${o.id}: ${o.title} (${o.pillar})`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `You are a solutions architect. For each opportunity select 1–3 tool IDs from the NorthBound catalog.
Catalog: ${CATALOG_IDS.join(", ")}
Output ONLY a JSON array: [{"opportunityId":string,"toolIds":string[]}]`,
      messages: [{ role: "user", content: `Opportunities:\n${oppSummary}\n\nMap tool IDs:` }],
    }),
  });

  if (!res.ok) {
    return {
      content: [{ type: "text" as const, text: `Anthropic error: ${res.status}` }],
      isError: true,
    };
  }

  const msg = await res.json() as { content: Array<{ type: string; text?: string }> };
  const text = msg.content.find((b) => b.type === "text")?.text ?? "[]";

  return {
    content: [{ type: "text" as const, text }],
  };
}
