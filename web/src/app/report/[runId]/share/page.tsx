"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function SharePage() {
  const { runId } = useParams<{ runId: string }>();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createShare() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/${runId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 30 }),
      });
      const json = await res.json() as { shareUrl?: string; expiresAt?: string; error?: string };
      if (!res.ok) { setError(json.error ?? "Failed to create share link"); return; }
      setShareUrl(json.shareUrl ?? null);
      setExpiresAt(json.expiresAt ?? null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function revokeShare() {
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/${runId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (!res.ok) { setError("Revoke failed"); return; }
      setShareUrl(null);
      setExpiresAt(null);
    } catch {
      setError("Network error");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <section>
      <h2>Share Report</h2>
      {!shareUrl ? (
        <button onClick={() => void createShare()} disabled={loading}>
          {loading ? "Generating…" : "Generate share link (30 days)"}
        </button>
      ) : (
        <>
          <p>Share link (expires {expiresAt ? new Date(expiresAt).toLocaleDateString() : "—"}):</p>
          <input type="text" value={shareUrl} readOnly style={{ width: "100%" }} />
          <button onClick={() => navigator.clipboard.writeText(shareUrl!)}>Copy</button>
          <button onClick={() => void revokeShare()} disabled={revoking}>
            {revoking ? "Revoking…" : "Revoke link"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
