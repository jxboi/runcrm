import { NextRequest, NextResponse } from "next/server";
import { getThread, insertMessage, listMessages } from "@/lib/crm";
import { TraceEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const threadId = Number(req.nextUrl.searchParams.get("threadId") ?? 1);
  if (!Number.isInteger(threadId) || threadId < 1 || !(await getThread(threadId))) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  return NextResponse.json(await listMessages(200, threadId));
}

/**
 * Append a message to the shared chat. Used by the client to persist the
 * partial reply it streamed when the user stops a run mid-flight — the server
 * deliberately skips persisting in that case, so there is exactly one writer.
 */
export async function POST(req: NextRequest) {
  let body: {
    role?: string;
    agent_id?: number | null;
    content?: string;
    trace?: TraceEntry[];
    is_error?: boolean;
    thread_id?: number;
    reply_to_id?: number | null;
    forwarded_from_id?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  if (body.role !== "user" && body.role !== "agent") {
    return NextResponse.json({ error: 'role must be "user" or "agent"' }, { status: 400 });
  }
  const threadId = Number(body.thread_id ?? 1);
  if (!Number.isInteger(threadId) || threadId < 1 || !(await getThread(threadId))) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json(
    await insertMessage({
      role: body.role,
      thread_id: threadId,
      agent_id: body.agent_id ?? null,
      content,
      trace: Array.isArray(body.trace) ? body.trace : [],
      is_error: Boolean(body.is_error),
      reply_to_id: body.reply_to_id == null ? null : Number(body.reply_to_id),
      forwarded_from_id: body.forwarded_from_id == null ? null : Number(body.forwarded_from_id),
    }),
    { status: 201 }
  );
}
