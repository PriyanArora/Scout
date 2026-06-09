// Scout discovery graph pipeline definition.
// Nodes execute sequentially; each updates state and sets nextNode.
// In P9 this becomes a leased Edge Function dispatcher; here it runs locally.

import type { ScoutGraphState } from "../checkpoint/types.js";
import type { NodeDeps } from "../nodes/types.js";
import { scrapeSiteNode } from "../nodes/scrape-site.js";
import { profileBusinessNode } from "../nodes/profile-business.js";
import { identifyOppsNode } from "../nodes/identify-opps.js";
import { scoreAndRankNode } from "../nodes/score-rank.js";
import { mapToolsNode } from "../nodes/map-tools.js";
import { discoveryQuestionsNode } from "../nodes/discovery-qs.js";
import type { ScoutNodeName } from "../checkpoint/types.js";

export type NodeRunner = (
  state: ScoutGraphState,
  deps: NodeDeps,
  markdown: string,
) => Promise<Partial<ScoutGraphState>>;

// Graph: ordered list of node names in execution sequence
export const PIPELINE: ScoutNodeName[] = [
  "scrape_site",
  "profile_business",
  "identify_opportunities",
  "score_and_rank",
  "map_tools",
  "discovery_questions",
  "finalize",
];

export async function runNode(
  node: ScoutNodeName,
  state: ScoutGraphState,
  deps: NodeDeps,
  markdown: string,
): Promise<Partial<ScoutGraphState>> {
  switch (node) {
    case "scrape_site":
      return scrapeSiteNode(state, deps);
    case "profile_business":
      return profileBusinessNode(state, markdown, deps);
    case "identify_opportunities":
      return identifyOppsNode(state, markdown, deps);
    case "score_and_rank":
      return Promise.resolve(scoreAndRankNode(state));
    case "map_tools":
      return mapToolsNode(state, deps);
    case "discovery_questions":
      return discoveryQuestionsNode(state, deps);
    case "finalize":
      return Promise.resolve({ nextNode: "finalize" as ScoutNodeName, step: state.step + 1 });
    default:
      throw new Error(`Unknown node: ${node}`);
  }
}
