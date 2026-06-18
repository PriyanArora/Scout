// Live interactive discovery — runs the shared Scout nodes one at a time and
// streams each step to the browser (SSE), so the user watches the process the
// way they would in a chat. Two phases around a human-in-the-loop pause:
//   phase "discover": scrape -> profile -> identify -> score  -> PAUSE (choose)
//   phase "build":    map_tools -> generate n8n workflow      -> done
// The browser holds the scored opportunities across the pause and posts the
// chosen subset back, so the server stays stateless (no DB needed for the demo).

import {
  getEngineDeps,
  scrapeWithJina,
  profileBusinessNode,
  identifyOppsNode,
  scoreAndRankNode,
  mapToolsNode,
  generateWorkflow,
  makeInitialState,
  type ScoutGraphState,
  type Opportunity,
} from "@/lib/agent-engine";

export const runtime = "nodejs";
export const maxDuration = 300;

type Emit = (event: string, data: unknown) => Promise<void>;

function sseStream(run: (emit: Emit) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = async (event, data) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, ...(data as object) })}\n\n`),
        );
      };
      try {
        await run(emit);
      } catch (err) {
        await emit("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// Run one labelled node, streaming start + done with timing.
async function step<T>(
  emit: Emit,
  node: string,
  label: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  await emit("step", { node, label, status: "start" });
  const t0 = Date.now();
  const out = await fn();
  await emit("step", { node, label, status: "done", durationMs: Date.now() - t0 });
  return out;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as {
    phase?: "discover" | "build";
    url?: string;
    notes?: string;
    opportunities?: Opportunity[];
  };

  const deps = getEngineDeps();

  if (body.phase === "build") {
    const selected = body.opportunities ?? [];
    return sseStream(async (emit) => {
      if (selected.length === 0) {
        await emit("error", { message: "No opportunities selected" });
        return;
      }
      let state: ScoutGraphState = {
        ...makeInitialState(crypto.randomUUID()),
        opportunities: selected,
      };

      const mapped = await step(emit, "map_tools", "Mapping catalog tools", () =>
        mapToolsNode(state, deps),
      );
      state = { ...state, ...mapped };
      const opps = state.opportunities as Opportunity[];
      await emit("output", { node: "map_tools", opportunities: opps });

      const top = [...opps].sort((a, b) => a.priority - b.priority)[0]!;
      const gen = await step(emit, "generate_workflow", "Generating n8n workflow", () =>
        generateWorkflow(top, top.toolIds, deps, state.usage),
      );
      await emit("workflow", {
        topOpportunity: top,
        archetype: gen.archetype,
        workflow: gen.workflow,
      });
      await emit("done", { usage: gen.usage });
    });
  }

  // default: discover phase
  const url = (body.url ?? "").trim();
  const notes = (body.notes ?? "").trim();
  return sseStream(async (emit) => {
    if (!/^https?:\/\//i.test(url)) {
      await emit("error", { message: "Enter a valid http(s) URL" });
      return;
    }
    let state: ScoutGraphState = makeInitialState(crypto.randomUUID());

    const scrape = await step(emit, "scrape_site", "Scraping website", () =>
      scrapeWithJina(url),
    );
    // Thread the consultant's pain-point notes into the context the profile /
    // identify nodes read, so they actually shape the output.
    const markdown = notes
      ? `Client-provided context and pain points:\n${notes}\n\n---\n\n${scrape.markdown}`
      : scrape.markdown;
    await emit("output", {
      node: "scrape_site",
      title: scrape.title ?? url,
      chars: markdown.length,
      lowSignal: scrape.lowSignal,
    });
    if (!markdown || scrape.lowSignal) {
      await emit("note", {
        message:
          "The site returned little usable content — results may be thin. Continuing anyway.",
      });
    }

    const profile = await step(emit, "profile_business", "Profiling the business", () =>
      profileBusinessNode(state, markdown, deps),
    );
    state = { ...state, ...profile };
    if (!state.businessProfile) {
      await emit("error", { message: state.error ?? "Could not profile the business" });
      return;
    }
    await emit("output", { node: "profile_business", profile: state.businessProfile });

    const identified = await step(
      emit,
      "identify_opportunities",
      "Identifying opportunities",
      () => identifyOppsNode(state, markdown, deps),
    );
    state = { ...state, ...identified };

    const scored = scoreAndRankNode(state);
    state = { ...state, ...scored };
    const opps = state.opportunities as Opportunity[];
    if (opps.length === 0) {
      await emit("error", { message: "No opportunities found for this site" });
      return;
    }

    // Hand control to the human: present the ranked opportunities and stop.
    await emit("pause", {
      phase: "choose_opportunities",
      profile: state.businessProfile,
      opportunities: opps,
    });
  });
}
