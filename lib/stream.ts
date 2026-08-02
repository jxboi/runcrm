import { RunEvent } from "./agent/events";

/**
 * POST to an SSE endpoint and deliver each event as it arrives. Resolves when
 * the stream ends; rejects on a non-OK response. Aborting the signal stops
 * reading — the caller owns whatever partial state it collected.
 */
export async function streamRun(
  url: string,
  body: unknown,
  onEvent: (event: RunEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    throw new Error((problem as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  }
  if (!res.body) throw new Error("The server returned an empty stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .find((line) => line.startsWith("data:"))
          ?.slice(5)
          .trim();
        if (data) {
          try {
            onEvent(JSON.parse(data) as RunEvent);
          } catch {
            // Ignore a malformed frame rather than killing the whole run.
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
