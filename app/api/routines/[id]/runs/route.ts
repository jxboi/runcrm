import { NextRequest, NextResponse } from "next/server";
import { getRoutine, listRoutineRuns } from "@/lib/routines";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const routineId = Number(id);
  if (!(await getRoutine(routineId))) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  return NextResponse.json(await listRoutineRuns(routineId));
}
