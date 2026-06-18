import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function HowItWorksPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="shell">
      <div className="rise" style={{ marginBottom: "1.75rem" }}>
        <span className="eyebrow">About Scout</span>
        <h1>How it works</h1>
        <p className="lead">
          Scout turns a client website into a consulting deliverable. Paste a URL and Scout
          scrapes the site, profiles the business, ranks automation opportunities against
          NorthBound&apos;s 43-tool catalog, and produces a ready-to-present report.
        </p>
      </div>

      <div className="stack">
        <section className="rise">
          <h2>The pipeline</h2>
          <p className="meta">Each discovery runs through 12 nodes in sequence. The full run takes roughly 60–90 seconds.</p>
          <div className="grid-2" style={{ marginTop: "1rem" }}>
            {[
              { step: "01", title: "Scrape", desc: "Jina Reader fetches the public website. Falls back to direct fetch with main-content extraction." },
              { step: "02", title: "Profile business", desc: "Identifies company name, industry, size, primary services, technology signals, and evidence snippets." },
              { step: "03", title: "Identify opportunities", desc: "Finds 3-6 automation opportunities mapped to NorthBound's four delivery pillars." },
              { step: "04", title: "Score and rank", desc: "Each opportunity is scored on impact (1-5), effort (1-5), and confidence (0-1), then placed in a strategic quadrant." },
              { step: "05", title: "Map tools", desc: "Opportunities are grounded to the 43-tool catalog. No tool outside the catalog is ever recommended." },
              { step: "06", title: "Draft requirements", desc: "A structured requirements brief is written for the top opportunity: scope, constraints, success criteria, stakeholders." },
              { step: "07", title: "Solution design", desc: "High-level architecture: components, integration points, data flows, and risk mitigations." },
              { step: "08", title: "Generate workflow", desc: "A valid, importable n8n workflow JSON is produced using pattern-matched archetypes from the catalog." },
              { step: "09", title: "Discovery questions", desc: "5-8 targeted questions for the first client meeting, derived from evidence gaps in the scraped content." },
              { step: "10", title: "Write playbook", desc: "An editable markdown playbook covering engagement sequence, risks, and tool mappings." },
              { step: "11", title: "Critique", desc: "A self-review pass checks for grounding violations, weak evidence, and missing context." },
              { step: "12", title: "Finalize", desc: "The report is published and a readiness snapshot (data, tools, change, budget) is produced." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="opp">
                <div className="row" style={{ gap: "0.6rem", marginBottom: "0.4rem" }}>
                  <span className="badge badge--tint">{step}</span>
                  <h3 style={{ margin: 0 }}>{title}</h3>
                </div>
                <p className="meta" style={{ margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rise">
          <h2>Three ways to run a discovery</h2>
          <div className="stack" style={{ marginTop: "1rem" }}>
            <div className="opp">
              <h3>Interactive live mode</h3>
              <p className="meta">
                Go to Discovery and click &quot;Run an interactive live discovery&quot;. Scout streams each node in
                real time, pauses on the ranked opportunities so you can pick and discuss the stack, then
                continues to the n8n workflow with download and import actions.
              </p>
            </div>
            <div className="opp">
              <h3>Autonomous mode</h3>
              <p className="meta">
                Paste a URL in the Discovery form and submit. Scout runs the full 12-node pipeline
                unattended via the Supabase Edge Function. Results appear in your dashboard when complete.
              </p>
            </div>
            <div className="opp">
              <h3>MCP (Claude Desktop)</h3>
              <p className="meta">
                Connect Scout as an MCP server in Claude Desktop. Use the tools{" "}
                <code>scrape_company</code>, <code>get_catalog</code>, and <code>get_report</code> and
                ask Claude to run a full discovery. Claude does the reasoning on your subscription
                tokens; the tools handle data fetching and catalog lookup.
              </p>
            </div>
          </div>
        </section>

        <section className="rise">
          <h2>The output</h2>
          <div className="grid-2" style={{ marginTop: "1rem" }}>
            {[
              { title: "Business profile", desc: "Company name, industry, size, services, and evidence snippets cited directly from the website." },
              { title: "Ranked opportunities", desc: "3-6 opportunities with impact/effort scores, strategic quadrant, ROI estimate, and evidence citations." },
              { title: "Requirements brief", desc: "Business objective, scope in/out, constraints, success criteria, and stakeholder map for the top opportunity." },
              { title: "Solution design", desc: "Architecture, components, integration points, data flows, and risk mitigations." },
              { title: "n8n workflow", desc: "A valid, importable workflow JSON built from catalog-grounded patterns. Download, copy, or open directly in n8n." },
              { title: "Implementation playbook", desc: "Phased engagement sequence, key risks, and tool mappings. Editable in the report view before sharing." },
            ].map(({ title, desc }) => (
              <div key={title} className="opp">
                <h3 style={{ margin: "0 0 0.4rem" }}>{title}</h3>
                <p className="meta" style={{ margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rise">
          <h2>Grounding and accuracy</h2>
          <p className="meta">
            Every tool recommendation is constrained to the 43-tool catalog visible under Tool catalog.
            Scout never proposes a tool outside the catalog. All opportunity evidence is cited directly
            from the scraped website text. The n8n workflow is validated against known node schemas
            before the report is published. Confidence scores reflect how strongly the website text
            supports each opportunity.
          </p>
        </section>

        <section className="rise">
          <h2>Infrastructure</h2>
          <p className="meta">
            Scout runs on Supabase Free and Vercel Hobby. The 12-node pipeline runs on Supabase Edge
            Functions with Postgres checkpointing for durability. Each node writes its state before
            chaining to the next, so interrupted runs recover automatically. The only marginal cost is
            Claude API tokens: roughly $0.10-$0.30 per run.
          </p>
        </section>
      </div>
    </main>
  );
}
