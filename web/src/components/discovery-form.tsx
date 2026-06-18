"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DiscoveryForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, notes }),
      });

      const json = await res.json() as { run_id?: string; error?: string };

      if (!res.ok || !json.run_id) {
        setError(json.error ?? "Discovery failed");
        return;
      }

      router.push(`/run/${json.run_id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card card--pad-lg rise">
      <div className="field">
        <label htmlFor="url">Company website URL</label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://acme-logistics.com"
          required
          disabled={loading}
        />
      </div>
      <div className="field">
        <label htmlFor="notes">Pain-point notes <span className="dim">(optional)</span></label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. CFO says month-end close takes 12 days across three disconnected systems; regulatory change tracking lives in a shared spreadsheet."
          disabled={loading}
          maxLength={20000}
        />
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="meta">Runs server-side — you can close the tab and come back.</span>
        <button type="submit" disabled={loading || !url.trim()}>
          {loading ? "Starting discovery…" : "Run discovery"}
        </button>
      </div>
      {error && <p role="alert" style={{ marginTop: "1rem" }}>{error}</p>}
    </form>
  );
}
