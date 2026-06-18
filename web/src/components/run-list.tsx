"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface RunSummary {
  id: string;
  submitted_url: string;
  status: string;
  created_at: string;
}

export function RunList({ userId }: { userId: string }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const router = useRouter();

  useEffect(() => {
    const sb = getSupabaseBrowser();

    async function loadRuns() {
      const { data } = await sb
        .from("runs")
        .select("id, submitted_url, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setRuns(data as RunSummary[]);
    }

    void loadRuns();

    // Realtime updates for status changes
    const channel = sb
      .channel("run-list-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "runs" },
        (payload) => {
          setRuns((prev) =>
            prev.map((r) =>
              r.id === (payload.new as RunSummary).id
                ? { ...r, status: (payload.new as RunSummary).status }
                : r,
            ),
          );
        },
      )
      .subscribe();

    return () => { void sb.removeChannel(channel); };
  }, [userId]);

  return (
    <section style={{ marginTop: "2.5rem" }}>
      <h2>Recent runs</h2>
      {!runs.length ? (
        <div className="empty">No runs yet — start a discovery above to see it appear here live.</div>
      ) : (
        <ul className="opps">
          {runs.map((run) => (
            <li key={run.id} className="opp" style={{ cursor: "pointer" }}
                onClick={() => router.push(`/run/${run.id}`)}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="mono" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {run.submitted_url}
                </span>
                <span className={`status status--${run.status}`}>{run.status}</span>
              </div>
              <span className="meta">{timeAgo(run.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}
