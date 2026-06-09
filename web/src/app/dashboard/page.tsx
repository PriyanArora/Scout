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
    <main>
      <h1>Scout Discovery</h1>
      <DiscoveryForm />
      <RunList userId={user.id} />
    </main>
  );
}
