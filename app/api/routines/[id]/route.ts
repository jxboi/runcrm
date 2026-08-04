import { NextRequest, NextResponse } from "next/server";
import { archiveRoutine, updateRoutine } from "@/lib/routines";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const routine = await updateRoutine(Number(id), await req.json());
    if (!routine) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    return NextResponse.json(routine);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const archived = await archiveRoutine(Number(id));
  if (!archived) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
