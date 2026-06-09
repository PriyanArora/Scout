// Supabase PostgREST checkpoint adapter for ScoutGraphState.
// Uses fetch() — compatible with Node.js 18+ and Deno Edge Functions.
// Writes to the langgraph_checkpoints table defined in the P3 migration.

import type { ScoutGraphState } from "./types.js";

export interface CheckpointRecord {
  threadId: string;
  checkpointId: string;
  parentId: string | null;
  state: ScoutGraphState;
}

export class SupabaseCheckpointer {
  readonly #supabaseUrl: string;
  readonly #serviceRoleKey: string;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    if (!supabaseUrl) throw new Error("supabaseUrl is required");
    if (!serviceRoleKey) throw new Error("serviceRoleKey is required");
    this.#supabaseUrl = supabaseUrl.replace(/\/$/, "");
    this.#serviceRoleKey = serviceRoleKey;
  }

  async load(threadId: string): Promise<CheckpointRecord | null> {
    const url = new URL(`${this.#supabaseUrl}/rest/v1/langgraph_checkpoints`);
    url.searchParams.set("thread_id", `eq.${threadId}`);
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), { headers: this.#headers() });
    if (!res.ok) {
      throw new Error(`Checkpoint load failed: ${res.status} ${await res.text()}`);
    }

    const rows = (await res.json()) as Array<{
      checkpoint_id: string;
      parent_checkpoint_id: string | null;
      checkpoint: ScoutGraphState;
    }>;

    if (rows.length === 0) return null;

    const row = rows[0]!;
    return {
      threadId,
      checkpointId: row.checkpoint_id,
      parentId: row.parent_checkpoint_id,
      state: row.checkpoint,
    };
  }

  async save(
    threadId: string,
    checkpointId: string,
    state: ScoutGraphState,
    parentId?: string,
  ): Promise<void> {
    const res = await fetch(`${this.#supabaseUrl}/rest/v1/langgraph_checkpoints`, {
      method: "POST",
      headers: {
        ...this.#headers(),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        thread_id: threadId,
        checkpoint_ns: "",
        checkpoint_id: checkpointId,
        parent_checkpoint_id: parentId ?? null,
        type: "scout",
        checkpoint: state,
        metadata: { nextNode: state.nextNode, step: state.step },
      }),
    });
    if (!res.ok) {
      throw new Error(`Checkpoint save failed: ${res.status} ${await res.text()}`);
    }
  }

  #headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#serviceRoleKey}`,
      apikey: this.#serviceRoleKey,
    };
  }
}
