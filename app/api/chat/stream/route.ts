import { NextRequest, NextResponse } from "next/server";
import { getAgent, getThread, insertMessage, listAgents } from "@/lib/crm";
import { runChain } from "@/lib/agent/chain";
import { sseResponse } from "@/lib/agent/events";
import { parseMentions } from "@/lib/agent/mentions";
import { routeToAgent } from "@/lib/agent/routing";
import { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Streaming counterpart to POST /api/chat.
 *
 * Recipients come from "@Name" mentions when the message has them, otherwise
 * from the agent the user selected, otherwise from auto-routing. They answer in
 * turn — each one re-reads history, so later agents see earlier replies — and
 * any agent may pass the work on with handoff_to_agent.
 *
 * A user "Stop" cancels the response body: the run unwinds and nothing is
 * persisted here, because the client saves the partial it already has.
 */
export async function POST(req: NextRequest) {
  let body: { content?: string; agentId?: number | "auto" | null; threadId?: number; replyToId?: number | null; context?: { workflowId?: number | null } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  const threadId = Number(body.threadId ?? 1);
  const thread = Number.isInteger(threadId) && threadId > 0 ? await getThread(threadId) : null;
  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const agents = await listAgents();
  if (agents.length === 0) {
    return NextResponse.json({ error: "Create an agent before sending a message" }, { status: 400 });
  }

  const mentioned = parseMentions(content, agents);
  const selected =
    body.agentId != null && body.agentId !== "auto" ? await getAgent(Number(body.agentId)) : null;
  if (mentioned.length === 0 && body.agentId !== "auto" && !selected) {
    return NextResponse.json({ error: "Pick an agent to send this message to" }, { status: 400 });
  }

  return sseResponse(req, async (emit, signal) => {
    const userMessage = await insertMessage({
      role: "user",
      thread_id: threadId,
      content,
      reply_to_id: body.replyToId == null ? null : Number(body.replyToId),
    });
    emit({ type: "user_message", message: userMessage });

    let queue: Agent[];
    if (mentioned.length > 0) {
      queue = mentioned.map((id) => agents.find((a) => a.id === id)!).filter(Boolean);
    } else if (selected) {
      queue = [selected];
    } else {
      const routingContent = thread.memory
        ? `Continuation memory:\n${thread.memory}\n\nNew message:\n${content}`
        : content;
      const picked = await routeToAgent(routingContent, agents);
      emit({ type: "routed", agentId: picked.id, agentName: picked.name, agentEmoji: picked.emoji });
      queue = [picked];
    }

    const workflowId = Number(body.context?.workflowId);
    await runChain(queue, emit, signal, thread, {
      workflowId: Number.isInteger(workflowId) && workflowId > 0 ? workflowId : null,
    });
  });
}
