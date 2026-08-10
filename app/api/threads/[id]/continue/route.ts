import { NextResponse } from "next/server";
import { createContinuationThread, getThread } from "@/lib/crm";
import { summarizeThreadMemory } from "@/lib/thread-memory";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const source = await getThread(id);
  if (!source) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  try {
    const memory = await summarizeThreadMemory(source);
    const thread = await createContinuationThread(source.id, memory);
    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not continue that conversation" },
      { status: 500 }
    );
  }
}
