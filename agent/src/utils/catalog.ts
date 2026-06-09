// Catalog enum validator — ensures LLM-generated tool IDs are in the grounded catalog.
// The CATALOG_IDS set is derived from agent/catalog.yaml at build time.
// Out-of-catalog IDs are a safety invariant: the LLM must only cite tools that
// NorthBound actually uses, preventing hallucinated or off-stack recommendations.

export const CATALOG_IDS: ReadonlySet<string> = new Set([
  "microsoft-365-copilot",
  "copilot-studio",
  "power-automate",
  "power-apps",
  "power-bi",
  "microsoft-teams",
  "sharepoint",
  "dataverse",
  "microsoft-fabric",
  "azure-functions",
  "azure-ai",
  "aws-lambda",
  "supabase",
  "vercel",
  "netlify",
  "n8n",
  "make",
  "zapier",
  "snowflake",
  "postgres",
  "airtable",
  "metabase",
  "hex",
  "claude-api",
  "openai-api",
  "langgraph",
  "mcp",
  "pgvector",
  "pinecone",
  "jina-reader",
  "firecrawl",
  "tavily",
  "dynamics-365",
  "hubspot",
  "salesforce",
  "slack",
  "notion",
  "asana",
  "monday",
  "jira",
  "github",
  "intercom",
  "zendesk",
]);

export class CatalogValidationError extends Error {
  constructor(
    message: string,
    public readonly invalidIds: string[],
  ) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

export function assertValidToolIds(
  ids: string[],
  validIds: ReadonlySet<string> = CATALOG_IDS,
): void {
  const invalid = ids.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new CatalogValidationError(
      `Tool IDs not in catalog: ${invalid.join(", ")}`,
      invalid,
    );
  }
}

export function filterValidToolIds(
  ids: string[],
  validIds: ReadonlySet<string> = CATALOG_IDS,
): string[] {
  return ids.filter((id) => validIds.has(id));
}
