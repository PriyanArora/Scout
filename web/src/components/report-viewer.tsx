"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/db-types";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

interface Opportunity {
  id: string;
  title: string;
  description: string;
  pillar: string;
  impactScore: number;
  effortScore: number;
  confidenceScore: number;
  roiEstimate?: string;
  quadrant: string;
  priority: number;
  toolIds?: string[];
}

interface BusinessProfile {
  name?: string;
  industry?: string;
  description?: string;
  primaryServices?: string[];
  technologyIndicators?: string[];
  evidenceSnippets?: string[];
}

function QuadrantBadge({ quadrant }: { quadrant: string }) {
  const colors: Record<string, string> = {
    "quick-win": "background:lightgreen",
    "strategic": "background:lightyellow",
    "fill-in": "background:lightblue",
    "thankless": "background:lightgray",
  };
  return <span style={{ padding: "2px 8px", borderRadius: 4, [colors[quadrant] ?? ""]: true }}>{quadrant}</span>;
}

interface ReportViewerProps {
  report: ReportRow;
  runId: string;
}

export function ReportViewer({ report, runId }: ReportViewerProps) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [playbook, setPlaybook] = useState(report.playbook);

  const profile = report.business_profile as BusinessProfile | null;
  const opportunities = (report.ranked ?? report.opportunities) as Opportunity[];

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/report/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbook }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setSaveError(json.error ?? "Save failed");
        return;
      }
      setEditMode(false);
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const topOpp = opportunities[0] ?? null;
  const topWorkflow = report.top_workflow as Record<string, unknown> | null;
  const discoveryQuestions = report.discovery_questions as string[];
  const readiness = report.readiness as Record<string, unknown> | null;
  const lowSignal = !profile?.name;

  return (
    <article>
      <header>
        <h1>{profile?.name ?? "Discovery Report"}</h1>
        {report.status !== "completed" && (
          <p role="status">Report status: {report.status}</p>
        )}
        {lowSignal && (
          <p role="alert">Low-signal: limited website content was found. Results may be incomplete.</p>
        )}
      </header>

      {/* Summary */}
      <section>
        <h2>Summary</h2>
        <p>{report.summary || "No summary available."}</p>
      </section>

      {/* Business Profile */}
      {profile && (
        <section>
          <h2>Business Profile</h2>
          <dl>
            <dt>Industry</dt><dd>{profile.industry ?? "—"}</dd>
            <dt>Description</dt><dd>{profile.description ?? "—"}</dd>
          </dl>
          {profile.primaryServices && profile.primaryServices.length > 0 && (
            <>
              <h3>Primary Services</h3>
              <ul>{profile.primaryServices.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
          {profile.evidenceSnippets && profile.evidenceSnippets.length > 0 && (
            <>
              <h3>Evidence</h3>
              <ul>{profile.evidenceSnippets.map((s, i) => <li key={i}><q>{s}</q></li>)}</ul>
            </>
          )}
        </section>
      )}

      {/* Opportunities */}
      <section>
        <h2>Opportunities ({opportunities.length})</h2>
        {opportunities.length === 0 && <p>No opportunities identified.</p>}
        <ul>
          {opportunities.map((opp) => (
            <li key={opp.id}>
              <h3>#{opp.priority} — {opp.title}</h3>
              <p>{opp.description}</p>
              <dl>
                <dt>Pillar</dt><dd>{opp.pillar}</dd>
                <dt>Impact</dt><dd>{opp.impactScore}/5</dd>
                <dt>Effort</dt><dd>{opp.effortScore}/5</dd>
                <dt>Confidence</dt><dd>{Math.round(opp.confidenceScore * 100)}%</dd>
                <dt>Quadrant</dt><dd><QuadrantBadge quadrant={opp.quadrant} /></dd>
                {opp.roiEstimate && <><dt>ROI</dt><dd>{opp.roiEstimate}</dd></>}
                {opp.toolIds && opp.toolIds.length > 0 && (
                  <><dt>Tools</dt><dd>{opp.toolIds.join(", ")}</dd></>
                )}
              </dl>
            </li>
          ))}
        </ul>
      </section>

      {/* Requirements */}
      {report.requirements && Object.keys(report.requirements).length > 0 && (
        <section>
          <h2>Requirements Brief</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(report.requirements, null, 2)}
          </pre>
        </section>
      )}

      {/* Solution Design */}
      {report.solution_design && Object.keys(report.solution_design).length > 0 && (
        <section>
          <h2>Solution Design</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(report.solution_design, null, 2)}
          </pre>
        </section>
      )}

      {/* n8n Workflow */}
      {topWorkflow && Object.keys(topWorkflow).length > 0 && (
        <section>
          <h2>n8n Workflow Template</h2>
          <p>Archetype: <strong>{String(topWorkflow.archetype ?? "—")}</strong></p>
          <details>
            <summary>View workflow configuration</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85em" }}>
              {JSON.stringify(topWorkflow, null, 2)}
            </pre>
          </details>
          <ol>
            <li>Import the workflow JSON into your n8n instance</li>
            <li>Replace all <code>__PLACEHOLDER__</code> values with your credentials</li>
            <li>Activate the workflow</li>
          </ol>
        </section>
      )}

      {/* Playbook */}
      <section>
        <h2>
          Implementation Playbook
          <button onClick={() => setEditMode(!editMode)} style={{ marginLeft: 8 }}>
            {editMode ? "Cancel" : "Edit"}
          </button>
        </h2>
        {editMode ? (
          <>
            <textarea
              value={playbook}
              onChange={(e) => setPlaybook(e.target.value)}
              rows={20}
              style={{ width: "100%" }}
            />
            <button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {saveError && <p role="alert">{saveError}</p>}
          </>
        ) : (
          <pre style={{ whiteSpace: "pre-wrap" }}>{playbook || "No playbook generated."}</pre>
        )}
      </section>

      {/* Discovery Questions */}
      {discoveryQuestions && discoveryQuestions.length > 0 && (
        <section>
          <h2>Discovery Questions</h2>
          <ol>{discoveryQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        </section>
      )}

      {/* Readiness */}
      {readiness && Object.keys(readiness).length > 0 && (
        <section>
          <h2>Readiness Snapshot</h2>
          <dl>
            {Object.entries(readiness).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>
            ))}
          </dl>
        </section>
      )}

      <footer>
        <button onClick={() => router.push("/dashboard")}>Back to dashboard</button>
        <button onClick={() => router.push(`/report/${runId}/share`)}>Share report</button>
      </footer>
    </article>
  );
}
