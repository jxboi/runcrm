import Anthropic from "@anthropic-ai/sdk";
import { listAgents, listMessages } from "../crm";
import { Agent, ENTITIES, TraceEntry } from "../types";
import { executeTool, toolsForAgent } from "./tools";

// Resolves credentials from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login` profile.
const client = new Anthropic();

const MAX_ITERATIONS = 12;

export interface AgentTurnResult {
  text: string;
  trace: TraceEntry[];
  isError: boolean;
}

async function buildSystemPrompt(agent: Agent): Promise<string> {
  const roster = (await listAgents())
    .map((a) => `- ${a.emoji} ${a.name} (agent id ${a.id})${a.id === agent.id ? " ← you" : ""}`)
    .join("\n");
  const caps = ENTITIES.map((e) => `- ${e}: ${agent.capabilities[e]}`).join("\n");

  return `You are ${agent.name}, an AI agent working inside RunCRM, a small CRM shared by a human user and several agents.

You operate in a group chat. Messages from the human are prefixed "[User]" and messages from other agents are prefixed "[Their Name]". Your own past replies appear unprefixed. Reply as yourself — never write a "[Name]" prefix yourself.

Your access rights (enforced server-side):
${caps}

Agents in this workspace:
${roster}

Rules:
- Use your tools for anything involving CRM data. Never invent records, ids, or numbers — look them up.
- Before creating a record, check whether it already exists.
- After changing data, state exactly what you did (record names, ids, values).
- If asked to do something outside your access rights, say plainly which permission you lack instead of attempting it.
- Keep replies short and useful. Plain text only — no markdown tables or headers.

Your operator instructions:
${agent.instructions || "(none)"}

Today's date: ${new Date().toISOString().slice(0, 10)}`;
}

async function buildHistory(agent: Agent): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const recent = (await listMessages(200)).slice(-60);
  const history: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of recent) {
    if (m.role === "agent" && m.agent_id === agent.id) {
      history.push({ role: "assistant", content: m.content });
    } else {
      const label = m.role === "user" ? "[User]" : `[${m.agent_name ?? "Agent"}]`;
      history.push({ role: "user", content: `${label} ${m.content}` });
    }
  }
  // The API requires the first message to be a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  return history;
}

/**
 * Run one agent turn against the current chat history (the latest user message
 * must already be persisted). Executes the tool-use loop until the agent
 * produces a final text reply.
 */
export async function runAgentTurn(agent: Agent): Promise<AgentTurnResult> {
  const trace: TraceEntry[] = [];
  const tools = toolsForAgent(agent);
  const system = await buildSystemPrompt(agent);
  const messages = await buildHistory(agent);

  if (messages.length === 0) {
    return { text: "There's nothing in the chat for me to respond to yet.", trace, isError: false };
  }

  // Server-side refusal fallback is recommended for claude-opus-5; other
  // models have different allowed fallback targets, so only attach it there.
  const isOpus5 = agent.model === "claude-opus-5";

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.beta.messages.create({
        model: agent.model,
        max_tokens: 16000,
        ...(isOpus5
          ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] }
          : {}),
        ...(agent.model.startsWith("claude-haiku") ? {} : { output_config: { effort: "medium" } }),
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: tools as Anthropic.Beta.BetaTool[],
        messages,
      });

      if (response.stop_reason === "refusal") {
        return {
          text: "I can't help with that request. (The model declined it for safety reasons.)",
          trace,
          isError: true,
        };
      }

      // Server-side pause: append the assistant turn and continue.
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
      );

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { text: text || "(no reply)", trace, isError: false };
      }

      messages.push({ role: "assistant", content: response.content });

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(toolUses.map(async (tu) => {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        const { result, ok } = await executeTool(agent, tu.name, input);
        trace.push({ tool: tu.name, input, result: result.slice(0, 800), ok });
        return { type: "tool_result", tool_use_id: tu.id, content: result, is_error: !ok };
      }));

      messages.push({ role: "user", content: results });
    }

    return {
      text: `I stopped after ${MAX_ITERATIONS} tool-use rounds without finishing. Here's where I got:\n${trace
        .map((t) => `- ${t.tool} ${t.ok ? "✓" : "✗"}`)
        .join("\n")}`,
      trace,
      isError: true,
    };
  } catch (err) {
    return { text: describeError(err), trace, isError: true };
  }
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "I couldn't reach the Claude API: no valid credentials. Add ANTHROPIC_API_KEY=sk-ant-... to .env.local and restart the dev server.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The Claude API rate limit was hit. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "I couldn't connect to the Claude API. Check your network connection.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API error (${err.status}): ${err.message}`;
  }
  return `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
}
