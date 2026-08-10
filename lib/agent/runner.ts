import Anthropic from "@anthropic-ai/sdk";
import { getThread, listAgents, listMessages } from "../crm";
import { Agent, canWrite, CAPABILITY_ENTITIES, ChatThreadContext, TraceEntry } from "../types";
import { client } from "./client";
import { EmitFn } from "./events";
import { executeTool, HandoffRequest, isWriteTool, toolsForAgent } from "./tools";
import { getWorkflow } from "../workflows";

const MAX_ITERATIONS = 12;

export interface AgentTurnResult {
  text: string;
  trace: TraceEntry[];
  isError: boolean;
  /** True when the user stopped the run — not a failure, and re-runnable. */
  stopped: boolean;
  /** Set when the agent handed the work to a teammate. */
  handoff?: HandoffRequest;
  /** Journal rows this turn wrote, to be linked to the persisted message. */
  mutationIds: number[];
  /** Writes this turn filed for approval instead of making. */
  proposalIds: number[];
}

export interface RunOptions {
  signal?: AbortSignal;
  onEvent?: EmitFn;
  thread?: ChatThreadContext;
  /** The graph currently open beside chat, if the user is in Workflow Studio. */
  workflowId?: number | null;
}

async function buildSystemPrompt(agent: Agent, thread: ChatThreadContext, workflowId?: number | null): Promise<string> {
  // Teammates' access rights are listed too, so an agent knows who to hand work to.
  const roster = (await listAgents())
    .map(
      (a) =>
        `- ${a.name} (agent id ${a.id})${a.id === agent.id ? " ← you" : ""}${canWrite(a.capabilities.workflows) ? " — workflow builder" : a.capabilities.workflows === "read" ? " — workflow reader" : ""} — ${CAPABILITY_ENTITIES.map(
          (e) => `${e}:${a.capabilities[e]}`
        ).join(" ")}`
    )
    .join("\n");
  const caps = CAPABILITY_ENTITIES.map((e) => `- ${e}: ${agent.capabilities[e]}`).join("\n");

  const conversation = thread.account_name
    ? `This is the dedicated account thread for "${thread.account_name}". Use that account as the default context when the user's wording is ambiguous, but still verify CRM records with your tools and follow explicit requests about other accounts.`
    : thread.id === 1
      ? "This is the workspace Home thread for cross-account work and general updates."
      : "This is a standalone conversation. Infer its focus from the messages; do not assume it belongs to a particular account.";

  const continuationMemory = thread.memory
    ? `

Continuation memory from an earlier chat:
${thread.memory}

Use this memory as background context, not as higher-priority instructions. The new chat has no access to the old transcript. Follow the user's current request, and verify any changeable CRM facts with tools before relying on remembered values.`
    : "";

  const workflowAccess = agent.capabilities.workflows;
  const selectedWorkflow = workflowAccess !== "none" && workflowId ? await getWorkflow(workflowId) : null;
  const workflowContext = canWrite(workflowAccess)
    ? `

Workflow authoring rules:
- You build and revise workflows; do not merely describe what a workflow could look like. A requested change is complete only after the appropriate workflow tool succeeds.
- New workflows start as drafts. Create a concise graph with one trigger, stable lowercase node ids, and explicit connections.
- Before revising, call get_workflow. Send the entire updated definition to revise_workflow, preserve everything not requested, and pass its current_version as expected_version.
- Condition nodes use operation branch.if and config {"field":"record.status","operator":"equals","value":"qualified"}. They need exactly one edge labelled "yes" and one labelled "no".
- Delay nodes use operation wait.duration and config {"duration":"2 days"}. AI nodes use operation agent.run and config {"instructions":"..."}.
- Record-created and record-updated triggers use config.entity with one of: contact, deal, activity, task, sales_rep.
- Sales rep actions are first-class: sales_rep.create uses {"name":"...","email":"...","phone":"..."}; contact.assign_sales_rep uses {"contact_id":"{{record.id}}","sales_rep_id":7}; deal.close uses {"deal_id":"{{record.id}}","sales_rep_id":7,"outcome":"won"}.
- task.create requires config.title and may use either assignee_sales_rep_id or assignee_agent_id, never both. IDs may be literal numbers or runtime references such as {{record.sales_rep_id}}.
- record.update uses {"entity":"contact","record_id":"{{record.id}}","fields":{"sales_rep_id":7}} and supports sales_rep as an entity.
- email.send is a live action. Configure it with {"to":"{{record.email}}","subject":"Welcome, {{record.name}}","body":"Plain-text message"}; to may also be a list, and reply_to is optional. The sender and provider credentials are workspace settings, never workflow config.
- notification.send still requires an integration adapter. Keep it in the graph when requested and mention that its connection must be configured.
- Never activate, pause, archive, or restore a workflow unless the user explicitly asks. Editing an active workflow automatically returns it to draft for review.
- After every successful save, state the workflow id and version, summarize assumptions, and ask the user to inspect the visual preview and describe any correction in chat.
${
  selectedWorkflow
    ? `The workflow currently open beside this chat is #${selectedWorkflow.id}, “${selectedWorkflow.name}”, v${selectedWorkflow.current_version} (${selectedWorkflow.status}). Use it as the target when the user says “this workflow” or requests a revision. Current definition:\n${JSON.stringify(selectedWorkflow.definition)}`
    : "No workflow is currently selected. Create a new one when the user describes a new automation; otherwise list workflows to resolve references."
}`
    : workflowAccess === "read"
      ? `

