// Scout Edge Function — durable leased-node dispatcher.
// P9: One invocation = one node. Lease → execute → checkpoint → self-chain.
//
// Auth: POST body {run_id} + header x-scout-internal = AGENT_INTERNAL_SECRET
// Supabase auto-injects: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScoutNodeName =
  | "scrape_site"
  | "profile_business"
  | "identify_opportunities"
  | "score_and_rank"
  | "map_tools"
  | "draft_requirements"
  | "solution_design"
  | "generate_workflow"
  | "discovery_questions"
  | "write_playbook"
  | "critique"
  | "finalize";

interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

interface ScoutGraphState {
  runId: string;
  nextNode: ScoutNodeName | null;
  step: number;
  startedAt: string;
  orgId: string;
  submittedUrl: string;
  notes: string;
  scrapePageIds: string[];
  scrapeMarkdown: string;
  businessProfile: Record<string, unknown> | null;
  opportunities: unknown[];
  requirements: Record<string, unknown> | null;
  solutionDesign: Record<string, unknown> | null;
  workflow: Record<string, unknown> | null;
  discoveryQuestions: unknown[];
  playbook: string;
  revisionCount: number;
  usage: UsageAccumulator;
  error: string | null;
}

interface RunRow {
  id: string;
  org_id: string;
  status: string;
  next_node: ScoutNodeName;
  node_execution_id: string | null;
  submitted_url: string;
  normalized_url: string;
  notes: string;
  attempts: number;
  max_attempts: number;
  cost_usd: number;
  usage: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALL_BUDGET_MS = 100_000; // 100 s — well within the 150 s edge limit
const SELF_CHAIN_DELAY_MS = 200; // brief pause so DB writes flush
const LEASE_SECONDS = 120;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scout-internal",
};

// ---------------------------------------------------------------------------
// PostgREST helpers
// ---------------------------------------------------------------------------

function authHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "application/json",
  };
}

