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

const NODE_ORDER = Object.keys(NODE_LABELS);

function dotGlyph(state: string): string {
  if (state === "done") return "✓";
  if (state === "failed") return "✕";
  return "";
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

  if (loading) return <div className="shell"><div className="empty">Loading run…</div></div>;
  if (!run) return <div className="shell"><div className="empty">Run not found.</div></div>;

  const isTerminal = run.status === "completed" || run.status === "failed" || run.status === "cancelled";

  // Latest step per node → its state. next_node marks the active node mid-run.
  const byNode = new Map<string, RunStep>();
  for (const s of steps) byNode.set(s.node, s);

  function nodeState(node: string): "done" | "active" | "failed" | "pending" {
    const s = byNode.get(node);
    if (s?.status === "failed") return "failed";
    if (s?.status === "completed") return "done";
    if (s?.status === "running") return "active";
    if (!isTerminal && run!.next_node === node) return "active";
    return "pending";
  }

  const doneCount = NODE_ORDER.filter((n) => nodeState(n) === "done").length;

  return (
    <main className="shell">
      <div className="card card--pad-lg rise">
        <span className="eyebrow">Live discovery</span>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 className="mono" style={{ fontSize: "1.3rem", margin: 0 }}>{run.submitted_url}</h1>
          <span className={`status status--${run.status}`}>{run.status}</span>
        </div>
        <p className="meta">{doneCount} / {NODE_ORDER.length} steps complete · safe to close this tab</p>

        {run.status === "failed" && run.error && (
          <p role="alert">
            {String((run.error as Record<string, unknown>).message ?? run.error)}
          </p>
        )}

        <ol className="stepper">
          {NODE_ORDER.map((node) => {
            const state = nodeState(node);
            const step = byNode.get(node);
            return (
              <li key={node} className={`step step--${state}`}>
                <span className="step__dot">{dotGlyph(state)}</span>
                <span>{NODE_LABELS[node] ?? node}</span>
                {step?.duration_ms != null && (
                  <span className="step__dur">{(step.duration_ms / 1000).toFixed(1)}s</span>
                )}
              </li>
            );
          })}
        </ol>

        {isTerminal && (
          <div className="row" style={{ marginTop: "1.5rem" }}>
            {run.status === "completed" && (
              <button className="btn-primary" onClick={() => router.push(`/report/${runId}`)}>
                View report
              </button>
            )}
            <button className="btn-ghost" onClick={() => router.push("/dashboard")}>Back to dashboard</button>
          </div>
        )}
      </div>
    </main>
  );
}
