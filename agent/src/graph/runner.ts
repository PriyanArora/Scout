// Local graph runner — executes the discovery pipeline end-to-end.
// Used for fixture testing and the MCP server (P15).

import { makeInitialState, type ScoutGraphState, type ScoutNodeName } from "../checkpoint/types.js";
import type { NodeDeps } from "../nodes/types.js";
import { runNode, PIPELINE } from "./builder.js";

export interface RunResult {
  state: ScoutGraphState;
  completedNodes: ScoutNodeName[];
  wallMs: number;
}

export async function runLocalGraph(
  runId: string,
  markdown: string,
  deps: NodeDeps,
  startNode: ScoutNodeName = "scrape_site",
): Promise<RunResult> {
  const t0 = Date.now();
  let state: ScoutGraphState = makeInitialState(runId);
  const completedNodes: ScoutNodeName[] = [];

  let started = false;
  for (const node of PIPELINE) {
    if (node === startNode) started = true;
    if (!started) continue;
    if (node === "finalize") break;

    const update = await runNode(node, state, deps, markdown);
    state = { ...state, ...update };
    completedNodes.push(node);

    if (state.error) {
      // Persist error but continue — recoverable node failures don't abort the graph
      console.warn(`[scout] node=${node} error=${state.error}`);
    }
  }

  return {
    state: { ...state, nextNode: "finalize" },
    completedNodes,
    wallMs: Date.now() - t0,
  };
}
