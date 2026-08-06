import { describe, expect, it } from "vitest";
import { normalizeWorkflowDefinition, validateWorkflowDefinition } from "./workflow-definition";

const validWorkflow = normalizeWorkflowDefinition({
  schema_version: 1,
  name: "Lead routing",
  description: "Routes qualified leads to a follow-up task.",
  nodes: [
    { id: "lead_created", kind: "trigger", operation: "record.created", title: "Lead created", description: "A contact enters the CRM", config: { entity: "contact" } },
    { id: "is_qualified", kind: "condition", operation: "branch.if", title: "Qualified?", description: "Check lead status", config: { field: "record.status", operator: "equals", value: "qualified" } },
    { id: "follow_up", kind: "action", operation: "task.create", title: "Create follow-up", description: "Ask sales to follow up", config: { title: "Follow up" } },
    { id: "nurture", kind: "action", operation: "activity.log", title: "Add nurture note", description: "Keep the lead in nurture", config: { type: "note" } },
  ],
  edges: [
    { id: "e1", source: "lead_created", target: "is_qualified", label: "then" },
    { id: "e2", source: "is_qualified", target: "follow_up", label: "yes" },
    { id: "e3", source: "is_qualified", target: "nurture", label: "no" },
  ],
});

describe("workflow definition validation", () => {
  it("accepts a connected workflow with explicit condition branches", () => {
    expect(validateWorkflowDefinition(validWorkflow).filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("rejects missing condition branches and unreachable nodes", () => {
    const broken = {
      ...validWorkflow,
      edges: validWorkflow.edges.filter((edge) => edge.label !== "no"),
    };
    const codes = validateWorkflowDefinition(broken).map((issue) => issue.code);
    expect(codes).toContain("condition_branches");
    expect(codes).toContain("unconnected_node");
    expect(codes).toContain("unreachable_node");
  });

  it("rejects cycles", () => {
    const cyclic = {
      ...validWorkflow,
      edges: [...validWorkflow.edges, { id: "e4", source: "follow_up", target: "is_qualified", label: "then" }],
    };
    expect(validateWorkflowDefinition(cyclic).some((issue) => issue.code === "cycle")).toBe(true);
  });

  it("accepts sales rep triggers, contact assignment, deal closing, and rep tasks", () => {
    const workflow = normalizeWorkflowDefinition({
      name: "Sales rep lifecycle",
      description: "Exercises every sales rep workflow relationship.",
      nodes: [
        { id: "rep_created", kind: "trigger", operation: "record.created", title: "Rep created", description: "A sales rep is added", config: { entity: "sales_rep" } },
        { id: "assign_contact", kind: "action", operation: "contact.assign_sales_rep", title: "Assign contact", description: "Give the rep a contact", config: { contact_id: "{{record.contact_id}}", sales_rep_id: "{{record.id}}" } },
        { id: "close_deal", kind: "action", operation: "deal.close", title: "Close deal", description: "Record the closer", config: { deal_id: "{{record.deal_id}}", sales_rep_id: "{{record.id}}", outcome: "won" } },
        { id: "create_task", kind: "action", operation: "task.create", title: "Create task", description: "Assign work to the rep", config: { title: "Follow up", assignee_sales_rep_id: "{{record.id}}" } },
      ],
      edges: [
        { id: "e1", source: "rep_created", target: "assign_contact", label: "then" },
        { id: "e2", source: "assign_contact", target: "close_deal", label: "then" },
        { id: "e3", source: "close_deal", target: "create_task", label: "then" },
      ],
    });

    expect(validateWorkflowDefinition(workflow).filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("rejects incomplete sales rep actions and dual task assignees", () => {
    const workflow = normalizeWorkflowDefinition({
      name: "Broken sales routing",
      description: "Invalid relationship settings.",
      nodes: [
        { id: "contact_created", kind: "trigger", operation: "record.created", title: "Contact created", description: "New contact", config: { entity: "contact" } },
        { id: "assign_contact", kind: "action", operation: "contact.assign_sales_rep", title: "Assign contact", description: "Missing rep", config: { contact_id: "{{record.id}}" } },
        { id: "create_task", kind: "action", operation: "task.create", title: "Create task", description: "Two assignees", config: { title: "Follow up", assignee_agent_id: 2, assignee_sales_rep_id: 7 } },
      ],
      edges: [
        { id: "e1", source: "contact_created", target: "assign_contact", label: "then" },
        { id: "e2", source: "assign_contact", target: "create_task", label: "then" },
      ],
    });
    const codes = validateWorkflowDefinition(workflow).map((issue) => issue.code);

    expect(codes).toContain("contact_assignment_sales_rep");
    expect(codes).toContain("task_multiple_assignees");
  });

  it("validates email recipient, subject, and body", () => {
    const workflow = normalizeWorkflowDefinition({
      name: "Welcome email",
      description: "Welcomes a new contact.",
      nodes: [
        { id: "contact_created", kind: "trigger", operation: "record.created", title: "Contact created", description: "New contact", config: { entity: "contact" } },
        { id: "send_email", kind: "action", operation: "email.send", title: "Send welcome", description: "Email the contact", config: { to: "{{record.email}}" } },
      ],
      edges: [{ id: "e1", source: "contact_created", target: "send_email", label: "then" }],
    });
    const codes = validateWorkflowDefinition(workflow).map((issue) => issue.code);

    expect(codes).not.toContain("email_recipient");
    expect(codes).toContain("email_subject");
    expect(codes).toContain("email_body");
  });
});
