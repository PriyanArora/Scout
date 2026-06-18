import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DiscoveryForm } from "@/components/discovery-form";
import { RunList } from "@/components/run-list";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="shell">
      <div className="rise" style={{ marginBottom: "1.75rem" }}>
        <span className="eyebrow">New discovery</span>
        <h1>Turn a client website into a deliverable</h1>
        <p className="lead">
          Paste a company URL and a paragraph of pain points. Scout scrapes, profiles the business,
          ranks automation opportunities against the NorthBound catalog, and drafts a requirements
          brief, solution design, n8n workflow, and playbook — editable before you share.
        </p>
      </div>
      <DiscoveryForm />
      <RunList userId={user.id} />
    </main>
  );
}
