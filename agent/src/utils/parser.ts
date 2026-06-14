import type { ZodTypeAny } from "zod";
import { jsonrepair } from "jsonrepair";

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public readonly code: "NO_JSON" | "PARSE_ERROR" | "VALIDATION_ERROR",
    public readonly raw: string,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

const CODE_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

function extractJson(text: string): string {
  const fenced = CODE_FENCE_RE.exec(text);
  if (fenced?.[1]) return fenced[1].trim();

  // Find the first top-level JSON object or array
  const start = text.search(/[{[]/);
  if (start === -1) throw new StructuredOutputError("No JSON found in output", "NO_JSON", text);
  return text.slice(start);
}

export function parseStructuredOutput<T>(text: string, schema: ZodTypeAny): T {
  let jsonText: string;
  try {
    jsonText = extractJson(text);
  } catch (err) {
    if (err instanceof StructuredOutputError) throw err;
    throw new StructuredOutputError("Failed to extract JSON from output", "NO_JSON", text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Safety net for max_tokens truncations / minor malformations: repair then
    // re-parse before giving up (INTEGRATION_PLAN §3 Wave 1 #7, Decision Log Area E).
    try {
      parsed = JSON.parse(jsonrepair(jsonText));
    } catch {
      throw new StructuredOutputError(
        "JSON.parse failed on extracted text (even after repair)",
        "PARSE_ERROR",
        jsonText,
      );
    }
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new StructuredOutputError(
      `Schema validation failed: ${result.error.message}`,
      "VALIDATION_ERROR",
      jsonText,
    );
  }

  return result.data as T;
}
