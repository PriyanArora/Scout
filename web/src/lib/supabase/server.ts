import { createServerClient } from "@supabase/ssr";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import type { Database } from "../db-types.js";

export function createSupabaseServer(cookies: ReadonlyRequestCookies) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase env vars not configured");

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookies.getAll();
      },
      setAll() {
        // Response cookies set via middleware
      },
    },
  });
}

export function createSupabaseServiceRole() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Service role env vars not configured");

  // Direct REST client — bypasses RLS for internal operations
  return {
    url,
    key,
    async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`RPC ${fn} → ${res.status}: ${text}`);
      return (text ? JSON.parse(text) : null) as T;
    },
    async insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`INSERT ${table} → ${res.status}: ${text}`);
      const rows = JSON.parse(text) as T[];
      return rows[0] as T;
    },
    async query<T>(table: string, params: Record<string, string>): Promise<T[]> {
      const q = new URLSearchParams(params);
      const res = await fetch(`${url}/rest/v1/${table}?${q}`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`GET ${table} → ${res.status}: ${text}`);
      return JSON.parse(text) as T[];
    },
  };
}
