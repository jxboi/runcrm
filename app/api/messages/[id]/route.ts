import { NextRequest, NextResponse } from "next/server";
import { deleteMessage, updateMessage } from "@/lib/crm";
import { MESSAGE_FEEDBACK, MESSAGE_REACTIONS, MessageFeedback, MessageReaction, MessageUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const update: MessageUpdate = {};
  if ("content" in body) {
    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json({ error: "content must be a non-empty string" }, { status: 400 });
    }
    update.content = body.content;
  }
  if ("reaction" in body) {
    if (body.reaction !== null && !MESSAGE_REACTIONS.includes(body.reaction as MessageReaction)) {
      return NextResponse.json({ error: "Unsupported reaction" }, { status: 400 });
    }
    update.reaction = body.reaction as MessageReaction | null;
  }
  if ("pinned" in body) {
    if (typeof body.pinned !== "boolean") return NextResponse.json({ error: "pinned must be a boolean" }, { status: 400 });
    update.pinned = body.pinned;
  }
  if ("starred" in body) {
    if (typeof body.starred !== "boolean") return NextResponse.json({ error: "starred must be a boolean" }, { status: 400 });
    update.starred = body.starred;
  }
  if ("feedback" in body) {
    if (body.feedback !== null && !MESSAGE_FEEDBACK.includes(body.feedback as MessageFeedback)) {
      return NextResponse.json({ error: "Unsupported feedback" }, { status: 400 });
    }
    update.feedback = body.feedback as MessageFeedback | null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No supported message changes were provided" }, { status: 400 });
  }

  const message = await updateMessage(id, update);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json(message);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const deleted = await deleteMessage(Number(rawId));
  if (!deleted) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
