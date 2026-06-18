"use client";

import { useState } from "react";

// n8n has no "JSON-in-a-URL" deep link. The reliable ways to get a workflow into
// an editor are: paste the JSON onto the canvas (Ctrl/Cmd+V), import a .json
// file, or import-from-URL pointing at raw JSON. "Open in n8n" does the first:
// copy the workflow + open the editor so the user just pastes.
// Configure the editor with NEXT_PUBLIC_N8N_URL (defaults to n8n Cloud).

const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL ?? "https://app.n8n.io";

export function N8nActions({
  workflow,
  filename = "scout-workflow",
}: {
  workflow: unknown;
  filename?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const json = JSON.stringify(workflow, null, 2);

  async function copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(json);
      return true;
    } catch {
      return false;
    }
  }

  async function openInN8n() {
    const ok = await copy();
    window.open(`${N8N_URL.replace(/\/$/, "")}/workflow/new`, "_blank", "noopener");
    setStatus(
      ok
        ? "Workflow copied → press Ctrl/Cmd+V on the n8n canvas to drop it in."
        : "Opened n8n. Copy failed — use Download .json and import the file.",
    );
  }

  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Downloaded — in n8n use Import from File.");
  }

  return (
    <div className="n8n-actions">
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => void openInN8n()}>
          Open in n8n
        </button>
        <button className="btn-ghost" onClick={download}>
          Download .json
        </button>
        <button
          className="btn-ghost"
          onClick={() =>
            void copy().then((ok) => setStatus(ok ? "Copied to clipboard." : "Copy failed."))
          }
        >
          Copy JSON
        </button>
      </div>
      {status && (
        <p className="meta" style={{ marginTop: "0.5rem" }} role="status">
          {status}
        </p>
      )}
    </div>
  );
}
