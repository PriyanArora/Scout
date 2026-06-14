// Catalog enum validator — ensures LLM-generated tool IDs are in the grounded catalog.
// The CATALOG_IDS set is derived from the single TS source `../catalog/data.ts`
// (which mirrors agent/catalog.yaml; a drift test keeps them in lockstep).
// Out-of-catalog IDs are a safety invariant: the LLM must only cite tools that
// NorthBound actually uses, preventing hallucinated or off-stack recommendations.

import { CATALOG_TOOLS } from "../catalog/data.js";

export const CATALOG_IDS: ReadonlySet<string> = new Set(CATALOG_TOOLS.map((t) => t.id));

export class CatalogValidationError extends Error {
  constructor(
    message: string,
    public readonly invalidIds: string[],
  ) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

export function assertValidToolIds(
  ids: string[],
  validIds: ReadonlySet<string> = CATALOG_IDS,
): void {
  const invalid = ids.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new CatalogValidationError(
      `Tool IDs not in catalog: ${invalid.join(", ")}`,
      invalid,
    );
  }
}

export function filterValidToolIds(
  ids: string[],
  validIds: ReadonlySet<string> = CATALOG_IDS,
): string[] {
  return ids.filter((id) => validIds.has(id));
}
