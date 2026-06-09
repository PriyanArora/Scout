import { scrapeSite } from "../scrape/index.js";
import type { ScoutGraphState } from "../checkpoint/types.js";
import type { NodeDeps } from "./types.js";

export async function scrapeSiteNode(
  state: ScoutGraphState,
  deps: NodeDeps,
): Promise<Partial<ScoutGraphState>> {
  if (!deps.scrapeDeps) throw new Error("scrapeDeps required for scrape_site node");

  const pages = await scrapeSite(
    state.runId, // runId is the submitted URL in fixture runs
    { orgId: "fixture", normalizedUrl: state.runId, maxPages: 3 },
    deps.scrapeDeps,
  );

  return {
    scrapePageIds: pages.map((p) => p.pageId),
    nextNode: "profile_business",
    step: state.step + 1,
  };
}
