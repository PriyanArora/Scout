// Pure helpers for run lease timing and stale-write detection.
// These wrap the business rules; actual DB calls go through supabase.rpc().

export interface RunLeaseFields {
  node_execution_id: string | null;
  lease_until: string | null;
  locked_by: string | null;
}

export function isLeaseExpired(run: RunLeaseFields, nowMs: number = Date.now()): boolean {
  if (!run.lease_until) return true;
  return new Date(run.lease_until).getTime() < nowMs;
}

export function isStaleWrite(run: RunLeaseFields, nodeExecutionId: string): boolean {
  return run.node_execution_id !== nodeExecutionId;
}

export function buildAcquireLeaseParams(
  runId: string,
  lockedBy: string,
  nodeExecutionId: string,
  leaseSeconds: number = 120,
): {
  p_run_id: string;
  p_locked_by: string;
  p_node_execution_id: string;
  p_lease_seconds: number;
} {
  return {
    p_run_id: runId,
    p_locked_by: lockedBy,
    p_node_execution_id: nodeExecutionId,
    p_lease_seconds: leaseSeconds,
  };
}
