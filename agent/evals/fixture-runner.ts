// Fixture runner — runs the Scout discovery graph with mock LLM responses.
// Used in CI (deterministic) and for local smoke testing without real API calls.
// Set ANTHROPIC_API_KEY in env to use real Claude responses instead.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { runLocalGraph } from "../src/graph/runner.js";
import type { NodeDeps } from "../src/nodes/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "../fixtures/northbound-example.json");

interface Fixture {
  url: string;
  markdown: string;
}

function makeMockDeps(): NodeDeps {
  return {
    createMessage: async (params) => {
      // Dispatch on the NODE-SPECIFIC system block. With prompt caching the
      // shared prefix (block 0) is identical across nodes and mentions every
      // report section ("business profile", "opportunities", …), so matching the
      // concatenation would misroute. The node-specific instruction is the last
      // text block (after the cache_control breakpoint).
      const systemText = Array.isArray(params.system)
        ? (params.system.filter((s) => s.type === "text").at(-1)?.text ?? "")
        : String(params.system ?? "");

      let content = "{}";

      if (systemText.includes("business profile")) {
        content = JSON.stringify({
          name: "NorthBound Solutions",
          industry: "Professional services — finance & compliance",
          size: "mid-market",
          description: "NorthBound Solutions is a professional services firm specialising in finance, compliance, and operations consulting for regulated industries.",
          primaryServices: ["Regulatory Compliance", "Finance Transformation", "Operations Efficiency", "Risk Management"],
          technologyIndicators: ["Microsoft 365", "SharePoint", "Teams", "Power BI", "Power Automate", "Snowflake"],
          marketPosition: "Specialist mid-market",
          evidenceSnippets: [
            "mid-market professional services firm specialising in finance, compliance, and operations consulting",
            "month-end close takes 12 days and involves 40+ manual reconciliation steps",
          ],
        });
      } else if (systemText.includes("automation") || systemText.includes("opportunities")) {
        content = JSON.stringify([
          {
            id: "month-end-close-automation",
            title: "Month-End Close Automation",
            description: "Automate the 40+ manual reconciliation steps in the month-end close process using Power Automate and Snowflake.",
            pillar: "Operations & Efficiency",
            impactScore: 5,
            effortScore: 3,
            confidenceScore: 0.9,
            roiEstimate: "High — reduce close cycle from 12 to 5 days",
            evidenceCitations: ["month-end close takes 12 days and involves 40+ manual reconciliation steps across three systems"],
            toolIds: [],
            quadrant: "",
            priority: 0,
          },
          {
            id: "regulatory-change-alerting",
            title: "Regulatory Change Notification System",
            description: "Replace the email-and-spreadsheet approach with an automated alerting system for regulatory changes.",
            pillar: "Cybersecurity & Risk",
            impactScore: 4,
            effortScore: 2,
            confidenceScore: 0.85,
            roiEstimate: "Moderate — eliminate missed change notifications",
            evidenceCitations: ["Regulatory change notifications arrive by email and are tracked in a shared spreadsheet"],
            toolIds: [],
            quadrant: "",
            priority: 0,
          },
        ]);
      } else if (systemText.includes("tool") && systemText.includes("catalog")) {
        content = JSON.stringify([
          { opportunityId: "month-end-close-automation", toolIds: ["power-automate", "snowflake"] },
          { opportunityId: "regulatory-change-alerting", toolIds: ["power-automate", "microsoft-teams"] },
        ]);
      } else if (systemText.includes("discovery") || systemText.includes("consultant")) {
        content = JSON.stringify([
          "Can you walk us through your current month-end close process step by step?",
          "Which three steps consume the most manual effort today?",
          "Who owns the reconciliation process — finance team, operations, or a shared function?",
          "What data systems are involved and how is data currently moved between them?",
          "Have you evaluated any automation tools for this? What stopped adoption?",
          "What would a successful outcome look like for your team in 90 days?",
        ]);
      }

      return {
        id: "msg_mock",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: content }],
        model: params.model,
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 0,
        },
      } as Anthropic.Message;
    },
  };
}

function makeLiveDeps(): NodeDeps {
  const client = new Anthropic();
  return {
    createMessage: (params) => client.messages.create(params),
  };
}

async function main() {
  const raw = await readFile(FIXTURE_PATH, "utf-8");
  const fixture = JSON.parse(raw) as Fixture;

  const useLive = !!process.env["ANTHROPIC_API_KEY"];
  const deps = useLive ? makeLiveDeps() : makeMockDeps();

  console.log(`\n[scout-eval] mode=${useLive ? "live" : "mock"} fixture=${fixture.url}\n`);

  const result = await runLocalGraph(fixture.url, fixture.markdown, deps);

  console.log("[scout-eval] completed nodes:", result.completedNodes.join(" → "));
  console.log("[scout-eval] wall time:", result.wallMs, "ms");
  console.log("[scout-eval] cost USD:", result.state.usage.costUsd.toFixed(6));
  console.log("\n[scout-eval] REPORT JSON:\n");
  console.log(JSON.stringify(result.state, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
