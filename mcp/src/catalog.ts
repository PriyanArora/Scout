// Scout grounded tool catalog — MCP mirror of agent/src/catalog/data.ts.
// Pure data: no LLM, no network. get_catalog hands this verbatim to Claude (the
// host), which does all tool-mapping reasoning itself. Kept in lockstep with the
// canonical TS source / YAML / SQL seed / Edge function by the drift-guard test
// (agent/src/catalog/catalog-drift.test.ts → "MCP catalog ...").
//
// ponytail: duplicated rather than imported — the four other runtimes can't share
// one import either (separate Deno/SQL/YAML targets), so the repo's standing rule
// is "mirror + drift test guards the ids". Upgrade path: a shared published pkg if
// the catalog ever churns.

export interface CatalogToolEntry {
  id: string;
  name: string;
  category: string;
  whatItDoes: string;
}

export const CATALOG_TOOLS: readonly CatalogToolEntry[] = [
  { id: "microsoft-365-copilot", name: "Microsoft 365 Copilot", category: "AI productivity", whatItDoes: "Adds AI assistance across Microsoft 365 workspaces." },
  { id: "copilot-studio", name: "Copilot Studio", category: "Agent builder", whatItDoes: "Builds enterprise copilots and conversational workflows." },
  { id: "power-automate", name: "Power Automate", category: "Automation", whatItDoes: "Automates Microsoft-centric workflows and approvals." },
  { id: "power-apps", name: "Power Apps", category: "Low-code app", whatItDoes: "Creates lightweight internal business apps." },
  { id: "power-bi", name: "Power BI", category: "Analytics", whatItDoes: "Builds dashboards and semantic business reporting." },
  { id: "microsoft-teams", name: "Microsoft Teams", category: "Collaboration", whatItDoes: "Collaboration and notification surface for Microsoft organizations." },
  { id: "sharepoint", name: "SharePoint", category: "Content platform", whatItDoes: "Stores documents, intranet content, and lists." },
  { id: "dataverse", name: "Dataverse", category: "Data platform", whatItDoes: "Managed data layer for Power Platform applications." },
  { id: "microsoft-fabric", name: "Microsoft Fabric", category: "Data platform", whatItDoes: "Unified Microsoft analytics and lakehouse platform." },
  { id: "azure-functions", name: "Azure Functions", category: "Serverless", whatItDoes: "Runs event-driven functions in Azure." },
  { id: "azure-ai", name: "Azure AI", category: "AI platform", whatItDoes: "Enterprise AI services and model hosting in Azure." },
  { id: "aws-lambda", name: "AWS Lambda", category: "Serverless", whatItDoes: "Runs serverless functions for event-driven automation." },
  { id: "supabase", name: "Supabase", category: "Backend platform", whatItDoes: "Provides Postgres, auth, storage, realtime, and Edge Functions." },
  { id: "vercel", name: "Vercel", category: "Frontend hosting", whatItDoes: "Hosts Next.js web applications and thin APIs." },
  { id: "netlify", name: "Netlify", category: "Frontend hosting", whatItDoes: "Hosts static and serverless web projects." },
  { id: "n8n", name: "n8n", category: "Automation", whatItDoes: "Builds workflow automations with APIs and webhooks." },
  { id: "make", name: "Make", category: "Automation", whatItDoes: "Visual automation platform for SaaS integrations." },
  { id: "zapier", name: "Zapier", category: "Automation", whatItDoes: "Simple SaaS automation and trigger-action workflows." },
  { id: "snowflake", name: "Snowflake", category: "Data platform", whatItDoes: "Cloud data warehouse and analytics platform." },
  { id: "postgres", name: "Postgres", category: "Database", whatItDoes: "Relational database for transactional and analytical workloads." },
  { id: "airtable", name: "Airtable", category: "Low-code database", whatItDoes: "Spreadsheet-like database for business teams." },
  { id: "metabase", name: "Metabase", category: "Analytics", whatItDoes: "Open-source BI and dashboarding." },
  { id: "hex", name: "Hex", category: "Analytics", whatItDoes: "Collaborative notebooks and analytics apps." },
  { id: "claude-api", name: "Claude API", category: "LLM", whatItDoes: "Claude models for structured reasoning and generation." },
  { id: "openai-api", name: "OpenAI API", category: "LLM", whatItDoes: "OpenAI models for AI app features." },
  { id: "langgraph", name: "LangGraph", category: "Agent framework", whatItDoes: "Builds durable, stateful agent graphs." },
  { id: "mcp", name: "Model Context Protocol", category: "AI integration", whatItDoes: "Exposes tools and data sources to AI assistants." },
  { id: "pgvector", name: "pgvector", category: "Vector search", whatItDoes: "Adds vector embeddings to Postgres." },
  { id: "pinecone", name: "Pinecone", category: "Vector database", whatItDoes: "Managed vector search service." },
  { id: "jina-reader", name: "Jina Reader", category: "Scraping", whatItDoes: "Converts public web pages to markdown for analysis." },
  { id: "firecrawl", name: "Firecrawl", category: "Scraping", whatItDoes: "Scrapes and crawls web pages into clean markdown." },
  { id: "tavily", name: "Tavily", category: "Search", whatItDoes: "Search API for AI applications." },
  { id: "dynamics-365", name: "Dynamics 365", category: "CRM/ERP", whatItDoes: "Microsoft CRM and business applications suite." },
  { id: "hubspot", name: "HubSpot", category: "CRM", whatItDoes: "CRM and marketing automation platform." },
  { id: "salesforce", name: "Salesforce", category: "CRM", whatItDoes: "Enterprise CRM platform." },
  { id: "slack", name: "Slack", category: "Collaboration", whatItDoes: "Team messaging and workflow notifications." },
  { id: "notion", name: "Notion", category: "Knowledge base", whatItDoes: "Docs, wiki, and lightweight database workspace." },
  { id: "asana", name: "Asana", category: "Project management", whatItDoes: "Project and task management." },
  { id: "monday", name: "Monday.com", category: "Work management", whatItDoes: "Configurable work management boards and automations." },
  { id: "jira", name: "Jira", category: "Issue tracking", whatItDoes: "Software delivery and ticket tracking." },
  { id: "github", name: "GitHub", category: "Developer platform", whatItDoes: "Source control, automation, and CI/CD." },
  { id: "intercom", name: "Intercom", category: "Customer support", whatItDoes: "Customer messaging and support automation." },
  { id: "zendesk", name: "Zendesk", category: "Customer support", whatItDoes: "Support ticketing and customer service workflows." },
];

// CATALOG_IDS — the grounding allow-list. Claude must only ever emit toolIds from
// this set; the drift test asserts it stays at the canonical 43.
export const CATALOG_IDS = CATALOG_TOOLS.map((t) => t.id);

export function handleGetCatalog() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { count: CATALOG_TOOLS.length, tools: CATALOG_TOOLS },
          null,
          2,
        ),
      },
    ],
  };
}
