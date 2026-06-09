// Scout Edge Function — checkpoint proof + future node dispatcher.
// P4: Proves checkpoint write → load → resume pattern on Deno Edge.
// P9: Becomes the full leased-node dispatcher.
//
// Supabase Edge Runtime injects:
//   SUPABASE_URL             — project REST endpoint
//   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for internal writes

// ---------------------------------------------------------------------------
// Types (inline — shared agent/src/checkpoint/types.ts cannot be imported
// directly in Edge; module sharing is wired up in P9 via Deno import map)
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

interface ProofState {
  runId: string;
  nextNode: ScoutNodeName;
  step: number;
  startedAt: string;
  scrapePageIds: string[];
}

interface CheckpointRow {
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  checkpoint: ProofState;
}

interface ProofResponse {
  threadId: string;
  invocation: number;
  nodeExecuted: "start" | "resume";
  wallMs: number;
  cpuBound: false;
  checkpointId: string;
  checkpointLoaded: boolean;
  state: ProofState;
}

// ---------------------------------------------------------------------------
// Checkpoint adapter — PostgREST fetch, no dependencies
// ---------------------------------------------------------------------------

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, apikey: key };
}

async function loadCheckpoint(
  url: string,
  key: string,
  threadId: string,
): Promise<{ checkpointId: string; state: ProofState } | null> {
  const q = new URL(`${url}/rest/v1/langgraph_checkpoints`);
  q.searchParams.set("thread_id", `eq.${threadId}`);
  q.searchParams.set("order", "created_at.desc");
  q.searchParams.set("limit", "1");

  const res = await fetch(q.toString(), { headers: authHeaders(key) });
  if (!res.ok) throw new Error(`checkpoint load ${res.status}: ${await res.text()}`);

  const rows = (await res.json()) as CheckpointRow[];
  if (rows.length === 0) return null;

  const row = rows[0]!;
  return { checkpointId: row.checkpoint_id, state: row.checkpoint };
}

async function saveCheckpoint(
  url: string,
  key: string,
  threadId: string,
  checkpointId: string,
  state: ProofState,
  parentId: string | null,
): Promise<void> {
  const res = await fetch(`${url}/rest/v1/langgraph_checkpoints`, {
    method: "POST",
    headers: {
      ...authHeaders(key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      thread_id: threadId,
      checkpoint_ns: "",
      checkpoint_id: checkpointId,
      parent_checkpoint_id: parentId,
      type: "scout_proof",
      checkpoint: state,
      metadata: { nextNode: state.nextNode, step: state.step },
    }),
  });
  if (!res.ok) throw new Error(`checkpoint save ${res.status}: ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Node implementations (proof — no LLM calls, I/O only)
// ---------------------------------------------------------------------------

function runStartNode(runId: string): ProofState {
  return {
    runId,
    nextNode: "scrape_site",
    step: 1,
    startedAt: new Date().toISOString(),
    scrapePageIds: [],
  };
}

function runResumeNode(prior: ProofState): ProofState {
  return { ...prior, step: prior.step + 1 };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const t0 = performance.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let body: { threadId?: string; runId?: string } = {};
  if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
    try {
      body = await req.json() as typeof body;
    } catch {
      return new Response(
        JSON.stringify({ error: "invalid JSON body" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
  }

  const threadId = typeof body.threadId === "string" && body.threadId
    ? body.threadId
    : crypto.randomUUID();

  const runId = typeof body.runId === "string" && body.runId
    ? body.runId
    : crypto.randomUUID();

  try {
    const prior = await loadCheckpoint(supabaseUrl, serviceRoleKey, threadId);

    let state: ProofState;
    let nodeExecuted: "start" | "resume";

    if (prior === null) {
      state = runStartNode(runId);
      nodeExecuted = "start";
    } else {
      state = runResumeNode(prior.state);
      nodeExecuted = "resume";
    }

    const checkpointId = crypto.randomUUID();
    await saveCheckpoint(
      supabaseUrl,
      serviceRoleKey,
      threadId,
      checkpointId,
      state,
      prior?.checkpointId ?? null,
    );

    const wallMs = Math.round(performance.now() - t0);

    const response: ProofResponse = {
      threadId,
      invocation: state.step,
      nodeExecuted,
      wallMs,
      cpuBound: false,
      checkpointId,
      checkpointLoaded: prior !== null,
      state,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