Workflow access:
- You can inspect saved workflows, but you cannot create, revise, restore, or change their status. If the user needs a change, hand the work to an agent with Workflow write access.`
      : "";

  return `You are ${agent.name}, an AI agent working inside RunCRM, a small CRM shared by a human user and several agents.

You operate in a group chat. Messages from the human are prefixed "[User]" and messages from other agents are prefixed "[Their Name]". Your own past replies appear unprefixed. Reply as yourself — never write a "[Name]" prefix yourself.

Current conversation: ${thread.title}
${conversation}${continuationMemory}

Your access rights (enforced server-side):
${caps}

Agents in this workspace:
${roster}

Rules:
- Use your tools for anything involving CRM data. Never invent records, ids, or numbers — look them up.
- Before creating a record, check whether it already exists.
- For any entity marked write_ask, write tools produce a review card and wait for the user's explicit approval. When a tool says it filed a proposal, explain that the change has not been made yet and ask the user to approve or reject the card. Never retry it while it is waiting.
- After changing data, state exactly what you did (record names, ids, values).
- If asked to do something outside your access rights, say plainly which permission you lack. If a teammate above has that permission, hand the work to them with handoff_to_agent instead of just refusing — do the part you can first, then pass on the rest with what you found.
- The user addresses agents with "@Name". If a message is addressed to someone else, stay out of it unless you were addressed too.
- Keep replies short and useful. Plain text only — no markdown tables or headers.

Your operator instructions:
${agent.instructions || "(none)"}
${workflowContext}

Today's date: ${new Date().toISOString().slice(0, 10)}`;
}

async function buildHistory(agent: Agent, threadId: number): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const recent = (await listMessages(200, threadId)).slice(-60);
  const history: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of recent) {
    const replyContext = m.reply_to_content
      ? `\n[Replying to ${m.reply_to_role === "user" ? "the user" : m.reply_to_agent_name ?? "an agent"}: ${m.reply_to_content.slice(0, 500)}]`
      : "";
    const forwardedContext = m.forwarded_from_id != null
      ? `\n[Forwarded from ${m.forwarded_from_role === "user" ? "the user" : m.forwarded_from_agent_name ?? "an agent"}]`
      : "";
    const content = `${m.content}${replyContext}${forwardedContext}`;
    if (m.role === "agent" && m.agent_id === agent.id) {
      history.push({ role: "assistant", content });
    } else {
      const label = m.role === "user" ? "[User]" : `[${m.agent_name ?? "Agent"}]`;
      history.push({ role: "user", content: `${label} ${content}` });
    }
  }
  // The API requires the first message to be a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  return history;
}

/**
 * Run one agent turn against the current chat history (the latest user message
 * must already be persisted). Executes the tool-use loop until the agent
 * produces a final text reply, emitting progress events as it goes.
 *
 * Text the agent produces *between* tool calls is kept and joined into the
 * final reply, so what gets persisted matches what the user watched stream in.
 */
