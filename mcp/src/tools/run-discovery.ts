import { signWebhookBody } from "../lib/hmac.js";

interface RunDiscoveryArgs {
  url: string;
  notes?: string;
}

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export async function handleRunDiscovery(args: RunDiscoveryArgs) {
  const { url, notes = "" } = args;

  const webhookUrl = getEnv("SCOUT_WEBHOOK_URL");
  const secret = getEnv("SCOUT_WEBHOOK_SECRET");

  const rawBody = JSON.stringify({ url, notes });
  const ts = Math.floor(Date.now() / 1000);
  const signature = await signWebhookBody(secret, rawBody, ts);

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scout-signature": signature,
        "x-scout-timestamp": String(ts),
      },
      body: rawBody,
    });
  } catch (err) {
    return {
      content: [{ type: "text" as const, text: `Network error: ${String(err)}` }],
      isError: true,
    };
  }

  const json = await response.json() as { run_id?: string; error?: string };

  if (!response.ok || !json.run_id) {
    return {
      content: [{ type: "text" as const, text: `Discovery failed: ${json.error ?? response.statusText}` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          run_id: json.run_id,
          status: "queued",
          message: `Discovery started. Poll GET ${process.env.PUBLIC_APP_URL ?? ""}/run/${json.run_id} for progress.`,
        }, null, 2),
      },
    ],
  };
}
