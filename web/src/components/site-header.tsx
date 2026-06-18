"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const isPublic = pathname.startsWith("/share") || pathname === "/login";

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href={isPublic ? "#" : "/dashboard"} className="brand">
          Scout
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
              <Link href="/how-it-works" aria-current={pathname.startsWith("/how-it-works") ? "page" : undefined}>
                How it works
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
