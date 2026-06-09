"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const NODE_LABELS: Record<string, string> = {
  scrape_site: "Scraping website",
  profile_business: "Profiling business",
  identify_opportunities: "Identifying opportunities",
  score_and_rank: "Scoring and ranking",
  map_tools: "Mapping tools",
  draft_requirements: "Drafting requirements",
  solution_design: "Designing solution",
  generate_workflow: "Generating workflow",
  discovery_questions: "Writing discovery questions",
  write_playbook: "Writing playbook",
  critique: "Quality review",
  finalize: "Finalizing report",
};

interface RunStep {
  id: string;
  node: string;
  status: string;
  duration_ms: number | null;
  created_at: string;
}

interface RunData {
  id: string;
  submitted_url: string;
  status: string;
  next_node: string | null;
  error: Record<string, unknown> | null;
}

function statusIcon(status: string): string {
  if (status === "completed") return "✓";
  if (status === "failed") return "✗";
  if (status === "running") return "…";
  return "·";
}

export function RunProgress({ runId }: { runId: string }) {
  const router = useRouter();
  const [run, setRun] = useState<RunData | null>(null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const sb = getSupabaseBrowser();
    const { data: runData } = await sb
      .from("runs")
      .select("id,submitted_url,status,next_node,error")
      .eq("id", runId)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stepsData } = await (sb as any)
      .from("run_steps")
      .select("id,node,status,duration_ms,created_at")
      .eq("run_id", runId)
      .order("created_at") as { data: RunStep[] | null };
    if (runData) setRun(runData as RunData);
    if (stepsData) setSteps(stepsData);
    setLoading(false);
  }, [runId]);

  useEffect(() => {
    void loadData();

    const sb = getSupabaseBrowser();

    const runChannel = sb
      .channel(`run-${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${runId}` },
        (payload) => {
          setRun(payload.new as RunData);
          if ((payload.new as RunData).status === "completed") {
            router.push(`/report/${runId}`);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "run_steps", filter: `run_id=eq.${runId}` },
        (payload) => {
          setSteps((prev) => [...prev, payload.new as RunStep]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "run_steps", filter: `run_id=eq.${runId}` },
        (payload) => {
          setSteps((prev) =>
            prev.map((s) => (s.id === (payload.new as RunStep).id ? (payload.new as RunStep) : s)),
          );
        },
      )
      .subscribe();

    return () => { void sb.removeChannel(runChannel); };
  }, [runId, loadData, router]);

  if (loading) return <p>Loading…</p>;
  if (!run) return <p>Run not found.</p>;

  const isTerminal = run.status === "completed" || run.status === "failed" || run.status === "cancelled";

  return (
    <div>
      <h2>{run.submitted_url}</h2>
      <p>Status: <strong>{run.status}</strong></p>

      {run.status === "failed" && run.error && (
        <p role="alert">Error: {String((run.error as Record<string, unknown>).message ?? run.error)}</p>
      )}

      <ul>
        {steps.map((step) => (
          <li key={step.id}>
            {statusIcon(step.status)} {NODE_LABELS[step.node] ?? step.node}
            {step.duration_ms != null && ` (${step.duration_ms}ms)`}
          </li>
        ))}
        {!isTerminal && run.next_node && (
          <li>… {NODE_LABELS[run.next_node] ?? run.next_node}</li>
        )}
      </ul>

      {isTerminal && (
        <div>
          {run.status === "completed" && (
            <button onClick={() => router.push(`/report/${runId}`)}>View report</button>
          )}
          <button onClick={() => router.push("/dashboard")}>Back to dashboard</button>
        </div>
      )}
    </div>
  );
}
