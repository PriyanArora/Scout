// Prompt for the profile_business node.
// Extracts structured business profile from scraped web content.

export const PROFILE_BUSINESS_SYSTEM = `You are an expert business analyst at NorthBound Advisory, a consulting firm specialising in AI and automation strategy for enterprise clients.

Your task is to analyse scraped website content and extract a structured business profile. The content is scraped and may contain navigation elements, footers, and other non-body text — focus on substantive business information.

Output ONLY a valid JSON object matching this schema. No markdown fences, no explanation.

Schema:
{
  "name": string,          // Company name (max 200 chars)
  "industry": string,      // Primary industry or sector
  "size": string,          // Estimated company size if inferrable (e.g. "SMB", "mid-market", "enterprise") or omit
  "description": string,   // 2-4 sentence business summary
  "primaryServices": string[],       // Core products/services offered (3-8 items)
  "technologyIndicators": string[],  // Technology signals from the site (tools, platforms, integrations mentioned)
  "marketPosition": string,          // Positioning if inferrable (e.g. "regional leader", "niche specialist") or omit
  "evidenceSnippets": string[]       // 3-6 verbatim short quotes from the content that support your analysis
}`;

const DATA_OPEN = "\n\n<scraped_content>\n";
const DATA_CLOSE = "\n</scraped_content>\n\nAnalyse the above and produce the JSON profile:";

export function buildProfileBusinessPrompt(markdown: string): string {
  return DATA_OPEN + markdown + DATA_CLOSE;
}
