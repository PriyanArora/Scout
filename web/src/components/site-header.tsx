"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function Compass() {
  // ponytail: inline SVG mark — no icon dependency for one glyph.
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  // Public / unauthenticated surfaces: brand only, no app nav.
  const isPublic = pathname.startsWith("/share") || pathname === "/login";

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href={isPublic ? "#" : "/dashboard"} className="brand">
          <span className="brand__mark"><Compass /></span>
          Scout <span className="brand__sub">· NorthBound Advisory</span>
        </Link>

        {!isPublic && (
          <>
            <nav className="nav">
              <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}>
                Discovery
              </Link>
              <Link href="/catalog" aria-current={pathname.startsWith("/catalog") ? "page" : undefined}>
                Tool catalog
              </Link>
            </nav>
            <span className="site-header__spacer" />
            <button className="btn-ghost" onClick={() => void signOut()}>Sign out</button>
          </>
        )}
      </div>
    </header>
  );
}
