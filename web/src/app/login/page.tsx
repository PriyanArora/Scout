"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// Single shared demo credential — see claude/remaining.md. The account is
// created once in Supabase; the same login is used by you and the employer
// during the demo so nobody else can reach the deployed app.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
    if (err) {
      setError("Sign-in failed. Check the credentials and try again.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="shell" style={{ maxWidth: 420, paddingTop: "5rem" }}>
      <div className="card card--pad-lg rise">
        <span className="eyebrow">Automation discovery</span>
        <h1>Sign in to Scout</h1>
        <p className="lead" style={{ marginBottom: "1.5rem" }}>
          Paste a client&apos;s URL and Scout maps their automation opportunities in real time. Pick the
          one worth building and export a ready-to-import n8n workflow — the automation, done.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@scout.northbound.app"
              required
              disabled={loading}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              disabled={loading}
            />
          </div>
          <button type="submit" disabled={loading || !email || !password} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {error && <p role="alert" style={{ marginTop: "1rem" }}>{error}</p>}
        </form>
      </div>
    </main>
  );
}
