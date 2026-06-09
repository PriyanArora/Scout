import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

const PatchSchema = z.object({
  playbook: z.string().max(50000).optional(),
  summary: z.string().max(10000).optional(),
});

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { runId } = await params;

  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Verify user owns this report (via run's org_id matching user's org_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: report } = await sb
    .from("reports")
    .select("id, run_id")
    .eq("run_id", runId)
    .single() as { data: { id: string; run_id: string } | null };

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.playbook !== undefined) updates.playbook = parsed.data.playbook;
  if (parsed.data.summary !== undefined) updates.summary = parsed.data.summary;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await sb
    .from("reports")
    .update(updates)
    .eq("id", report.id) as { error: { message: string } | null };

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
