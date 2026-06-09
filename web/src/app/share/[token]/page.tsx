import { notFound } from "next/navigation";
import { hashShareToken } from "@/lib/share-token";
import { PublicReportView } from "@/components/public-report-view";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;

  const tokenHash = await hashShareToken(token);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const res = await fetch(
    `${supabaseUrl}/rest/v1/rpc/get_public_report_by_share_token_hash`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_share_token_hash: tokenHash }),
      next: { revalidate: 60 },
    },
  );

  if (!res.ok) notFound();
  const rows = (await res.json()) as Array<{
    id: string; summary: string; business_profile: Record<string, unknown>;
    opportunities: unknown[]; discovery_questions: unknown[]; created_at: string;
  }>;
  if (!rows.length) notFound();

  return <PublicReportView report={rows[0]!} />;
}
