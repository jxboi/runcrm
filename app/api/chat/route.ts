import { NextRequest, NextResponse } from "next/server";
import { getAgent, getThread, insertMessage } from "@/lib/crm";
import { runAgentTurn } from "@/lib/agent/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { content?: string; agentId?: number; threadId?: number; replyToId?: number | null };
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

  const agent = body.agentId != null ? await getAgent(Number(body.agentId)) : null;
  if (!agent) return NextResponse.json({ error: "Pick an agent to send this message to" }, { status: 400 });

  const userMessage = await insertMessage({
    role: "user",
    thread_id: threadId,
    content,
    reply_to_id: body.replyToId == null ? null : Number(body.replyToId),
  });
  const result = await runAgentTurn(agent, { thread });
  const agentMessage = await insertMessage({
    role: "agent",
    thread_id: threadId,
    agent_id: agent.id,
    content: result.text,
    trace: result.trace,
    is_error: result.isError,
  });

  return NextResponse.json({ userMessage, agentMessage });
}
