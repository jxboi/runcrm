import { NextRequest, NextResponse } from "next/server";
import { executeRoutineRun } from "@/lib/routine-execution";
import { getThread } from "@/lib/crm";
import { claimRoutineRun, getRoutine, recoverStaleRoutineRuns } from "@/lib/routines";
import { sseResponse } from "@/lib/agent/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { threadId?: number };
  const threadId = Number(body.threadId ?? 1);
  const thread = Number.isInteger(threadId) && threadId > 0 ? await getThread(threadId) : null;
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  await recoverStaleRoutineRuns();
  const routine = await getRoutine(Number(id));
  if (!routine || routine.archived_at) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  try {
    const claimed = await claimRoutineRun(routine, "manual");
    if (!claimed) return NextResponse.json({ error: "Routine is already running" }, { status: 409 });
    return sseResponse(req, async (emit, signal) => {
      await executeRoutineRun(claimed.id, { emit, signal, thread });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run routine" }, { status: 400 });
  }
}
