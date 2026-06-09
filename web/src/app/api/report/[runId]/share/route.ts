import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/share-token";

const PostSchema = z.object({
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

const RevokeSchema = z.object({ action: z.literal("revoke") });

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { runId } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = PostSchema.safeParse(body);
  const expiresInDays = parsed.success ? parsed.data.expiresInDays : 30;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: report } = await sb
    .from("reports")
    .select("id")
    .eq("run_id", runId)
    .single() as { data: { id: string } | null };

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const { rawToken, tokenHash } = await generateShareToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await sb
    .from("reports")
    .update({ share_token_hash: tokenHash, share_expires_at: expiresAt, share_revoked_at: null })
    .eq("id", report.id) as { error: { message: string } | null };

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const shareUrl = `${process.env.PUBLIC_APP_URL}/share/${rawToken}`;
  return NextResponse.json({ shareUrl, expiresAt }, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { runId } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = RevokeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "action:revoke required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: report } = await sb
    .from("reports")
    .select("id")
    .eq("run_id", runId)
    .single() as { data: { id: string } | null };

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const { error: updateError } = await sb
    .from("reports")
    .update({ share_revoked_at: new Date().toISOString() })
    .eq("id", report.id) as { error: { message: string } | null };

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, revoked: true });
}
