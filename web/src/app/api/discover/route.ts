import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { handleDiscover } from "@/lib/handlers/discover";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const agentUrl = `${supabaseUrl}/functions/v1/agent`;
  const internalSecret = process.env.AGENT_INTERNAL_SECRET ?? "";

  // Service-role isolation: this route uses service key only for DB writes
  // User auth is verified above — org isolation enforced by orgId scoping
  const orgRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=org_id&limit=1`, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
  if (!orgRes.ok) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });
  const profiles = (await orgRes.json()) as Array<{ org_id: string }>;
  if (!profiles.length) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const result = await handleDiscover(body, {
    orgId: profiles[0]!.org_id,
    userId: user.id,
    serviceRoleUrl: supabaseUrl,
    serviceRoleKey,
    agentUrl,
    internalSecret,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ run_id: result.runId, is_new: result.isNew }, { status: 202 });
}
