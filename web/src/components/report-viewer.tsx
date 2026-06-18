"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { N8nActions } from "@/components/n8n-actions";
import type { Database } from "@/lib/db-types";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

// Render a requirements/design record as readable sections (was JSON.stringify).
function StructuredView({ data }: { data: Record<string, unknown> }) {
  return (
    <dl>
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{humanize(key)}</dt>
          <dd>
            {Array.isArray(value) ? (
              <ul>{value.map((v, i) => <li key={i}>{typeof v === "object" ? renderObj(v) : String(v)}</li>)}</ul>
            ) : typeof value === "object" && value !== null ? (
              <StructuredView data={value as Record<string, unknown>} />
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function renderObj(v: unknown): string {
  const o = v as Record<string, unknown>;
  if (o.name && o.role) return `${o.name}: ${o.role}`;
  return Object.values(o).filter((x) => typeof x !== "object").join(", ") || JSON.stringify(o);
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

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
  evidenceCitations?: string[];
}

interface BusinessProfile {
  name?: string;
  industry?: string;
  size?: string;
  description?: string;
  primaryServices?: string[];
  technologyIndicators?: string[];
  evidenceSnippets?: string[];
}

function Pillar({ pillar }: { pillar: string }) {
  return <span className="badge badge--tint pillar" data-pillar={pillar}>{pillar}</span>;
}

function Quadrant({ quadrant }: { quadrant: string }) {
  return <span className="badge badge--tint quadrant" data-q={quadrant}>{quadrant}</span>;
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

  const topWorkflow = report.top_workflow as Record<string, unknown> | null;
  const discoveryQuestions = report.discovery_questions as string[];
  const readiness = report.readiness as Record<string, unknown> | null;
  const lowSignal = !profile?.name;

  return (
    <main className="shell">
      <article className="rise">
        <header>
          <span className="eyebrow">Discovery deliverable</span>
          <h1>{profile?.name ?? "Discovery Report"}</h1>
          {profile?.industry && <p className="lead">{profile.industry}{profile.size ? ` · ${profile.size}` : ""}</p>}
          {report.status !== "completed" && report.status !== "published" && (
            <p className="meta" role="status">Report status: {report.status}</p>
          )}
          {lowSignal && (
            <p className="notice">Low-signal: limited website content was found. Results may be incomplete.</p>
          )}
        </header>

        {/* Summary */}
        <section>
          <h2>Executive summary</h2>
          <p style={{ marginBottom: 0 }}>{report.summary || "No summary available."}</p>
        </section>

        {/* Business Profile */}
        {profile && (
          <section>
            <h2>Business profile</h2>
            <dl>
              <div><dt>Industry</dt><dd>{profile.industry ?? "-"}</dd></div>
              {profile.size && <div><dt>Size</dt><dd>{profile.size}</dd></div>}
              <div><dt>Overview</dt><dd>{profile.description ?? "-"}</dd></div>
            </dl>
            {profile.primaryServices && profile.primaryServices.length > 0 && (
              <>
                <h3 style={{ marginTop: "1rem" }}>Primary services</h3>
                <ul>{profile.primaryServices.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
            {profile.technologyIndicators && profile.technologyIndicators.length > 0 && (
              <>
                <h3 style={{ marginTop: "1rem" }}>Tools detected on site</h3>
                <div className="tool-chips">
                  {profile.technologyIndicators.map((t, i) => <span key={i} className="tool-chip">{t}</span>)}
                </div>
              </>
            )}
            {profile.evidenceSnippets && profile.evidenceSnippets.length > 0 && (
              <>
                <h3 style={{ marginTop: "1rem" }}>Evidence</h3>
                <ul>{profile.evidenceSnippets.map((s, i) => <li key={i}><q>{s}</q></li>)}</ul>
              </>
            )}
          </section>
        )}

        {/* Opportunities */}
        <section>
          <h2>Ranked opportunities <span className="dim">({opportunities.length})</span></h2>
          {opportunities.length === 0 && <div className="empty">No opportunities identified.</div>}
          <ul className="opps">
            {opportunities.map((opp) => (
              <li key={opp.id} className="opp">
                <div className="opp__head">
                  <span className="opp__rank">#{opp.priority}</span>
                  <h3 style={{ margin: 0 }}>{opp.title}</h3>
                </div>
                <div className="opp__badges">
                  <Pillar pillar={opp.pillar} />
                  <Quadrant quadrant={opp.quadrant} />
                </div>
                <p className="dim" style={{ margin: "0.4rem 0 0" }}>{opp.description}</p>
                <div className="stats">
                  <div className="stat"><span className="stat__label">Impact</span><span className="stat__value">{opp.impactScore}<span className="unit">/5</span></span></div>
                  <div className="stat"><span className="stat__label">Effort</span><span className="stat__value">{opp.effortScore}<span className="unit">/5</span></span></div>
                  <div className="stat"><span className="stat__label">Confidence</span><span className="stat__value">{Math.round(opp.confidenceScore * 100)}<span className="unit">%</span></span></div>
                </div>
                {opp.roiEstimate && <p style={{ margin: "0.2rem 0" }}><span className="dim">ROI: </span>{opp.roiEstimate}</p>}
                {opp.evidenceCitations && opp.evidenceCitations.length > 0 && (
                  <ul style={{ marginTop: "0.3rem" }}>{opp.evidenceCitations.map((c, i) => <li key={i}><q>{c}</q></li>)}</ul>
                )}
                {opp.toolIds && opp.toolIds.length > 0 && (
                  <div className="tool-chips">{opp.toolIds.map((t) => <span key={t} className="tool-chip">{t}</span>)}</div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Requirements */}
        {report.requirements && Object.keys(report.requirements).length > 0 && (
          <section>
            <h2>Requirements brief</h2>
            <StructuredView data={report.requirements as Record<string, unknown>} />
          </section>
        )}

        {/* Solution Design */}
        {report.solution_design && Object.keys(report.solution_design).length > 0 && (
          <section>
            <h2>Solution design</h2>
            <StructuredView data={report.solution_design as Record<string, unknown>} />
          </section>
        )}

        {/* n8n Workflow */}
        {topWorkflow && Object.keys(topWorkflow).length > 0 && (
          <section>
            <h2>n8n workflow template</h2>
            <p className="meta">
              {topWorkflow.archetype ? <>Archetype: <strong>{String(topWorkflow.archetype)}</strong> · </> : null}
              Validated JSON. Imports into n8n 1.88.0 with credential placeholders.
            </p>
            <N8nActions workflow={topWorkflow} filename="scout-workflow" />
            <details style={{ marginTop: "0.75rem" }}>
              <summary>View workflow JSON</summary>
              <pre>{JSON.stringify(topWorkflow, null, 2)}</pre>
            </details>
            <ol style={{ marginTop: "0.75rem" }}>
              <li>Open in n8n (or import the .json), then paste onto the canvas</li>
              <li>Replace all <code>__PLACEHOLDER__</code> values with your credentials</li>
              <li>Activate the workflow</li>
            </ol>
          </section>
        )}

        {/* Discovery Questions */}
        {discoveryQuestions && discoveryQuestions.length > 0 && (
          <section>
            <h2>Discovery-call question pack</h2>
            <ol>{discoveryQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          </section>
        )}

        {/* Readiness */}
        {readiness && Object.keys(readiness).length > 0 && (
          <section>
            <h2>Readiness snapshot</h2>
            <StructuredView data={readiness as Record<string, unknown>} />
          </section>
        )}

        {/* Playbook */}
        <section>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Implementation playbook</h2>
            <button className="btn-ghost" onClick={() => setEditMode(!editMode)}>
              {editMode ? "Cancel" : "Edit"}
            </button>
          </div>
          {editMode ? (
            <div style={{ marginTop: "1rem" }}>
              <textarea value={playbook} onChange={(e) => setPlaybook(e.target.value)} rows={20} />
              <button className="btn-primary" onClick={() => void handleSave()} disabled={saving} style={{ marginTop: "0.75rem" }}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saveError && <p role="alert" style={{ marginTop: "0.75rem" }}>{saveError}</p>}
            </div>
          ) : playbook ? (
            <div className="playbook-markdown" style={{ marginTop: "1rem" }}>
              <Markdown remarkPlugins={[remarkGfm]}>{playbook}</Markdown>
            </div>
          ) : (
            <div className="empty">No playbook generated.</div>
          )}
        </section>

        <footer>
          <button className="btn-ghost" onClick={() => router.push("/dashboard")}>Back to dashboard</button>
          <button onClick={() => router.push(`/report/${runId}/share`)}>Share report</button>
          <a href={`/api/report/${runId}/pdf`} download>
            <span className="btn btn-primary">Download PDF</span>
          </a>
        </footer>
      </article>
    </main>
  );
}
