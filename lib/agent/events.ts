import { ChatMessage, Proposal } from "../types";

/**
 * Events streamed from a run (chat turn or task run) to the browser over SSE.
 * Shared by the server routes and the client reader in lib/stream.ts, so this
 * module must stay free of server-only imports.
 */
export type RunEvent =
  | { type: "user_message"; message: ChatMessage }
  | { type: "routed"; agentId: number; agentName: string; agentEmoji: string }
  | { type: "handoff"; fromName: string; toName: string }
  | { type: "agent_start"; agentId: number; agentName: string; agentEmoji: string }
  | { type: "text"; agentId: number; delta: string }
  | { type: "tool_start"; agentId: number; index: number; tool: string; input: unknown }
  | {
      type: "tool_end";
      agentId: number;
      index: number;
      tool: string;
      ok: boolean;
      ms: number;
      isWrite: boolean;
      /** Same truncated preview stored in the trace, so a stopped run keeps its receipts. */
      result: string;
    }
  | { type: "message"; message: ChatMessage; undoable?: number; proposals?: Proposal[] }
  | { type: "error"; message: string }
  | { type: "done" };

export type EmitFn = (event: RunEvent) => void;

const encoder = new TextEncoder();

export function sseEncode(event: RunEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Wrap a run in a Server-Sent Events response. The run is aborted when the
 * client disconnects (request signal) or cancels the response body, so a
 * "Stop" in the UI unwinds the tool loop instead of orphaning it.
 */
export function sseResponse(
  req: Request,
  run: (emit: EmitFn, signal: AbortSignal) => Promise<void>
): Response {
  const aborter = new AbortController();
  const onRequestAbort = () => aborter.abort();
  req.signal?.addEventListener("abort", onRequestAbort);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: EmitFn = (event) => {
        try {
          controller.enqueue(sseEncode(event));
        } catch {
          // The consumer went away mid-run; the abort handler tears the rest down.
        }
      };
      try {
        await run(emit, aborter.signal);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        req.signal?.removeEventListener("abort", onRequestAbort);
        emit({ type: "done" });
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      aborter.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
