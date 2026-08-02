import { all, first, run } from "./crm";
import { Proposal, ProposalStatus } from "./types";

/**
 * The gated-operator rung of the autonomy ladder: an agent set to "ask" files
 * its writes here instead of making them, and the user approves or rejects.
 *
 * Approval re-checks the agent's access rights before executing — a queued
 * proposal is a request, never a stored permission.
 */

function rowToProposal(row: Record<string, unknown>): Proposal {
  let input: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(row.input || "{}"));
    if (parsed && typeof parsed === "object") input = parsed as Record<string, unknown>;
  } catch {}
  return {
    id: Number(row.id),
    agent_id: Number(row.agent_id),
    agent_name: (row.agent_name as string) ?? null,
    agent_emoji: (row.agent_emoji as string) ?? null,
    message_id: row.message_id == null ? null : Number(row.message_id),
    tool: String(row.tool),
    input,
    status: row.status as ProposalStatus,
    result: (row.result as string) ?? null,
    created_at: String(row.created_at),
    decided_at: (row.decided_at as string) ?? null,
  };
}

const SELECT =
  "SELECT p.*, a.name AS agent_name, a.emoji AS agent_emoji FROM proposals p LEFT JOIN agents a ON a.id = p.agent_id";

export async function createProposal(input: {
  agentId: number;
  tool: string;
  input: Record<string, unknown>;
}): Promise<number> {
  const result = await run("INSERT INTO proposals (agent_id, tool, input) VALUES (?, ?, ?)", [
    input.agentId,
    input.tool,
    JSON.stringify(input.input ?? {}),
  ]);
  return Number(result.meta.last_row_id);
}

export async function getProposal(id: number): Promise<Proposal | null> {
  const row = await first<Record<string, unknown>>(`${SELECT} WHERE p.id = ?`, [id]);
  return row ? rowToProposal(row) : null;
}

/** Everything still awaiting a decision, oldest first. */
export async function listPendingProposals(): Promise<Proposal[]> {
  const rows = await all<Record<string, unknown>>(`${SELECT} WHERE p.status = 'pending' ORDER BY p.id`);
  return rows.map(rowToProposal);
}

export async function listProposalsForMessage(messageId: number): Promise<Proposal[]> {
  const rows = await all<Record<string, unknown>>(`${SELECT} WHERE p.message_id = ? ORDER BY p.id`, [
    messageId,
  ]);
  return rows.map(rowToProposal);
}

/** Attach a batch of proposals to the chat message that announced them. */
export async function linkProposalsToMessage(ids: number[], messageId: number): Promise<void> {
  if (ids.length === 0) return;
  await run(
    `UPDATE proposals SET message_id = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
    [messageId, ...ids]
  );
}

export async function decideProposal(
  id: number,
  status: Exclude<ProposalStatus, "pending">,
  result: string
): Promise<Proposal | null> {
  await run(
    "UPDATE proposals SET status = ?, result = ?, decided_at = datetime('now') WHERE id = ? AND status = 'pending'",
    [status, result, id]
  );
  return getProposal(id);
}
