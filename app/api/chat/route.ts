import { NextRequest, NextResponse } from "next/server";
import { getAgent, insertMessage } from "@/lib/crm";
import { runAgentTurn } from "@/lib/agent/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { content?: string; agentId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Message content is required" }, { status: 400 });

  const agent = body.agentId != null ? getAgent(Number(body.agentId)) : null;
  if (!agent) return NextResponse.json({ error: "Pick an agent to send this message to" }, { status: 400 });

  const userMessage = insertMessage({ role: "user", content });
  const result = await runAgentTurn(agent);
  const agentMessage = insertMessage({
    role: "agent",
    agent_id: agent.id,
    content: result.text,
    trace: result.trace,
    is_error: result.isError,
  });

  return NextResponse.json({ userMessage, agentMessage });
}
