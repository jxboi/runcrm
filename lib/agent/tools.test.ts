import { beforeEach, describe, expect, it, vi } from "vitest";
import { Agent } from "../types";

const mocks = vi.hoisted(() => ({
  createContact: vi.fn(),
  createProposal: vi.fn(),
  journalMutation: vi.fn(),
  refFor: vi.fn(),
  snapshotRow: vi.fn(),
}));

vi.mock("../crm", () => ({
  createContact: mocks.createContact,
  createSalesRep: vi.fn(),
  createDeal: vi.fn(),
  createTask: vi.fn(),
  getContact: vi.fn(),
  getSalesRep: vi.fn(),
  listActivities: vi.fn(),
  listAgents: vi.fn(),
  listContacts: vi.fn(),
  listDeals: vi.fn(),
  listSalesReps: vi.fn(),
  listTasks: vi.fn(),
  logActivity: vi.fn(),
  updateContact: vi.fn(),
  updateDeal: vi.fn(),
  updateSalesRep: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("../proposals", () => ({ createProposal: mocks.createProposal }));

vi.mock("../mutations", () => ({
  journalMutation: mocks.journalMutation,
  refFor: mocks.refFor,
  snapshotRow: mocks.snapshotRow,
}));

import { executeTool } from "./tools";

const autoAgent: Agent = {
  id: 7,
  name: "Sales",
  emoji: "briefcase",
  kind: "general",
  instructions: "",
  capabilities: { contacts: "write", deals: "none", activities: "none", tasks: "none", sales_reps: "none" },
  autonomy: "auto",
  model: "test-model",
  created_at: "2026-08-04 00:00:00",
};

describe("create_contact approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues a proposal for an autonomous agent without creating the contact", async () => {
    mocks.createProposal.mockResolvedValue(41);
    const input = { name: "Jane Doe", email: "jane@example.com", company: "Globex" };

    const outcome = await executeTool(autoAgent, "create_contact", input);

    expect(mocks.createProposal).toHaveBeenCalledWith({ agentId: 7, tool: "create_contact", input });
    expect(mocks.createContact).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(true);
    expect(outcome.proposalIds).toEqual([41]);
  });

  it("creates the contact only when called from the approval path", async () => {
    const contact = {
      id: 12,
      name: "Jane Doe",
      email: "jane@example.com",
      phone: null,
      company: "Globex",
      status: "lead",
      notes: null,
      created_at: "2026-08-04 00:00:00",
      updated_at: "2026-08-04 00:00:00",
    };
    mocks.createContact.mockResolvedValue(contact);
    mocks.snapshotRow.mockResolvedValue(contact);
    mocks.refFor.mockReturnValue({ entity: "contacts", id: 12, label: "Jane Doe" });
    mocks.journalMutation.mockResolvedValue(99);

    const outcome = await executeTool(
      autoAgent,
      "create_contact",
      { name: "Jane Doe", email: "jane@example.com", company: "Globex" },
      { skipApproval: true }
    );

    expect(mocks.createProposal).not.toHaveBeenCalled();
    expect(mocks.createContact).toHaveBeenCalledOnce();
    expect(outcome.ok).toBe(true);
    expect(outcome.refs).toEqual([{ entity: "contacts", id: 12, label: "Jane Doe" }]);
    expect(outcome.mutationIds).toEqual([99]);
  });
});
