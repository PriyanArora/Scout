import type { N8nWorkflow, N8nNode, PlaceholderMap } from "./types.js";

function generateUuid(): string {
  // Use Web Crypto (compatible with Deno and Node 18+)
  return crypto.randomUUID();
}

function fillStringPlaceholders(value: string, map: PlaceholderMap): string {
  return value.replace(/__([A-Z0-9_]+)__/g, (full, key) => {
    const mapKey = `__${key}__`;
    return mapKey in map ? map[mapKey]! : full;
  });
}

function fillValue(value: unknown, map: PlaceholderMap): unknown {
  if (typeof value === "string") return fillStringPlaceholders(value, map);
  if (Array.isArray(value)) return value.map((v) => fillValue(v, map));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = fillValue(v, map);
    }
    return result;
  }
  return value;
}

function reposition(nodes: N8nNode[]): N8nNode[] {
  const X_START = 240;
  const X_STEP = 220;
  const Y = 300;
  return nodes.map((node, i) => ({
    ...node,
    position: [X_START + i * X_STEP, Y] as [number, number],
  }));
}

export function mergeWorkflow(
  template: N8nWorkflow,
  placeholders: PlaceholderMap,
): N8nWorkflow {
  // Assign fresh UUIDs to each node; connections are keyed by node *name* in
  // n8n, so no id remapping is needed for them.
  const nodes: N8nNode[] = template.nodes.map((node) => {
    const merged: N8nNode = {
      ...node,
      id: generateUuid(),
      parameters: fillValue(node.parameters, placeholders) as Record<string, unknown>,
    };
    if (node.credentials) {
      merged.credentials = fillValue(node.credentials, placeholders) as Record<string, { id: string; name: string }>;
    }
    if (node.webhookId) {
      merged.webhookId = generateUuid();
    }
    return merged;
  });

  // Deep-copy connections so the template object is never mutated by callers
  const connections: N8nWorkflow["connections"] = {};
  for (const [fromName, targets] of Object.entries(template.connections)) {
    connections[fromName] = {
      main: targets.main.map((output) =>
        output.map((t) => ({ ...t })),
      ),
    };
  }

  const repositioned = reposition(nodes);

  return {
    ...template,
    nodes: repositioned,
    connections,
    active: false,
  };
}
