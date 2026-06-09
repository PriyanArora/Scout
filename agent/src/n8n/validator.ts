import type { N8nWorkflow, ValidationResult } from "./types.js";

const PLACEHOLDER_RE = /__[A-Z0-9_]+__/;

function scanForUnresolved(value: unknown, path: string, found: string[]): void {
  if (typeof value === "string") {
    const match = value.match(/__([A-Z0-9_]+)__/g);
    if (match) {
      for (const m of match) {
        found.push(`${path}: unresolved placeholder ${m}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanForUnresolved(value[i], `${path}[${i}]`, found);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      scanForUnresolved(v, `${path}.${k}`, found);
    }
  }
}

export function validateWorkflow(workflow: unknown): ValidationResult {
  const errors: string[] = [];

  if (!workflow || typeof workflow !== "object") {
    return { valid: false, errors: ["workflow is not an object"] };
  }

  const w = workflow as Partial<N8nWorkflow>;

  if (!w.name || typeof w.name !== "string" || w.name.trim() === "") {
    errors.push("workflow.name is missing or empty");
  }

  if (!Array.isArray(w.nodes) || w.nodes.length === 0) {
    errors.push("workflow.nodes must be a non-empty array");
  } else {
    const nodeNames = new Set<string>();
    for (let i = 0; i < w.nodes.length; i++) {
      const node = w.nodes[i];
      if (!node || typeof node !== "object") {
        errors.push(`nodes[${i}]: not an object`);
        continue;
      }
      if (!node.id || typeof node.id !== "string") {
        errors.push(`nodes[${i}]: missing id`);
      } else if (PLACEHOLDER_RE.test(node.id)) {
        errors.push(`nodes[${i}]: id is still a placeholder: ${node.id}`);
      }
      if (!node.name || typeof node.name !== "string") {
        errors.push(`nodes[${i}]: missing name`);
      } else {
        if (nodeNames.has(node.name)) {
          errors.push(`nodes[${i}]: duplicate node name "${node.name}"`);
        }
        nodeNames.add(node.name);
      }
      if (!node.type || typeof node.type !== "string") {
        errors.push(`nodes[${i}]: missing type`);
      }
      if (typeof node.typeVersion !== "number" || node.typeVersion < 1) {
        errors.push(`nodes[${i}]: typeVersion must be >= 1`);
      }
      if (!Array.isArray(node.position) || node.position.length !== 2) {
        errors.push(`nodes[${i}]: position must be [x, y]`);
      }
      if (!node.parameters || typeof node.parameters !== "object") {
        errors.push(`nodes[${i}]: parameters must be an object`);
      }
    }

    if (w.connections && typeof w.connections === "object") {
      for (const [connFrom, targets] of Object.entries(w.connections)) {
        if (!nodeNames.has(connFrom)) {
          errors.push(`connections: source node "${connFrom}" not in nodes`);
        }
        if (!targets || !Array.isArray(targets.main)) continue;
        for (const output of targets.main) {
          for (const target of output) {
            if (!nodeNames.has(target.node)) {
              errors.push(`connections: target node "${target.node}" not in nodes`);
            }
          }
        }
      }
    }
  }

  if (!w.connections || typeof w.connections !== "object") {
    errors.push("workflow.connections must be an object");
  }

  // Check no unresolved placeholders remain in parameters
  if (Array.isArray(w.nodes)) {
    const unresolvedErrors: string[] = [];
    for (let i = 0; i < w.nodes.length; i++) {
      scanForUnresolved(w.nodes[i]!.parameters, `nodes[${i}].parameters`, unresolvedErrors);
    }
    errors.push(...unresolvedErrors);
  }

  return { valid: errors.length === 0, errors };
}
