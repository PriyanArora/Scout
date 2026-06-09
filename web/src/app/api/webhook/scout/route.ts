import { NextResponse } from "next/server";
import { handleWebhookScout } from "@/lib/handlers/webhook-scout";

const WEBHOOK_ORG_ID = process.env.WEBHOOK_DEFAULT_ORG_ID ?? "";

export async function POST(request: Request) {
  const rawBody = await request.text();

  const sig = request.headers.get("x-scout-signature");
  const ts = request.headers.get("x-scout-timestamp");

  const secret = process.env.SCOUT_WEBHOOK_SECRET ?? "";
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const agentUrl = `${supabaseUrl}/functions/v1/agent`;
  const internalSecret = process.env.AGENT_INTERNAL_SECRET ?? "";

  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const result = await handleWebhookScout(rawBody, sig, ts, {
    webhookSecret: secret,
    serviceRoleUrl: supabaseUrl,
    serviceRoleKey,
    agentUrl,
    internalSecret,
    orgId: WEBHOOK_ORG_ID,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ run_id: result.runId, accepted: true }, { status: 202 });
}
