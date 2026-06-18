import { describe, it, expect } from "vitest";
import { makeSSEDecoder } from "./sse";

describe("makeSSEDecoder", () => {
  it("parses whole frames", () => {
    const out: Record<string, unknown>[] = [];
    const feed = makeSSEDecoder((e) => out.push(e));
    feed(`data: ${JSON.stringify({ event: "step", node: "a" })}\n\n`);
    expect(out).toEqual([{ event: "step", node: "a" }]);
  });

  it("buffers frames split across chunks", () => {
    const out: Record<string, unknown>[] = [];
    const feed = makeSSEDecoder((e) => out.push(e));
    feed('data: {"event":"de');
    feed('lta","text":"hi"}\n');
    expect(out).toHaveLength(0); // incomplete: only one newline so far
    feed("\n");
    expect(out).toEqual([{ event: "delta", text: "hi" }]);
  });

  it("handles multiple frames in one chunk and skips malformed", () => {
    const out: Record<string, unknown>[] = [];
    const feed = makeSSEDecoder((e) => out.push(e));
    feed('data: {"event":"a"}\n\ndata: not-json\n\ndata: {"event":"b"}\n\n');
    expect(out).toEqual([{ event: "a" }, { event: "b" }]);
  });
});
