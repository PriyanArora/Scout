interface WritePlaybookArgs {
  runId: string;
}

export async function handleWritePlaybook(args: WritePlaybookArgs) {
  const { runId } = args;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      content: [{ type: "text" as const, text: "Supabase env vars not configured" }],
      isError: true,
    };
  }

  // Fetch existing report
  const res = await fetch(
    `${supabaseUrl}/rest/v1/reports?run_id=eq.${runId}&select=id,playbook,opportunities,requirements,solution_design&limit=1`,
    { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } },
  );

  if (!res.ok) {
    return {
      content: [{ type: "text" as const, text: `Failed to fetch report: ${res.status}` }],
      isError: true,
    };
  }

  const rows = await res.json() as Array<{
    id: string;
    playbook: string;
    opportunities: unknown[];
    requirements: Record<string, unknown>;
    solution_design: Record<string, unknown>;
  }>;

  if (!rows.length) {
    return {
      content: [{ type: "text" as const, text: `No report found for run_id: ${runId}` }],
      isError: true,
    };
  }

  const report = rows[0]!;

  // If playbook exists and is non-empty, return it
  if (report.playbook && report.playbook.length > 50) {
    return {
      content: [{ type: "text" as const, text: report.playbook }],
    };
  }

  // Generate playbook via Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return {
      content: [{ type: "text" as const, text: "ANTHROPIC_API_KEY not configured — cannot generate playbook" }],
      isError: true,
    };
  }

  const topOpp = (report.opportunities as Array<Record<string, unknown>>)[0] ?? {};

  const msgRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: "You are a technical delivery consultant. Write a concise implementation playbook in markdown (max 600 words).",
      messages: [{
        role: "user",
        content: `Top opportunity: ${JSON.stringify(topOpp)}\nRequirements: ${JSON.stringify(report.requirements)}\nSolution: ${JSON.stringify(report.solution_design)}\n\nWrite the implementation playbook:`,
      }],
    }),
  });

  const msg = await msgRes.json() as { content: Array<{ type: string; text?: string }> };
  const playbook = msg.content.find((b) => b.type === "text")?.text ?? "Playbook generation failed.";

  return {
    content: [{ type: "text" as const, text: playbook }],
  };
}
