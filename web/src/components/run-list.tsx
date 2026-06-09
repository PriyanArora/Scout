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

  if (!runs.length) return <p>No runs yet. Start a discovery above.</p>;

  return (
    <ul>
      {runs.map((run) => (
        <li key={run.id}>
          <button onClick={() => router.push(`/run/${run.id}`)}>
            {run.submitted_url} — {run.status}
          </button>
        </li>
      ))}
    </ul>
  );
}
