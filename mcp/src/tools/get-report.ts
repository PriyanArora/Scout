// get_report — pure read of a stored Scout discovery report by run_id.
// No LLM: returns whatever the pipeline already persisted (profile,
// opportunities, requirements, solution design, playbook) so Claude can reason
// over a prior run instead of re-discovering. Requires Supabase read creds; if
// they're absent the tool just says so (Claude can still run a fresh discovery
// via scrape_company + get_catalog).

interface GetReportArgs {
  runId: string;
}

export async function handleGetReport(args: GetReportArgs) {
  const { runId } = args;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !apiKey) {
    return {
      content: [{ type: "text" as const, text: "No Supabase read credentials configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY). Run a fresh discovery instead." }],
      isError: true,
    };
  }

  let res: Response;
  try {
    res = await fetch(
      `${supabaseUrl}/rest/v1/reports?run_id=eq.${encodeURIComponent(runId)}&select=*&limit=1`,
      { headers: { Authorization: `Bearer ${apiKey}`, apikey: apiKey } },
    );
  } catch (err) {
    return {
      content: [{ type: "text" as const, text: `Network error: ${String(err)}` }],
      isError: true,
    };
  }

  if (!res.ok) {
    return {
      content: [{ type: "text" as const, text: `Failed to fetch report: ${res.status} ${res.statusText}` }],
      isError: true,
    };
  }

  const rows = (await res.json()) as unknown[];
  if (!rows.length) {
    return {
      content: [{ type: "text" as const, text: `No report found for run_id: ${runId}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(rows[0], null, 2) }],
  };
}
