import { NextRequest, NextResponse } from "next/server";
import { getAgent, getMessage, insertMessage } from "@/lib/crm";
import { executeTool } from "@/lib/agent/tools";
import { linkMutationsToMessage } from "@/lib/mutations";
import { decideProposal, getProposal } from "@/lib/proposals";

export const dynamic = "force-dynamic";

/**
 * Approve or reject a queued write.
 *
 * Approval re-fetches the agent and runs the call back through executeTool, so
 * its access rights are checked again at decision time — a proposal is a
 * request, never a stored permission. If the agent lost the right (or was
 * deleted) in the meantime, the write does not happen.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
  }

  const proposal = await getProposal(Number(id));
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.status !== "pending") {
    return NextResponse.json({ error: `Already ${proposal.status}` }, { status: 409 });
  }
  const sourceMessage = proposal.message_id == null ? null : await getMessage(proposal.message_id);
  const threadId = sourceMessage?.thread_id ?? 1;

  if (body.decision === "reject") {
    const decided = await decideProposal(proposal.id, "rejected", "Rejected by the user");
    const note = await insertMessage({
      role: "user",
      thread_id: threadId,
      content: `Rejected ${proposal.agent_name ?? "agent"}'s proposed ${proposal.tool}. Nothing was changed.`,
    });
    return NextResponse.json({ proposal: decided, note });
  }

  const agent = await getAgent(proposal.agent_id);
  if (!agent) {
    await decideProposal(proposal.id, "rejected", "The agent no longer exists");
    return NextResponse.json({ error: "That agent no longer exists" }, { status: 409 });
  }

  const outcome = await executeTool(agent, proposal.tool, proposal.input, { skipApproval: true });
  if (!outcome.ok) {
    await decideProposal(proposal.id, "rejected", outcome.result);
    return NextResponse.json({ error: outcome.result }, { status: 409 });
  }

  const decided = await decideProposal(proposal.id, "approved", outcome.result);
  const touched = outcome.refs?.map((r) => `${r.entity} #${r.id} ${r.label}`).join(", ");
  const note = await insertMessage({
    role: "user",
    thread_id: threadId,
    content: `Approved ${agent.name}'s ${proposal.tool}${touched ? ` — ${touched}` : ""}.`,
    trace: [
      {
        tool: proposal.tool,
        input: proposal.input,
        result: outcome.result.slice(0, 800),
        ok: true,
        refs: outcome.refs,
      },
    ],
  });

  // Link the journal rows to the approval note, so this is undoable like any
  // other change the user can see.
  await linkMutationsToMessage(outcome.mutationIds ?? [], note.id);

  return NextResponse.json({ proposal: decided, note: await getMessage(note.id) });
}
