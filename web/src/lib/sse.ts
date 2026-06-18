// Tiny push-decoder for `data: {...}\n\n` SSE frames. EventSource is GET-only,
// so the live UI reads POST response bodies and feeds chunks here. Frames can
// split across network chunks — the decoder buffers until a full `\n\n`.

export function makeSSEDecoder(
  onEvent: (data: Record<string, unknown>) => void,
): (chunk: string) => void {
  let buf = "";
  return (chunk: string) => {
    buf += chunk;
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
      } catch {
        /* ignore malformed frame */
      }
    }
  };
}
