"use client";

import { useCallback, useState } from "react";
import { N8nActions } from "@/components/n8n-actions";
import { makeSSEDecoder } from "@/lib/sse";

// Client-side type mirror (kept minimal; server owns the real schema).
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
  toolIds: string[];
  evidenceCitations: string[];
}

type Phase = "idle" | "discovering" | "choosing" | "building" | "done" | "error";

interface StepEntry {
  node: string;
  label: string;
  status: "start" | "done";
  durationMs?: number;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// Minimal POST-based SSE reader (EventSource is GET-only).
async function streamSSE(
  url: string,
  body: unknown,
  onEvent: (e: Record<string, unknown>) => void,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const feed = makeSSEDecoder(onEvent);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    feed(dec.decode(value, { stream: true }));
  }
}

const QUADRANT_LABEL: Record<string, string> = {
  "quick-win": "Quick win",
  strategic: "Strategic",
  "fill-in": "Fill-in",
  thankless: "Thankless",
};

export function LiveSession() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const [workflow, setWorkflow] = useState<unknown>(null);
  const [archetype, setArchetype] = useState<string>("");
  const [topOpp, setTopOpp] = useState<Opportunity | null>(null);

  const pushStep = useCallback((e: StepEntry) => {
    setSteps((prev) => {
      // collapse start+done into one row per node
      if (e.status === "done") {
        return prev.map((s) =>
          s.node === e.node && s.status === "start" ? { ...e } : s,
        );
      }
      return [...prev, e];
    });
  }, []);

  async function startDiscovery() {
    setError(null);
    setSteps([]);
    setOpportunities([]);
    setProfile(null);
    setWorkflow(null);
    setChat([]);
    setSelected(new Set());
    setPhase("discovering");
    try {
      await streamSSE("/api/agent/live", { phase: "discover", url, notes }, (e) => {
        switch (e.event) {
          case "step":
            pushStep(e as unknown as StepEntry);
            break;
          case "output":
            if (e.node === "profile_business") setProfile(e.profile as Record<string, unknown>);
            break;
          case "pause": {
            const opps = e.opportunities as Opportunity[];
            setOpportunities(opps);
            setProfile((e.profile as Record<string, unknown>) ?? null);
            setSelected(new Set(opps.map((o) => o.id))); // default: all selected
            setPhase("choosing");
            break;
          }
          case "error":
            setError(String(e.message));
            setPhase("error");
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function buildWorkflow() {
    const chosen = opportunities.filter((o) => selected.has(o.id));
    if (chosen.length === 0) return;
    setError(null);
    setSteps([]);
    setPhase("building");
    try {
      await streamSSE("/api/agent/live", { phase: "build", opportunities: chosen }, (e) => {
        switch (e.event) {
          case "step":
            pushStep(e as unknown as StepEntry);
            break;
          case "workflow":
            setWorkflow(e.workflow);
            setArchetype(String(e.archetype));
            setTopOpp(e.topOpportunity as Opportunity);
            break;
          case "done":
            setPhase("done");
            break;
          case "error":
            setError(String(e.message));
            setPhase("error");
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const next: ChatMsg[] = [...chat, { role: "user", content: text }];
    setChat([...next, { role: "assistant", content: "" }]);
    setChatInput("");
    setChatBusy(true);
    try {
      await streamSSE(
        "/api/agent/chat",
        { messages: next, profile, opportunities },
        (e) => {
          if (e.event === "delta") {
            setChat((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + String(e.text) };
              }
              return copy;
            });
          } else if (e.event === "error") {
            setChat((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "assistant", content: `⚠ ${String(e.message)}` };
              return copy;
            });
          }
        },
      );
    } catch (err) {
      setChat((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `⚠ ${err instanceof Error ? err.message : String(err)}`,
        };
        return copy;
      });
    } finally {
      setChatBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const stepsRunning = phase === "discovering" || phase === "building";

  return (
    <main className="shell">
      {phase === "idle" && (
        <div className="card card--pad-lg rise">
          <span className="eyebrow">Live discovery</span>
          <h1 style={{ marginTop: "0.25rem" }}>Run an interactive discovery</h1>
          <p className="meta">
            Watch each step run, choose which opportunities to pursue, talk through the stack, then
            generate a ready-to-import n8n workflow.
          </p>
          <label className="field">
            <span>Client URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Pain-point notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. month-end close takes 12 days with 40+ manual reconciliation steps"
            />
          </label>
          <button className="btn-primary" onClick={() => void startDiscovery()}>
            Start discovery
          </button>
        </div>
      )}

      {phase !== "idle" && (
        <div className="live-grid">
          {/* Process stream */}
          <div className="card card--pad-lg">
            <span className="eyebrow">Process</span>
            <ol className="stepper">
              {steps.map((s, i) => (
                <li key={`${s.node}-${i}`} className={`step step--${s.status === "done" ? "done" : "active"}`}>
                  <span className="step__dot">{s.status === "done" ? "✓" : "…"}</span>
                  <span>{s.label}</span>
                  {s.durationMs != null && (
                    <span className="step__dur">{(s.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </li>
              ))}
              {stepsRunning && steps.length === 0 && <li className="step step--active"><span className="step__dot">…</span><span>Starting…</span></li>}
            </ol>

            {profile && (
              <details style={{ marginTop: "1rem" }} open>
                <summary>Business profile</summary>
                <div className="meta" style={{ marginTop: "0.5rem" }}>
                  <strong>{String((profile as Record<string, unknown>).name ?? "")}</strong>
                  {", "}
                  {String((profile as Record<string, unknown>).industry ?? "")}
                  <p>{String((profile as Record<string, unknown>).description ?? "")}</p>
                </div>
              </details>
            )}

            {error && <p role="alert" style={{ marginTop: "1rem" }}>{error}</p>}
          </div>

          {/* Right column: choices / chat / result */}
          <div className="live-col">
            {phase === "choosing" && (
              <>
                <div className="card card--pad-lg">
                  <span className="eyebrow">Your call</span>
                  <h2 style={{ marginTop: "0.25rem" }}>Which opportunities should we pursue?</h2>
                  <p className="meta">
                    Select the ones to take forward. The top-ranked selection becomes the n8n
                    workflow.
                  </p>
                  <div className="opp-list">
                    {opportunities.map((o) => (
                      <label key={o.id} className={`opp-card ${selected.has(o.id) ? "opp-card--on" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selected.has(o.id)}
                          onChange={() => toggle(o.id)}
                        />
                        <div>
                          <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem" }}>
                            <strong>{o.title}</strong>
                            <span className={`badge badge--${o.quadrant}`}>
                              {QUADRANT_LABEL[o.quadrant] ?? o.quadrant}
                            </span>
                          </div>
                          <p className="meta">{o.description}</p>
                          <p className="meta">
                            {o.pillar} · impact {o.impactScore}/5 · effort {o.effortScore}/5
                            {o.roiEstimate ? ` · ${o.roiEstimate}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => void buildWorkflow()}
                    disabled={selected.size === 0}
                    style={{ marginTop: "1rem" }}
                  >
                    Continue with {selected.size} selected →
                  </button>
                </div>

                {/* Stack conversation */}
                <div className="card card--pad-lg">
                  <span className="eyebrow">Talk through the stack</span>
                  <p className="meta">
                    Ask why a tool was picked, compare options, or push back. Answers stay within
                    NorthBound&apos;s catalog.
                  </p>
                  <div className="chat-log">
                    {chat.length === 0 && (
                      <p className="meta">
                        e.g. &ldquo;Why n8n over Power Automate here?&rdquo; · &ldquo;What would the
                        full stack look like?&rdquo;
                      </p>
                    )}
                    {chat.map((m, i) => (
                      <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                        {m.content || (m.role === "assistant" ? "…" : "")}
                      </div>
                    ))}
                  </div>
                  <div className="row" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void sendChat();
                      }}
                      placeholder="Ask about the stack…"
                      disabled={chatBusy}
                    />
                    <button className="btn-ghost" onClick={() => void sendChat()} disabled={chatBusy}>
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}

            {phase === "building" && (
              <div className="card card--pad-lg">
                <span className="eyebrow">Building</span>
                <p className="meta">Mapping tools and generating the n8n workflow…</p>
              </div>
            )}

            {phase === "done" && workflow != null && (
              <div className="card card--pad-lg rise">
                <span className="eyebrow">Ready</span>
                <h2 style={{ marginTop: "0.25rem" }}>{topOpp?.title ?? "n8n workflow"}</h2>
                <p className="meta">
                  Archetype: <strong>{archetype}</strong> · validated JSON, imports into n8n 1.88.0
                  with credential placeholders.
                </p>
                <N8nActions workflow={workflow} filename="scout-workflow" />
                <details style={{ marginTop: "0.75rem" }}>
                  <summary>View workflow JSON</summary>
                  <pre>{JSON.stringify(workflow, null, 2)}</pre>
                </details>
                {topOpp && topOpp.toolIds.length > 0 && (
                  <p className="meta" style={{ marginTop: "0.75rem" }}>
                    Tools: {topOpp.toolIds.join(", ")}
                  </p>
                )}
                <button
                  className="btn-ghost"
                  style={{ marginTop: "1rem" }}
                  onClick={() => setPhase("choosing")}
                >
                  ← Back to opportunities
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
