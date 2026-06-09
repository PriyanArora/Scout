// ScoutNodeName mirrors the public.scout_node DB enum exactly.
export type ScoutNodeName =
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

export interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export interface ScoutGraphState {
  runId: string;
  nextNode: ScoutNodeName;
  step: number;
  startedAt: string;
  scrapePageIds: string[];
  businessProfile: Record<string, unknown> | null;
  opportunities: ReadonlyArray<unknown>;
  usage: UsageAccumulator;
  error: string | null;
}

export const INITIAL_USAGE: UsageAccumulator = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0,
};

export function makeInitialState(runId: string): ScoutGraphState {
  return {
    runId,
    nextNode: "scrape_site",
    step: 0,
    startedAt: new Date().toISOString(),
    scrapePageIds: [],
    businessProfile: null,
    opportunities: [],
    usage: { ...INITIAL_USAGE },
    error: null,
  };
}