async function pgRest<T>(
  supabaseUrl: string,
  key: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...authHeaders(key), ...(options.headers as Record<string, string> ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PostgREST ${options.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function rpc<T>(
  supabaseUrl: string,
  key: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  return pgRest<T>(supabaseUrl, key, `rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

// ---------------------------------------------------------------------------
// Checkpoint adapter
// ---------------------------------------------------------------------------

async function loadCheckpoint(
  url: string,
  key: string,
  runId: string,
): Promise<{ checkpointId: string; state: ScoutGraphState } | null> {
  const q = new URLSearchParams({
    thread_id: `eq.${runId}`,
    order: "created_at.desc",
    limit: "1",
  });
  const rows = await pgRest<Array<{
    checkpoint_id: string;
    checkpoint: ScoutGraphState;
  }>>(url, key, `langgraph_checkpoints?${q}`);
  if (!rows.length) return null;
  return { checkpointId: rows[0]!.checkpoint_id, state: rows[0]!.checkpoint };
}

async function saveCheckpoint(
  url: string,
  key: string,
  runId: string,
  checkpointId: string,
  state: ScoutGraphState,
  parentId: string | null,
): Promise<void> {
  await pgRest<void>(url, key, "langgraph_checkpoints", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      thread_id: runId,
      checkpoint_ns: "",
      checkpoint_id: checkpointId,
      parent_checkpoint_id: parentId,
      type: "scout_state",
      checkpoint: state,
      metadata: { nextNode: state.nextNode, step: state.step },
    }),
  });
}

// ---------------------------------------------------------------------------
// Anthropic API helper (fetch-based, no SDK)
// ---------------------------------------------------------------------------

type MessageParam = { role: "user" | "assistant"; content: string };

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface AnthropicMessage {
  id: string;
  model: string;
  stop_reason: string;
  content: Array<{ type: string; text?: string }>;
  usage: AnthropicUsage;
}

async function anthropicCall(
  apiKey: string,
  model: string,
  maxTokens: number,
  system: string,
  messages: MessageParam[],
): Promise<AnthropicMessage> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  return res.json() as Promise<AnthropicMessage>;
}

function extractText(msg: AnthropicMessage): string {
  const block = msg.content.find((b) => b.type === "text");
  if (!block?.text) throw new Error("No text content in Anthropic response");
  return block.text;
}

function toCostDelta(msg: AnthropicMessage): Omit<UsageAccumulator, "costUsd"> & { model: string } {
  const u = msg.usage;
  return {
    model: msg.model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
  };
}

const PRICING: Record<string, { in: number; out: number; cacheR: number; cacheW: number }> = {
  "claude-opus-4-8": { in: 15, out: 75, cacheR: 1.5, cacheW: 18.75 },
  "claude-haiku-4-5": { in: 0.8, out: 4, cacheR: 0.08, cacheW: 1.0 },
};

function addUsage(
  acc: UsageAccumulator,
  delta: ReturnType<typeof toCostDelta>,
): UsageAccumulator {
  const p = PRICING[delta.model] ?? PRICING["claude-haiku-4-5"]!;
  const M = 1_000_000;
  const cost =
    (delta.inputTokens * p.in) / M +
    (delta.outputTokens * p.out) / M +
    (delta.cacheReadTokens * p.cacheR) / M +
    (delta.cacheCreationTokens * p.cacheW) / M;
  return {
    inputTokens: acc.inputTokens + delta.inputTokens,
    outputTokens: acc.outputTokens + delta.outputTokens,
    cacheReadTokens: acc.cacheReadTokens + delta.cacheReadTokens,
    cacheCreationTokens: acc.cacheCreationTokens + delta.cacheCreationTokens,
    costUsd: acc.costUsd + cost,
  };
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

function extractJson(text: string): unknown {
  // Strip fences
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const raw = fenced?.[1]?.trim() ?? text;
  const start = raw.search(/[{[]/);
  if (start === -1) throw new Error("No JSON found in response");
  return JSON.parse(raw.slice(start));
}

// ---------------------------------------------------------------------------
// Slim SSRF check (Edge context — no external resolver)
// ---------------------------------------------------------------------------

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname;
    // Block obvious private ranges and localhost by hostname pattern
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Node implementations
// ---------------------------------------------------------------------------

const CATALOG_IDS = ["ms-365","ms-azure-openai","ms-copilot-studio","ms-copilot","ms-teams","ms-sharepoint","ms-onedrive","ms-exchange","ms-outlook","ms-power-apps","ms-power-automate","power-automate","ms-power-bi","ms-power-pages","ms-dynamics-crm","ms-dynamics-365","ms-azure-ai-search","ms-purview","ms-sentinel","ms-defender","ms-entra","ms-intune","microsoft-365-copilot","snowflake","n8n","zapier","make","slack","sendgrid","hubspot","salesforce","zendesk","twilio","stripe","aws-bedrock","google-vertex-ai","openai","anthropic","firecrawl","jina-reader","notion","airtable","monday"];

async function runScrapeSite(
  state: ScoutGraphState,
  supabaseUrl: string,
  key: string,
): Promise<Partial<ScoutGraphState>> {
  const url = state.submittedUrl;
  if (!isSafeUrl(url)) {
    return { error: `scrape_site: unsafe URL ${url}`, nextNode: "profile_business", step: state.step + 1 };
  }

  // Check scrape cache first
  const cacheQ = new URLSearchParams({
    org_id: `eq.${state.orgId}`,
    normalized_url: `eq.${state.submittedUrl}`,
    limit: "5",
    order: "created_at.desc",
    select: "id,markdown",
  });
  const cached = await pgRest<Array<{ id: string; markdown: string }>>(
    supabaseUrl, key, `scrape_pages?${cacheQ}`,
  );
  if (cached.length > 0) {
    const markdown = cached.map((p) => p.markdown).join("\n\n---\n\n");
    return {
      scrapeMarkdown: markdown.slice(0, 60_000),
      scrapePageIds: cached.map((p) => p.id),
      nextNode: "profile_business",
      step: state.step + 1,
      error: null,
    };
  }

  // Jina Reader (keyless)
  let markdown = "";
  let source = "jina";
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/markdown" },
      redirect: "follow",
    });
    if (jinaRes.ok) {
      markdown = await jinaRes.text();
    }
  } catch {
    source = "error";
  }

  // Direct fetch fallback
  if (!markdown || markdown.length < 200) {
    source = "direct";
    try {
      const directRes = await fetch(url, { redirect: "follow" });
      if (directRes.ok) {
        const html = await directRes.text();
        markdown = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 60_000);
      }
    } catch {
      // proceed with empty — node will report low signal
    }
  }

  if (!markdown || markdown.length < 100) {
    return {
      scrapeMarkdown: "",
      scrapePageIds: [],
      nextNode: "profile_business",
      step: state.step + 1,
      error: "scrape_site: low-signal content — proceeding with empty scrape",
    };
  }

  markdown = markdown.slice(0, 60_000);

  // Persist to scrape_pages
  const hash = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(markdown))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );

  let pageId = "";
  try {
    const inserted = await pgRest<[{ id: string }]>(supabaseUrl, key, "scrape_pages", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        org_id: state.orgId,
        normalized_url: state.submittedUrl,
        source_url: state.submittedUrl,
        content_hash: hash,
        title: url,
        markdown,
        scrape_meta: { source },
      }),
    });
    pageId = inserted[0]?.id ?? "";
  } catch {
    // non-fatal — markdown is already in memory
  }

  return {
    scrapeMarkdown: markdown,
    scrapePageIds: pageId ? [pageId] : [],
    nextNode: "profile_business",
    step: state.step + 1,
    error: null,
  };
}

async function runProfileBusiness(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const markdown = state.scrapeMarkdown;
  if (!markdown) {
    return { businessProfile: null, nextNode: "identify_opportunities", step: state.step + 1 };
  }

  const system = `You are an expert business analyst. Extract a structured business profile from scraped website content. Output ONLY valid JSON.

Schema:
{"name":string,"industry":string,"size":string,"description":string,"primaryServices":string[],"technologyIndicators":string[],"marketPosition":string,"evidenceSnippets":string[]}`;

  const msg = await anthropicCall(
    apiKey, "claude-opus-4-8", 2048, system,
    [{ role: "user", content: `<scraped_content>\n${markdown.slice(0, 40_000)}\n</scraped_content>\n\nExtract the JSON profile:` }],
  );

  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  try {
    const profile = extractJson(extractText(msg)) as Record<string, unknown>;
    return { businessProfile: profile, usage, nextNode: "identify_opportunities", step: state.step + 1, error: null };
  } catch {
    return { usage, nextNode: "identify_opportunities", step: state.step + 1, error: "profile_business: JSON parse failed" };
  }
}

async function runIdentifyOpps(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const profile = state.businessProfile;
  const markdown = state.scrapeMarkdown;

  const system = `You are a senior AI solutions consultant at NorthBound Advisory. Identify 3–6 automation/AI opportunities.
NorthBound pillars: Customer Experience & Marketing | Cybersecurity & Risk | Operations & Efficiency | Data & Decision Intelligence

Output ONLY a valid JSON array. Each object:
{"id":string,"title":string,"description":string,"pillar":string,"impactScore":number,"effortScore":number,"confidenceScore":number,"roiEstimate":string,"evidenceCitations":string[],"toolIds":[],"quadrant":"","priority":0}`;

  const profileSummary = profile
    ? `Business: ${String(profile.name ?? "unknown")} (${String(profile.industry ?? "unknown")})\n`
    : "";
  const content = `${profileSummary}<scraped_content>\n${markdown.slice(0, 40_000)}\n</scraped_content>\n\nIdentify opportunities as JSON array:`;

  const msg = await anthropicCall(apiKey, "claude-opus-4-8", 4096, system, [{ role: "user", content }]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  try {
    const opps = extractJson(extractText(msg)) as unknown[];
    return { opportunities: opps, usage, nextNode: "score_and_rank", step: state.step + 1, error: null };
  } catch {
    return { usage, nextNode: "score_and_rank", step: state.step + 1, error: "identify_opportunities: JSON parse failed" };
  }
}

function runScoreAndRank(state: ScoutGraphState): Partial<ScoutGraphState> {
  type RawOpp = {
    id: string; title: string; description: string; pillar: string;
    impactScore: number; effortScore: number; confidenceScore: number;
    roiEstimate?: string; evidenceCitations: string[]; toolIds: string[];
  };

  const opps = (state.opportunities as RawOpp[]).map((o) => {
    const impact = Number(o.impactScore) || 1;
    const effort = Number(o.effortScore) || 1;
    const conf = Number(o.confidenceScore) || 0.5;
    const quadrant: string =
      impact >= 3 && effort <= 2 ? "quick-win"
      : impact >= 3 && effort > 2 ? "strategic"
      : impact < 3 && effort <= 2 ? "fill-in"
      : "thankless";
    const score = impact * conf * 10 - effort;
    return { ...o, quadrant, _score: score };
  });

  opps.sort((a, b) => b._score - a._score);
  const ranked = opps.map((o, i) => {
    const { _score: _, ...rest } = o;
    return { ...rest, priority: i + 1 };
  });

  return { opportunities: ranked, nextNode: "map_tools", step: state.step + 1, error: null };
}

async function runMapTools(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const opps = state.opportunities as Array<{ id: string; title: string; pillar: string }>;
  const oppSummary = opps.map((o) => `- ${o.id}: ${o.title} (${o.pillar})`).join("\n");

  const system = `You are a solutions architect. For each opportunity select 1–3 tool IDs from the catalog.
Catalog: ${CATALOG_IDS.join(", ")}
Output ONLY a JSON array: [{"opportunityId":string,"toolIds":string[]}]`;

  const msg = await anthropicCall(apiKey, "claude-haiku-4-5", 1024, system, [
    { role: "user", content: `Opportunities:\n${oppSummary}\n\nMap tool IDs:` },
  ]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  const catalogSet = new Set(CATALOG_IDS);
  try {
    const mappings = extractJson(extractText(msg)) as Array<{ opportunityId: string; toolIds: string[] }>;
    const mapped = (state.opportunities as Array<Record<string, unknown>>).map((o) => {
      const m = mappings.find((x) => x.opportunityId === o.id);
      const rawIds: string[] = m?.toolIds ?? [];
      return { ...o, toolIds: rawIds.filter((id) => catalogSet.has(id)) };
    });
    return { opportunities: mapped, usage, nextNode: "draft_requirements", step: state.step + 1, error: null };
  } catch {
    return { usage, nextNode: "draft_requirements", step: state.step + 1, error: "map_tools: JSON parse failed" };
  }
}

async function runDraftRequirements(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const topOpp = (state.opportunities as Array<Record<string, unknown>>)[0];
  if (!topOpp) {
    return { requirements: null, nextNode: "solution_design", step: state.step + 1 };
  }

  const system = `You are a business analyst writing a requirements brief. Output ONLY valid JSON.
Schema: {"opportunityId":string,"objective":string,"successMetrics":string[],"userStories":string[],"dataInputs":string[],"integrations":string[],"constraints":string[],"risks":string[]}`;

  const msg = await anthropicCall(apiKey, "claude-haiku-4-5", 1024, system, [
    { role: "user", content: `Write a requirements brief for:\n${JSON.stringify(topOpp, null, 2)}` },
  ]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  try {
    const req = extractJson(extractText(msg)) as Record<string, unknown>;
    return { requirements: req, usage, nextNode: "solution_design", step: state.step + 1, error: null };
  } catch {
    return { usage, nextNode: "solution_design", step: state.step + 1, error: "draft_requirements: JSON parse failed" };
  }
}

async function runSolutionDesign(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const topOpp = (state.opportunities as Array<Record<string, unknown>>)[0];
  const requirements = state.requirements;

  const system = `You are a solutions architect. Produce a high-level solution design. Output ONLY valid JSON.
Schema: {"opportunityId":string,"architecture":string,"components":string[],"dataFlows":string[],"securityNotes":string[],"estimatedEffortWeeks":number,"deploymentNotes":string}`;

  const msg = await anthropicCall(apiKey, "claude-haiku-4-5", 1024, system, [
    { role: "user", content: `Design a solution for:\nOpportunity: ${JSON.stringify(topOpp)}\nRequirements: ${JSON.stringify(requirements)}` },
  ]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  try {
    const design = extractJson(extractText(msg)) as Record<string, unknown>;
    return { solutionDesign: design, usage, nextNode: "generate_workflow", step: state.step + 1, error: null };
  } catch {
    return { usage, nextNode: "generate_workflow", step: state.step + 1, error: "solution_design: JSON parse failed" };
  }
}

async function runGenerateWorkflow(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const topOpp = (state.opportunities as Array<Record<string, unknown>>)[0];
  const toolIds: string[] = Array.isArray(topOpp?.toolIds) ? topOpp.toolIds as string[] : [];

  // Score archetypes
  const oppStr = JSON.stringify(topOpp ?? {});
  const archetypes = [
    { id: "rag-faq-skeleton", signals: /knowledge|faq|search|answer|document/ },
    { id: "form-to-crm", signals: /lead|contact|crm|form|intake|onboard/ },
    { id: "inbound-email-triage", signals: /email|triage|inbox|ticket|support/ },
    { id: "webhook-enrich-store", signals: /integration|connect|ingest|event|trigger/ },
    { id: "scheduled-scrape-summarize-notify", signals: /monitor|track|alert|report|competitive/ },
  ];
  const archetype = archetypes.find((a) => a.signals.test(oppStr.toLowerCase()))?.id ?? "webhook-enrich-store";

  const system = `You are an n8n workflow configuration expert. Return ONLY a JSON object mapping __PLACEHOLDER__ strings to their values. Skip __NODE_ID_N__, __WEBHOOK_ID__ — those are regenerated automatically.`;

  const msg = await anthropicCall(apiKey, "claude-haiku-4-5", 512, system, [
    {
      role: "user",
      content: `Archetype: ${archetype}\nOpportunity: ${oppStr.slice(0, 500)}\nTool IDs: ${toolIds.join(", ")}\n\nReturn placeholder map JSON:`,
    },
  ]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  let workflow: Record<string, unknown> = {};
  try {
    const placeholders = extractJson(extractText(msg)) as Record<string, string>;
    workflow = { archetype, placeholders, generatedAt: new Date().toISOString() };
  } catch {
    workflow = { archetype, placeholders: {}, generatedAt: new Date().toISOString() };
  }

  return { workflow, usage, nextNode: "discovery_questions", step: state.step + 1, error: null };
}

async function runDiscoveryQuestions(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const profile = state.businessProfile;
  const opps = state.opportunities;

  const system = `You are a discovery interviewer. Generate 5–8 discovery questions. Output ONLY a JSON array of strings.`;
  const msg = await anthropicCall(apiKey, "claude-haiku-4-5", 512, system, [
    { role: "user", content: `Business: ${JSON.stringify(profile)}\nOpportunities: ${JSON.stringify(opps).slice(0, 2000)}\n\nGenerate discovery questions:` },
  ]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  try {
    const questions = extractJson(extractText(msg)) as string[];
    return { discoveryQuestions: questions, usage, nextNode: "write_playbook", step: state.step + 1, error: null };
  } catch {
    return { usage, nextNode: "write_playbook", step: state.step + 1, error: "discovery_questions: JSON parse failed" };
  }
}

async function runWritePlaybook(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const topOpp = (state.opportunities as Array<Record<string, unknown>>)[0];
  const system = `You are a technical delivery consultant writing an implementation playbook. Output ONLY a concise markdown playbook (max 800 words).`;

  const msg = await anthropicCall(apiKey, "claude-haiku-4-5", 1024, system, [
    {
      role: "user",
      content: `Top opportunity: ${JSON.stringify(topOpp)}\nRequirements: ${JSON.stringify(state.requirements)}\nSolution: ${JSON.stringify(state.solutionDesign)}\n\nWrite the implementation playbook:`,
    },
  ]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  return { playbook: extractText(msg), usage, nextNode: "critique", step: state.step + 1, error: null };
}

async function runCritique(
  state: ScoutGraphState,
  apiKey: string,
): Promise<Partial<ScoutGraphState>> {
  const system = `You are a quality reviewer checking a Scout discovery report. Check: (1) grounding/citations, (2) catalog tool IDs valid, (3) feasibility, (4) injection artifacts.
Output ONLY valid JSON: {"revision_needed":boolean,"issues":string[],"confidence":number}`;

  const summary = JSON.stringify({
    profile: state.businessProfile,
    topOpps: (state.opportunities as unknown[]).slice(0, 3),
    requirements: state.requirements,
  }).slice(0, 8000);

  const msg = await anthropicCall(apiKey, "claude-opus-4-8", 512, system, [
    { role: "user", content: `Review this Scout report:\n${summary}` },
  ]);
  const delta = toCostDelta(msg);
  const usage = addUsage(state.usage, delta);

  try {
    const review = extractJson(extractText(msg)) as { revision_needed: boolean; issues: string[] };
    if (review.revision_needed && state.revisionCount < 2) {
      return {
        revisionCount: state.revisionCount + 1,
        usage,
        nextNode: "identify_opportunities",
        step: state.step + 1,
        error: `critique: revision requested — ${review.issues?.join("; ")}`,
      };
    }
  } catch {
    // critique parse failure is non-fatal
  }

  return { usage, nextNode: "finalize", step: state.step + 1, error: null };
}

async function runFinalize(
  state: ScoutGraphState,
  supabaseUrl: string,
  key: string,
): Promise<Partial<ScoutGraphState>> {
  const topOpp = (state.opportunities as Array<Record<string, unknown>>)[0] ?? {};
  const report = {
    org_id: state.orgId,
    run_id: state.runId,
    version: 1,
    status: "completed",
    summary: `Discovery completed for ${state.submittedUrl}. ${state.opportunities.length} opportunity/ies identified.`,
    business_profile: state.businessProfile ?? {},
    opportunities: state.opportunities,
    ranked: state.opportunities,
    requirements: state.requirements ?? {},
    solution_design: state.solutionDesign ?? {},
    discovery_questions: state.discoveryQuestions,
    top_workflow: state.workflow ?? {},
    playbook: state.playbook,
    readiness: { opportunityCount: state.opportunities.length, topPillar: topOpp.pillar ?? null },
  };

  await pgRest<void>(supabaseUrl, key, "reports", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(report),
  });

  // Mark run completed
  await pgRest<void>(supabaseUrl, key, `runs?id=eq.${state.runId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), next_node: null }),
  });

  return {
    nextNode: null,
    step: state.step + 1,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Node dispatcher
// ---------------------------------------------------------------------------

async function executeNode(
  node: ScoutNodeName,
  state: ScoutGraphState,
  supabaseUrl: string,
  supabaseKey: string,
  anthropicKey: string,
): Promise<Partial<ScoutGraphState>> {
  switch (node) {
    case "scrape_site":           return runScrapeSite(state, supabaseUrl, supabaseKey);
    case "profile_business":      return runProfileBusiness(state, anthropicKey);
    case "identify_opportunities": return runIdentifyOpps(state, anthropicKey);
    case "score_and_rank":        return runScoreAndRank(state);
    case "map_tools":             return runMapTools(state, anthropicKey);
    case "draft_requirements":    return runDraftRequirements(state, anthropicKey);
    case "solution_design":       return runSolutionDesign(state, anthropicKey);
    case "generate_workflow":     return runGenerateWorkflow(state, anthropicKey);
    case "discovery_questions":   return runDiscoveryQuestions(state, anthropicKey);
    case "write_playbook":        return runWritePlaybook(state, anthropicKey);
    case "critique":              return runCritique(state, anthropicKey);
    case "finalize":              return runFinalize(state, supabaseUrl, supabaseKey);
    default:
      return { error: `unknown node: ${node}`, nextNode: "finalize", step: state.step + 1 };
  }
}

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const t0 = performance.now();

  // --- env guard ---
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const internalSecret = Deno.env.get("AGENT_INTERNAL_SECRET");

  if (!supabaseUrl || !supabaseKey || !anthropicKey) {
    return json({ error: "missing required env vars" }, 500);
  }

  // --- auth ---
  if (internalSecret && req.headers.get("x-scout-internal") !== internalSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  // --- parse body ---
  let runId: string;
  let source: string = "manual";
  try {
    const body = await req.json() as { run_id?: string; source?: string };
    if (!body.run_id || typeof body.run_id !== "string") {
      return json({ error: "run_id required" }, 400);
    }
    runId = body.run_id;
    if (typeof body.source === "string") source = body.source;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const invocationId = crypto.randomUUID();

  // --- load run row ---
  let run: RunRow;
  try {
    const rows = await pgRest<RunRow[]>(
      supabaseUrl, supabaseKey,
      `runs?id=eq.${runId}&limit=1`,
    );
    if (!rows.length) return json({ error: "run not found", runId }, 404);
    run = rows[0]!;
  } catch (err) {
    return json({ error: `load run: ${String(err)}` }, 500);
  }

  if (!["queued", "running", "retrying"].includes(run.status)) {
    return json({ ok: true, runId, status: run.status, skipped: true });
  }

  // --- acquire lease ---
  const nodeExecId = crypto.randomUUID();
  let leasedRun: RunRow | null;
  try {
    leasedRun = await rpc<RunRow | null>(supabaseUrl, supabaseKey, "acquire_run_lease", {
      p_run_id: runId,
      p_locked_by: invocationId,
      p_node_execution_id: nodeExecId,
      p_lease_seconds: LEASE_SECONDS,
    });
  } catch (err) {
    return json({ error: `acquire_run_lease: ${String(err)}` }, 500);
  }

  if (!leasedRun) {
    // Another invocation owns the lease — exit cleanly
    return json({ ok: true, runId, skipped: true, reason: "lease_unavailable" });
  }

  // Record invocation started
  const invLog = {
    run_id: runId,
    org_id: leasedRun.org_id,
    invocation_id: invocationId,
    source,
    status: "started",
    node: leasedRun.next_node,
    node_execution_id: nodeExecId,
  };
  pgRest<void>(supabaseUrl, supabaseKey, "agent_invocations", {
    method: "POST",
    body: JSON.stringify(invLog),
  }).catch(() => {/* non-fatal */});

  // --- load checkpoint ---
  const prior = await loadCheckpoint(supabaseUrl, supabaseKey, runId);
  const baseState: ScoutGraphState = prior?.state ?? {
    runId,
    nextNode: leasedRun.next_node,
    step: 0,
    startedAt: new Date().toISOString(),
    orgId: leasedRun.org_id,
    submittedUrl: leasedRun.normalized_url || leasedRun.submitted_url,
    notes: leasedRun.notes,
    scrapePageIds: [],
    scrapeMarkdown: "",
    businessProfile: null,
    opportunities: [],
    requirements: null,
    solutionDesign: null,
    workflow: null,
    discoveryQuestions: [],
    playbook: "",
    revisionCount: 0,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 },
    error: null,
  };

  const nodeToRun = leasedRun.next_node;
  const stepT0 = performance.now();

  // --- execute node ---
  let nodeResult: Partial<ScoutGraphState>;
  let nodeError: string | null = null;
  try {
    nodeResult = await executeNode(nodeToRun, baseState, supabaseUrl, supabaseKey, anthropicKey);
  } catch (err) {
    nodeError = err instanceof Error ? err.message : String(err);
    nodeResult = { error: nodeError, step: baseState.step + 1 };
  }

  const stepDurationMs = Math.round(performance.now() - stepT0);
  const newState: ScoutGraphState = { ...baseState, ...nodeResult } as ScoutGraphState;

  // --- write checkpoint ---
  const newCheckpointId = crypto.randomUUID();
  try {
    await saveCheckpoint(supabaseUrl, supabaseKey, runId, newCheckpointId, newState, prior?.checkpointId ?? null);
  } catch {/* non-fatal — run continues */}

  // --- write run_steps ---
  const usage = newState.usage;
  pgRest<void>(supabaseUrl, supabaseKey, "run_steps", {
    method: "POST",
    body: JSON.stringify({
      org_id: leasedRun.org_id,
      run_id: runId,
      node: nodeToRun,
      node_execution_id: nodeExecId,
      status: nodeError ? "failed" : "completed",
      error: nodeError ? { message: nodeError } : null,
      input_tokens: usage.inputTokens - (baseState.usage.inputTokens),
      output_tokens: usage.outputTokens - (baseState.usage.outputTokens),
      cache_read_tokens: usage.cacheReadTokens - (baseState.usage.cacheReadTokens),
      cache_creation_tokens: usage.cacheCreationTokens - (baseState.usage.cacheCreationTokens),
      cost_usd: Math.max(0, usage.costUsd - (baseState.usage.costUsd)),
      duration_ms: stepDurationMs,
    }),
  }).catch(() => {/* non-fatal */});

  if (nodeError) {
    // Increment attempts; fail_run_node handles retry/failed logic
    await rpc<void>(supabaseUrl, supabaseKey, "fail_run_node", {
      p_run_id: runId,
      p_node_execution_id: nodeExecId,
      p_error: JSON.stringify({ message: nodeError, node: nodeToRun }),
    }).catch(() => {});

    const wallMs = Math.round(performance.now() - t0);
    return json({ ok: false, runId, node: nodeToRun, error: nodeError, wallMs });
  }

  const nextNode = newState.nextNode;
  const usageDelta = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    costUsd: usage.costUsd,
  };

  // --- advance run ---
  if (nextNode === null) {
    // Finalized — run is complete (runFinalize already set status=completed)
    const wallMs = Math.round(performance.now() - t0);
    return json({ ok: true, runId, node: nodeToRun, status: "completed", wallMs });
  }

  await rpc<void>(supabaseUrl, supabaseKey, "complete_run_node", {
    p_run_id: runId,
    p_node_execution_id: nodeExecId,
    p_next_node: nextNode,
    p_usage: JSON.stringify(usageDelta),
    p_cost_usd: usageDelta.costUsd,
  }).catch(() => {});

  const wallMs = Math.round(performance.now() - t0);

  // --- self-chain if budget allows ---
  if (wallMs < WALL_BUDGET_MS - SELF_CHAIN_DELAY_MS) {
    const selfUrl = `${supabaseUrl}/functions/v1/agent`;
    // Fire and forget — heartbeat handles recovery if this hop drops
    fetch(selfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        ...(internalSecret ? { "x-scout-internal": internalSecret } : {}),
      },
      body: JSON.stringify({ run_id: runId, source: "self_chain" }),
    }).catch(() => {/* drop is ok — pg_cron recovers */});
  }

  return json({ ok: true, runId, node: nodeToRun, nextNode, wallMs });
});
