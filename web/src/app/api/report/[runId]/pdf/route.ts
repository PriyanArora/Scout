// PDF export route (INTEGRATION_PLAN §3 Wave 5 #20 — closes deferred P13 export).
// Renders the report to a PDF buffer with @react-pdf/renderer in the Node runtime.

import { createElement } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ReportPdf, type ReportPdfData } from "@/components/report-pdf";

// react-pdf needs the Node runtime (not edge).
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

interface ReportRow {
  business_profile: { name?: string } | null;
  summary: string | null;
  opportunities: ReportPdfData["opportunities"] | null;
  ranked: ReportPdfData["opportunities"] | null;
  playbook: string | null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { runId } = await params;

  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS scopes the row to the caller's org.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: report } = await sb
    .from("reports")
    .select("business_profile, summary, opportunities, ranked, playbook")
    .eq("run_id", runId)
    .single() as { data: ReportRow | null };

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const data: ReportPdfData = {
    name: report.business_profile?.name ?? "Discovery Report",
    summary: report.summary ?? "",
    opportunities: report.ranked ?? report.opportunities ?? [],
    playbook: report.playbook ?? "",
  };

  // ReportPdf returns a <Document>; cast to renderToBuffer's expected root type.
  const element = createElement(ReportPdf, { data }) as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="scout-report-${runId}.pdf"`,
    },
  });
}