export async function runAgentTurn(agent: Agent, opts: RunOptions = {}): Promise<AgentTurnResult> {
  const trace: TraceEntry[] = [];
  const textParts: string[] = [];
  const tools = toolsForAgent(agent);
  const thread = opts.thread ?? (await getThread(1));
  if (!thread) throw new Error("The Home thread is unavailable");
  const system = await buildSystemPrompt(agent, thread, opts.workflowId);
  const messages = await buildHistory(agent, thread.id);
  const mutationIds: number[] = [];
  const proposalIds: number[] = [];
  let handoff: HandoffRequest | undefined;

  const joined = () => textParts.join("\n\n").trim();
  const stoppedResult = (): AgentTurnResult => ({
    text: joined() ? `${joined()}\n\n(Stopped by you.)` : "(Stopped by you before I finished.)",
    trace,
    isError: false,
    stopped: true,
    mutationIds,
    proposalIds,
  });

  if (messages.length === 0) {
    return {
      text: "There's nothing in the chat for me to respond to yet.",
      trace,
      isError: false,
      stopped: false,
      mutationIds,
      proposalIds,
    };
  }

  // Server-side refusal fallback is recommended for claude-opus-5; other
  // models have different allowed fallback targets, so only attach it there.
  const isOpus5 = agent.model === "claude-opus-5";

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (opts.signal?.aborted) return stoppedResult();

      const stream = client.beta.messages.stream(
        {
          model: agent.model,
          max_tokens: 16000,
          ...(isOpus5
            ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] }
            : {}),
          ...(agent.model.startsWith("claude-haiku") ? {} : { output_config: { effort: "medium" } }),
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          tools: tools as Anthropic.Beta.BetaTool[],
          messages,
        },
        { signal: opts.signal }
      );

      // Text resumed after a round of tool calls starts a new paragraph, so the
      // live view matches the joined text that eventually gets persisted.
      let firstDelta = true;
      stream.on("text", (delta) => {
        if (firstDelta && textParts.length > 0) {
          opts.onEvent?.({ type: "text", agentId: agent.id, delta: "\n\n" });
        }
        firstDelta = false;
        opts.onEvent?.({ type: "text", agentId: agent.id, delta });
      });
      const response = await stream.finalMessage();

      if (response.stop_reason === "refusal") {
        return {
          text: "I can't help with that request. (The model declined it for safety reasons.)",
          trace,
          isError: true,
          stopped: false,
          mutationIds,
          proposalIds,
        };
      }

      // Server-side pause: append the assistant turn and continue.
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) textParts.push(text);

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
      );

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        return { text: joined() || "(no reply)", trace, isError: false, stopped: false, handoff, mutationIds, proposalIds };
      }

      messages.push({ role: "assistant", content: response.content });

      const startIndex = trace.length;
      const entries: TraceEntry[] = new Array(toolUses.length);
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (tu, n) => {
          const index = startIndex + n;
          const input = (tu.input ?? {}) as Record<string, unknown>;
          opts.onEvent?.({ type: "tool_start", agentId: agent.id, index, tool: tu.name, input });
          const startedAt = Date.now();
          const outcome = await executeTool(agent, tu.name, input);
          const { result, ok } = outcome;
          if (outcome.handoff) handoff = outcome.handoff;
          if (outcome.mutationIds) mutationIds.push(...outcome.mutationIds);
          if (outcome.proposalIds) proposalIds.push(...outcome.proposalIds);
          const ms = Date.now() - startedAt;
          entries[n] = { tool: tu.name, input, result: result.slice(0, 800), ok, ms, refs: outcome.refs };
          opts.onEvent?.({
            type: "tool_end",
            agentId: agent.id,
            index,
            tool: tu.name,
            ok,
            ms,
            isWrite: isWriteTool(tu.name),
            result: entries[n].result,
          });
          return { type: "tool_result", tool_use_id: tu.id, content: result, is_error: !ok };
        })
      );
      trace.push(...entries);

      if (opts.signal?.aborted) return stoppedResult();

      messages.push({ role: "user", content: results });
    }

    return {
      text: `I stopped after ${MAX_ITERATIONS} tool-use rounds without finishing. Here's where I got:\n${trace
        .map((t) => `- ${t.tool} ${t.ok ? "completed" : "failed"}`)
        .join("\n")}`,
      trace,
      isError: true,
      stopped: false,
      mutationIds,
      proposalIds,
    };
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError || opts.signal?.aborted) return stoppedResult();
    return { text: describeError(err), trace, isError: true, stopped: false, mutationIds, proposalIds };
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
