// Canonical NorthBound catalog ids. Kept in lockstep with agent/src/catalog/data.ts,
// agent/catalog.yaml, the SQL seed, and the Edge function by the drift-guard test
// in agent/src/catalog/catalog-drift.test.ts. (Previously this list was a separate,
// wrong catalog — a grounding-red-line violation now closed by Wave 2.)
const CATALOG_IDS = [
  "microsoft-365-copilot","copilot-studio","power-automate","power-apps","power-bi",
  "microsoft-teams","sharepoint","dataverse","microsoft-fabric","azure-functions",
  "azure-ai","aws-lambda","supabase","vercel","netlify","n8n","make","zapier",
  "snowflake","postgres","airtable","metabase","hex","claude-api","openai-api",
  "langgraph","mcp","pgvector","pinecone","jina-reader","firecrawl","tavily",
  "dynamics-365","hubspot","salesforce","slack","notion","asana","monday","jira",
  "github","intercom","zendesk",
] as const;

const CATALOG_SET = new Set<string>(CATALOG_IDS);

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

  // Ground the output: keep only catalog ids (grounding red line). Fall back to
  // the raw text if it doesn't parse as the expected array.
  try {
    const raw = JSON.parse(text) as Array<{ opportunityId: string; toolIds: string[] }>;
    const filtered = raw.map((m) => ({
      opportunityId: m.opportunityId,
      toolIds: (m.toolIds ?? []).filter((id) => CATALOG_SET.has(id)),
    }));
    return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
  } catch {
    return { content: [{ type: "text" as const, text }] };
  }
}
