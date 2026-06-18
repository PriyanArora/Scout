"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SharePage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
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
    <main className="shell" style={{ maxWidth: 640 }}>
      <div className="card card--pad-lg rise">
        <span className="eyebrow">Sharing</span>
        <h1>Share this report</h1>
        <p className="lead" style={{ marginBottom: "1.5rem" }}>
          Creates a secure, read-only link. Only a hash of the token is stored, it expires in 30 days,
          and you can revoke it any time.
        </p>
        {!shareUrl ? (
          <button className="btn-primary" onClick={() => void createShare()} disabled={loading}>
            {loading ? "Generating…" : "Generate share link"}
          </button>
        ) : (
          <>
            <label>Link · expires {expiresAt ? new Date(expiresAt).toLocaleDateString() : "—"}</label>
            <div className="copyable">
              <input type="text" value={shareUrl} readOnly />
              <button onClick={() => navigator.clipboard.writeText(shareUrl!)}>Copy</button>
            </div>
            <button className="btn-danger" onClick={() => void revokeShare()} disabled={revoking} style={{ marginTop: "1rem" }}>
              {revoking ? "Revoking…" : "Revoke link"}
            </button>
          </>
        )}
        {error && <p role="alert" style={{ marginTop: "1rem" }}>{error}</p>}
        <p style={{ marginTop: "1.5rem", marginBottom: 0 }}>
          <button className="btn-ghost" onClick={() => router.back()}>Back to report</button>
        </p>
      </div>
    </main>
  );
}
