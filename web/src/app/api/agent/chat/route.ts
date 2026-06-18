// Stack conversation at the human-in-the-loop pause. The consultant can ask
// "why n8n over Power Automate?", "what would the stack look like?", etc., and
// the model answers grounded in NorthBound's 43-tool catalog + the opportunities
// already identified. Pure conversation — it does not advance the pipeline.
// Streams tokens (SSE) so it reads like a chat.

import Anthropic from "@anthropic-ai/sdk";
import { renderCatalogBlock, buildSystemPrefix, type Opportunity } from "@/lib/agent-engine";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await req.json()) as {
    messages?: ChatMessage[];
    profile?: Record<string, unknown> | null;
    opportunities?: Opportunity[];
  };
  const messages = (body.messages ?? []).filter((m) => m.content.trim().length > 0);
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const oppSummary = (body.opportunities ?? [])
    .map(
      (o) =>
        `- ${o.title} [${o.pillar}] impact ${o.impactScore}/5, effort ${o.effortScore}/5` +
        (o.toolIds?.length ? ` — tools: ${o.toolIds.join(", ")}` : ""),
    )
    .join("\n");

  const systemSuffix = `You are a NorthBound Advisory solutions architect helping a consultant decide which automation opportunities to pursue and which tools to use.

GROUND RULES:
- Only ever recommend tools from the catalog below. Never invent or suggest tools outside it.
- Be concise and concrete (a few sentences or a short list). This is a working conversation, not a report.
- When comparing tools, explain the trade-off in NorthBound's context.

NORTHBOUND TOOL CATALOG:
${renderCatalogBlock()}

OPPORTUNITIES IDENTIFIED FOR THIS CLIENT:
${oppSummary || "(none yet)"}

${body.profile ? `BUSINESS CONTEXT:\n${JSON.stringify(body.profile).slice(0, 2000)}` : ""}`;

  const client = new Anthropic({ apiKey: key });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`));
      try {
        const llm = await client.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 1024,
          system: [
            { type: "text", text: buildSystemPrefix(), cache_control: { type: "ephemeral" } },
            { type: "text", text: systemSuffix },
          ],
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        });
        for await (const chunk of llm) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            send("delta", { text: chunk.delta.text });
          }
        }
        send("done", {});
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
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
