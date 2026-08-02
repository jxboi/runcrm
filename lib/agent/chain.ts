import { getAgent, insertMessage } from "../crm";
import { linkMutationsToMessage } from "../mutations";
import { linkProposalsToMessage, listProposalsForMessage } from "../proposals";
import { Agent } from "../types";
import { EmitFn } from "./events";
import { runAgentTurn } from "./runner";

/** How many times work may be passed on before we stop the chain. */
const MAX_HANDOFFS = 2;

export interface ChainOutcome {
  /** The last reply produced, used for a task's stored result. */
  text: string;
  isError: boolean;
}

/**
 * Run each agent in turn, following any handoffs they request.
 *
 * Every turn re-reads the chat history, so a later agent sees what earlier ones
 * said. An agent answers at most once per message, which bounds the chain and
 * stops two agents bouncing work back and forth.
 */
export async function runChain(
  queue: Agent[],
  emit: EmitFn,
  signal: AbortSignal
): Promise<ChainOutcome> {
  const answered = new Set(queue.map((a) => a.id));
  const pending = [...queue];
  let handoffs = 0;
  let outcome: ChainOutcome = { text: "", isError: false };

  while (pending.length > 0) {
    const agent = pending.shift()!;
    emit({ type: "agent_start", agentId: agent.id, agentName: agent.name, agentEmoji: agent.emoji });

    const result = await runAgentTurn(agent, { signal, onEvent: emit });
    if (signal.aborted) return outcome;

    const message = await insertMessage({
      role: "agent",
      agent_id: agent.id,
      content: result.text,
      trace: result.trace,
      is_error: result.isError,
    });
    // Journal rows and proposals exist before the message does, so link them
    // now — that is what makes this reply undoable, and its proposals visible.
    await linkMutationsToMessage(result.mutationIds, message.id);
    await linkProposalsToMessage(result.proposalIds, message.id);
    emit({
      type: "message",
      message,
      undoable: result.mutationIds.length,
      proposals: result.proposalIds.length > 0 ? await listProposalsForMessage(message.id) : [],
    });
    outcome = { text: result.text, isError: result.isError };

    const next = result.handoff;
    if (!next || handoffs >= MAX_HANDOFFS || answered.has(next.agentId)) continue;

    const target = await getAgent(next.agentId);
    if (!target) continue;

    handoffs++;
    answered.add(target.id);

    // The brief lands in the shared chat under the delegating agent's name, so
    // the target picks it up from history and the user can see the handoff.
    const note = await insertMessage({
      role: "agent",
      agent_id: agent.id,
      content: `→ @${target.name}: ${next.instructions}`,
    });
    emit({ type: "message", message: note });
    emit({ type: "handoff", fromName: agent.name, toName: target.name });

    pending.push(target);
  }

  return outcome;
}
