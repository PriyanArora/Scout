// save_report — writes a Claude-produced discovery report to Supabase so it can
// be viewed at <PUBLIC_APP_URL>/report/<run_id>.
// Uses service role key (server-side only, never expose to browser).

import { randomUUID } from "node:crypto";

interface SaveReportArgs {
  reportJson: Record<string, unknown>;
  sourceUrl: string;
}

export async function handleSaveReport(args: SaveReportArgs) {
  const { reportJson, sourceUrl } = args;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !apiKey) {
    return {
      content: [{ type: "text" as const, text: "No Supabase credentials configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required)." }],
      isError: true,
    };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    apikey: apiKey,
    "Content-Type": "application/json",
  };

  // Resolve org_id — prefer the configured default (same env the webhook uses);
  // fall back to the first profile for a single-tenant demo deploy.
  let orgId = process.env.WEBHOOK_DEFAULT_ORG_ID ?? "";
  if (!orgId) {
    try {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=org_id&limit=1`,
        { headers },
      );
      if (!profileRes.ok) throw new Error(`profiles lookup ${profileRes.status}`);
      const profiles = (await profileRes.json()) as Array<{ org_id: string }>;
      if (!profiles.length) throw new Error("no profiles found");
      orgId = profiles[0]!.org_id;
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Failed to resolve org_id: ${String(err)}` }],
        isError: true,
      };
    }
  }

  const runId = randomUUID();

  // Insert run row
  const runRes = await fetch(`${supabaseUrl}/rest/v1/runs`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      id: runId,
      org_id: orgId,
      status: "published",
      next_node: null,
      submitted_url: sourceUrl,
      normalized_url: sourceUrl,
      idempotency_key: randomUUID(),
      error: null,
    }),
  });
  if (!runRes.ok) {
    const body = await runRes.text();
    return {
      content: [{ type: "text" as const, text: `Failed to create run: ${body}` }],
      isError: true,
    };
  }

  // Map the Claude report schema → DB columns
  const bp = (reportJson["businessProfile"] ?? {}) as Record<string, unknown>;
  const topOpp = (reportJson["topOpportunity"] ?? {}) as Record<string, unknown>;
  const summary = (bp["description"] as string | undefined) ?? (topOpp["title"] as string | undefined) ?? "";

  const reportRes = await fetch(`${supabaseUrl}/rest/v1/reports`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      run_id: runId,
      version: 1,
      status: "complete",
      summary,
      business_profile: reportJson["businessProfile"] ?? {},
      opportunities: reportJson["opportunities"] ?? [],
      ranked: reportJson["opportunities"] ?? [],
      requirements: reportJson["requirements"] ?? {},
      solution_design: reportJson["solutionDesign"] ?? {},
      discovery_questions: reportJson["discoveryQuestions"] ?? [],
      top_workflow: {},
      playbook: reportJson["playbook"] ?? "",
      readiness: {},
      share_token_hash: null,
      share_expires_at: null,
      share_revoked_at: null,
    }),
  });
  if (!reportRes.ok) {
    const body = await reportRes.text();
    return {
      content: [{ type: "text" as const, text: `Failed to save report: ${body}` }],
      isError: true,
    };
  }

  const appUrl = process.env.PUBLIC_APP_URL ?? "https://scout-three-cyan.vercel.app";
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        run_id: runId,
        view_url: `${appUrl}/report/${runId}`,
      }),
    }],
  };
}
