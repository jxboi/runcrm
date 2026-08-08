import { NextRequest, NextResponse } from "next/server";
import { getAgent, getTask, getThread, insertMessage, updateTask } from "@/lib/crm";
import { runChain } from "@/lib/agent/chain";
import { sseResponse } from "@/lib/agent/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { threadId?: number };
  const threadId = Number(body.threadId ?? 1);
  const thread = Number.isInteger(threadId) && threadId > 0 ? await getThread(threadId) : null;
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  const task = await getTask(Number(id));
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.assignee_agent_id == null) {
    return NextResponse.json({ error: "Assign this task to an agent before running it" }, { status: 400 });
  }
  const agent = await getAgent(task.assignee_agent_id);
  if (!agent) return NextResponse.json({ error: "Assigned agent no longer exists" }, { status: 400 });
  if (task.status === "running") {
    return NextResponse.json({ error: "Task is already running" }, { status: 409 });
  }

  return sseResponse(req, async (emit, signal) => {
    await updateTask(task.id, { status: "running" });

    // The task assignment lands in the shared chat so every participant sees it,
    // then the assignee executes it as a normal agent turn.
    const userMessage = await insertMessage({
      role: "user",
      thread_id: thread.id,
      content: `Task #${task.id} assigned to ${agent.name}: "${task.title}"${task.description ? ` — ${task.description}` : ""}\nComplete it now with your tools, then report the outcome.`,
    });
    emit({ type: "user_message", message: userMessage });

    // Same chain as the chat route, so an assignee can hand the task on.
    const outcome = await runChain([agent], emit, signal, thread);

    if (signal.aborted) {
      // Stopped by the user: leave the task re-runnable and let the client
      // persist the partial reply it already streamed.
      await updateTask(task.id, { status: "todo" });
      return;
    }

    await updateTask(task.id, {
      status: outcome.isError ? "failed" : "done",
      result: outcome.text,
    });
  });
}
