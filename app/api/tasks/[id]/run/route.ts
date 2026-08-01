import { NextRequest, NextResponse } from "next/server";
import { getAgent, getTask, insertMessage, updateTask } from "@/lib/crm";
import { runAgentTurn } from "@/lib/agent/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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

  await updateTask(task.id, { status: "running" });

  // The task assignment lands in the shared chat so every participant sees it,
  // then the assignee executes it as a normal agent turn.
  const userMessage = await insertMessage({
    role: "user",
    content: `📋 Task #${task.id} assigned to ${agent.name}: "${task.title}"${task.description ? ` — ${task.description}` : ""}\nComplete it now with your tools, then report the outcome.`,
  });

  const result = await runAgentTurn(agent);
  const agentMessage = await insertMessage({
    role: "agent",
    agent_id: agent.id,
    content: result.text,
    trace: result.trace,
    is_error: result.isError,
  });

  const updated = await updateTask(task.id, {
    status: result.isError ? "failed" : "done",
    result: result.text,
  });

  return NextResponse.json({ task: updated, userMessage, agentMessage });
}
