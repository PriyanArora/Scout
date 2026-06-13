// Main-content extraction adapter over `defuddle` (MIT, kepano/defuddle@0.18.1).
//
// INTEGRATION_PLAN §3 Wave 3 #10 / Decision Log Track 1: defuddle produces cleaner
// main-content markdown than the naive boilerplate-stripper, so fewer junk tokens
// reach Opus. defuddle is Node/DOM-based and its Deno-Edge compat is unverified, so
// it runs ONLY in the Node/Vercel layer here (`defuddle/node` self-contains a DOM
// parser — no jsdom dependency). The Edge keeps its inline stripper until Deno
// compat is verified (see IMPLEMENTATION_LOG). Falls back to `htmlToText` on any
// failure or empty extraction, so this seam can never regress the fallback path.

import { Defuddle } from "defuddle/node";
import { htmlToText } from "./normalize.js";

export async function extractMainContent(html: string, url: string): Promise<string> {
  try {
    const res = await Defuddle(html, url, { markdown: true });
    const md = (res.contentMarkdown ?? res.content ?? "").trim();
    if (md.length > 0) return md;
  } catch {
    // defuddle threw (malformed HTML, parser edge case) — use the naive stripper.
  }
  return htmlToText(html);
}
