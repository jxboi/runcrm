import { Agent, canWrite, CAPABILITY_ENTITIES } from "../types";
import { client } from "./client";
import { nameKey } from "./mentions";

/**
 * Pick the agent best suited to a message when the user didn't say who should
 * answer. Falls back to the first agent — routing should never be the thing
 * that makes a message fail.
 */
export async function routeToAgent(content: string, agents: Agent[]): Promise<Agent> {
  if (agents.length <= 1) return agents[0];

  const workflowAgent = agents.find((agent) => canWrite(agent.capabilities.workflows));
  if (workflowAgent && /\b(workflow|automation|automate|trigger|if\s*\/\s*else)\b/i.test(content)) {
    return workflowAgent;
  }

  const roster = agents
    .map(
      (a) =>
        `- ${a.name} | role: ${canWrite(a.capabilities.workflows) ? "workflow builder" : a.capabilities.workflows === "read" ? "workflow reader" : "CRM agent"} | access: ${CAPABILITY_ENTITIES.map((e) => `${e}=${a.capabilities[e]}`).join(", ")} | brief: ${
          a.instructions.slice(0, 240) || "(none)"
        }`
    )
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 32,
      system:
        "You route messages to the right teammate. Reply with exactly one agent name from the list and nothing else. Prefer an agent whose access rights actually allow the work.",
      messages: [{ role: "user", content: `Agents:\n${roster}\n\nMessage:\n${content}` }],
    });

    const answer = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    const key = nameKey(answer);
    const match =
      agents.find((a) => nameKey(a.name) === key) ?? agents.find((a) => key.includes(nameKey(a.name)));
    if (match) return match;
  } catch {
    // Fall through — a routing failure shouldn't lose the user's message.
  }

  return agents[0];
}
