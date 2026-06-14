import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseStructuredOutput, StructuredOutputError } from "./parser.js";

const PointSchema = z.object({ x: z.number(), y: z.number() });

describe("parseStructuredOutput", () => {
  it("parses raw JSON", () => {
    const result = parseStructuredOutput<{ x: number; y: number }>('{"x":1,"y":2}', PointSchema);
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it("strips ```json ... ``` code fence", () => {
    const text = '```json\n{"x":3,"y":4}\n```';
    expect(parseStructuredOutput(text, PointSchema)).toEqual({ x: 3, y: 4 });
  });

  it("strips ``` ... ``` code fence without language tag", () => {
    const text = '```\n{"x":5,"y":6}\n```';
    expect(parseStructuredOutput(text, PointSchema)).toEqual({ x: 5, y: 6 });
  });

  it("extracts JSON when preceded by prose", () => {
    const text = 'Here is the output:\n{"x":7,"y":8}';
    expect(parseStructuredOutput(text, PointSchema)).toEqual({ x: 7, y: 8 });
  });

  it("throws NO_JSON when there is no JSON", () => {
    expect(() => parseStructuredOutput("No JSON here at all.", PointSchema)).toThrow(
      StructuredOutputError,
    );
    try {
      parseStructuredOutput("nothing", PointSchema);
    } catch (err) {
      expect((err as StructuredOutputError).code).toBe("NO_JSON");
    }
  });

  it("throws PARSE_ERROR when JSON is malformed", () => {
    try {
      parseStructuredOutput("{bad json}", PointSchema);
    } catch (err) {
      expect((err as StructuredOutputError).code).toBe("PARSE_ERROR");
    }
  });

  it("repairs a max_tokens-truncated array before parsing (jsonrepair safety net)", () => {
    const ItemsSchema = z.array(z.object({ a: z.number() }));
    // Simulates an LLM response cut off mid-array by max_tokens.
    const truncated = '[{"a":1},{"a":2';
    expect(parseStructuredOutput(truncated, ItemsSchema)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("throws VALIDATION_ERROR when schema does not match", () => {
    try {
      parseStructuredOutput('{"x":"not-a-number","y":1}', PointSchema);
    } catch (err) {
      expect((err as StructuredOutputError).code).toBe("VALIDATION_ERROR");
    }
  });
});
