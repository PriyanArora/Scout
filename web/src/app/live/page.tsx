import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { LiveSession } from "@/components/live-session";

export default async function LivePage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <LiveSession />;
}
