import { NextRequest, NextResponse } from "next/server";
import { getMessage, insertMessage } from "@/lib/crm";
import { undoMessage } from "@/lib/mutations";

export const dynamic = "force-dynamic";

/**
 * Roll back everything one agent message changed. Records that were edited
 * after the agent touched them are left alone and reported back, so an undo
 * never silently discards a later change.
 */
export async function POST(req: NextRequest) {
  let body: { messageId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messageId = Number(body.messageId);
  if (!messageId) return NextResponse.json({ error: "messageId is required" }, { status: 400 });

  const target = await getMessage(messageId);
  if (!target) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const { undone, skipped } = await undoMessage(messageId);
  if (undone.length === 0 && skipped.length === 0) {
    return NextResponse.json({ error: "Nothing left to undo on that message" }, { status: 409 });
  }

  const who = target.agent_name ?? "an agent";
  const parts = [
    undone.length ? `Undid ${undone.length} change${undone.length === 1 ? "" : "s"} from ${who}: ${undone.join("; ")}.` : "",
    skipped.length ? `Left alone: ${skipped.join("; ")}.` : "",
  ].filter(Boolean);

  const note = await insertMessage({ role: "user", thread_id: target.thread_id, content: `↩ ${parts.join(" ")}` });
  return NextResponse.json({ undone, skipped, note, message: await getMessage(messageId) });
}
