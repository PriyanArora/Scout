import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ReportViewer } from "@/components/report-viewer";
import type { Database } from "@/lib/db-types";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { runId } = await params;

  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("run_id", runId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (!report) notFound();

  return <ReportViewer report={report as ReportRow} runId={runId} />;
}
