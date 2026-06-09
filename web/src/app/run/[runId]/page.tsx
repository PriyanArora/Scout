import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { RunProgress } from "@/components/run-progress";

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function RunPage({ params }: PageProps) {
  const { runId } = await params;

  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main>
      <RunProgress runId={runId} />
    </main>
  );
}
