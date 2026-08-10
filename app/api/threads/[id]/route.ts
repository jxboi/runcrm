import { NextRequest, NextResponse } from "next/server";
import { updateThread } from "@/lib/crm";
import { ThreadUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: ThreadUpdate = {};
  if ("title" in body) {
    if (typeof body.title !== "string") {
      return NextResponse.json({ error: "title must be a string" }, { status: 400 });
    }
    update.title = body.title;
  }
  if ("pinned" in body) {
    if (typeof body.pinned !== "boolean") {
      return NextResponse.json({ error: "pinned must be a boolean" }, { status: 400 });
    }
    update.pinned = body.pinned;
  }
  if ("archived" in body) {
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived must be a boolean" }, { status: 400 });
    }
    update.archived = body.archived;
  }
  if ("read" in body) {
    if (typeof body.read !== "boolean") {
      return NextResponse.json({ error: "read must be a boolean" }, { status: 400 });
    }
    update.read = body.read;
  }

  const { id: rawId } = await ctx.params;
  try {
    const thread = await updateThread(Number(rawId), update);
    if (!thread) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    return NextResponse.json(thread);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid conversation update" },
      { status: 400 }
    );
  }
}
