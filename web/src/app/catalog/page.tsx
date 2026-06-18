import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

// Read-only browse of the org-scoped grounding catalog (43 tools). Scout only
// ever recommends tools that live here.
// ponytail: read-only — editing the catalog stays in SQL/seed; add CRUD here
// only if consultants need to manage it from the UI.
export default async function CatalogPage() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  type Tool = { id: string; name: string; category: string; pillars: string[]; what_it_does: string };
  const { data: tools } = await supabase
    .from("tools")
    .select("id,name,category,pillars,what_it_does")
    .eq("enabled", true)
    .order("category");

  const list = (tools ?? []) as Tool[];
  const byCategory = new Map<string, typeof list>();
  for (const t of list) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  return (
    <main className="shell">
      <div className="rise" style={{ marginBottom: "1.75rem" }}>
        <span className="eyebrow">Grounding catalog</span>
        <h1>Tool catalog <span className="dim">({list.length})</span></h1>
        <p className="lead">
          Every recommendation Scout makes is grounded in this catalog. It will never propose a tool
          that isn&apos;t listed here. Each opportunity is mapped to a primary tool plus alternatives.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          No tools loaded. The catalog is seeded into Supabase on deploy (43 tools). Run the seed step and refresh.
        </div>
      ) : (
        <div className="stack">
          {[...byCategory.entries()].map(([category, items]) => (
            <section key={category} className="rise">
              <h2>{category}</h2>
              <div className="grid-2">
                {items.map((t) => (
                  <div key={t.id} className="opp">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <h3 style={{ margin: 0 }}>{t.name}</h3>
                    </div>
                    <p className="dim" style={{ margin: "0.4rem 0 0.6rem" }}>{t.what_it_does}</p>
                    <div className="opp__badges">
                      {(t.pillars ?? []).map((p) => (
                        <span key={p} className="badge badge--tint pillar" data-pillar={p}>{p}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
