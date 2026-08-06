import {
  WORKFLOW_NODE_KINDS,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowValidationIssue,
} from "./types";

export const WORKFLOW_OPERATIONS: Record<WorkflowNodeKind, readonly string[]> = {
  trigger: ["manual", "record.created", "record.updated", "schedule.reached"],
  condition: ["branch.if"],
  action: [
    "record.update",
    "sales_rep.create",
    "contact.assign_sales_rep",
    "deal.close",
    "task.create",
    "activity.log",
    "email.send",
    "notification.send",
  ],
  delay: ["wait.duration"],
  ai_agent: ["agent.run"],
};

const ID_PATTERN = /^[a-z][a-z0-9_-]{1,47}$/;
const MAX_NODES = 30;
const MAX_EDGES = 60;
export const WORKFLOW_RECORD_ENTITIES = ["contact", "deal", "activity", "task", "sales_rep"] as const;

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function configured(value: unknown): boolean {
  return (typeof value === "string" && value.trim().length > 0) || typeof value === "number";
}

function nodeFromUnknown(value: unknown): WorkflowNode {
  const row = objectValue(value);
  const kind = (WORKFLOW_NODE_KINDS as readonly string[]).includes(String(row.kind))
    ? (row.kind as WorkflowNodeKind)
    : (String(row.kind || "action") as WorkflowNodeKind);
  return {
    id: text(row.id),
    kind,
    operation: text(row.operation),
    title: text(row.title),
    description: text(row.description),
    config: objectValue(row.config),
  };
}

function edgeFromUnknown(value: unknown): WorkflowEdge {
  const row = objectValue(value);
  return {
    id: text(row.id),
    source: text(row.source),
    target: text(row.target),
    label: text(row.label, "then").toLowerCase(),
  };
}

/** Convert model-produced JSON into the exact persisted v1 document shape. */
export function normalizeWorkflowDefinition(value: unknown): WorkflowDefinition {
  const row = objectValue(value);
  return {
    schema_version: 1,
    name: text(row.name),
    description: text(row.description),
    nodes: Array.isArray(row.nodes) ? row.nodes.map(nodeFromUnknown) : [],
    edges: Array.isArray(row.edges) ? row.edges.map(edgeFromUnknown) : [],
  };
}

function branchLabel(label: string): "yes" | "no" | null {
  const key = label.trim().toLowerCase();
  if (["yes", "true", "if", "match", "matched"].includes(key)) return "yes";
  if (["no", "false", "else", "otherwise", "not matched"].includes(key)) return "no";
  return null;
}

export function validateWorkflowDefinition(definition: WorkflowDefinition): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const error = (code: string, message: string, node_id?: string) =>
    issues.push({ level: "error", code, message, ...(node_id ? { node_id } : {}) });
  const warning = (code: string, message: string, node_id?: string) =>
    issues.push({ level: "warning", code, message, ...(node_id ? { node_id } : {}) });

  if (!definition.name) error("missing_name", "Give the workflow a name.");
  if (definition.name.length > 100) error("name_too_long", "Workflow names must be 100 characters or fewer.");
  if (!definition.description) warning("missing_description", "Add a short description so operators know what this workflow does.");
  if (definition.nodes.length < 2) error("too_few_nodes", "A workflow needs a trigger and at least one step.");
  if (definition.nodes.length > MAX_NODES) error("too_many_nodes", `A workflow can contain at most ${MAX_NODES} nodes.`);
  if (definition.edges.length > MAX_EDGES) error("too_many_edges", `A workflow can contain at most ${MAX_EDGES} connections.`);

  const nodeIds = new Set<string>();
  for (const node of definition.nodes) {
    if (!ID_PATTERN.test(node.id)) {
      error("invalid_node_id", `Node id “${node.id || "(empty)"}” must start with a letter and use lowercase letters, numbers, _ or -.`, node.id || undefined);
    }
    if (nodeIds.has(node.id)) error("duplicate_node_id", `Node id “${node.id}” is used more than once.`, node.id);
    nodeIds.add(node.id);
    if (!(WORKFLOW_NODE_KINDS as readonly string[]).includes(node.kind)) {
      error("invalid_node_kind", `Node “${node.id}” has unsupported kind “${node.kind}”.`, node.id);
    }
    if (!node.title) error("missing_node_title", `Node “${node.id}” needs a title.`, node.id);
    if (!node.operation) error("missing_operation", `Node “${node.id}” needs an operation.`, node.id);
    else if (!WORKFLOW_OPERATIONS[node.kind]?.includes(node.operation)) {
      warning("custom_operation", `“${node.operation}” is not in the built-in ${node.kind.replace("_", " ")} catalog and will need an adapter before live execution.`, node.id);
    }

    if (node.kind === "condition") {
      if (!text(node.config.field)) error("condition_field", "A condition needs config.field (for example record.status).", node.id);
      if (!text(node.config.operator)) error("condition_operator", "A condition needs config.operator.", node.id);
    }
    if (node.kind === "delay" && !node.config.duration) {
      error("delay_duration", "A delay needs config.duration (for example 2 days).", node.id);
    }
    if (node.kind === "ai_agent" && !text(node.config.instructions)) {
      error("agent_instructions", "An AI agent step needs config.instructions.", node.id);
    }
    if (["record.created", "record.updated"].includes(node.operation)) {
      const entity = text(node.config.entity);
      if (!(WORKFLOW_RECORD_ENTITIES as readonly string[]).includes(entity)) {
        error("record_trigger_entity", `“${node.title || node.id}” needs config.entity set to contact, deal, activity, task, or sales_rep.`, node.id);
      }
    }
    if (node.operation === "record.update") {
      const entity = text(node.config.entity);
      if (!(WORKFLOW_RECORD_ENTITIES as readonly string[]).includes(entity)) {
        error("record_update_entity", `“${node.title || node.id}” needs a supported config.entity.`, node.id);
      }
      if (!configured(node.config.record_id)) error("record_update_id", "A record update needs config.record_id.", node.id);
      if (Object.keys(objectValue(node.config.fields)).length === 0) error("record_update_fields", "A record update needs at least one value in config.fields.", node.id);
    }
    if (node.operation === "sales_rep.create" && !text(node.config.name)) {
      error("sales_rep_name", "Creating a sales rep needs config.name.", node.id);
    }
    if (node.operation === "contact.assign_sales_rep") {
      if (!configured(node.config.contact_id)) error("contact_assignment_contact", "Assigning a contact needs config.contact_id.", node.id);
      if (!configured(node.config.sales_rep_id)) error("contact_assignment_sales_rep", "Assigning a contact needs config.sales_rep_id.", node.id);
    }
    if (node.operation === "deal.close") {
      if (!configured(node.config.deal_id)) error("deal_close_deal", "Closing a deal needs config.deal_id.", node.id);
      if (!configured(node.config.sales_rep_id)) error("deal_close_sales_rep", "Closing a deal needs config.sales_rep_id.", node.id);
      const outcome = text(node.config.outcome, "won");
      if (outcome !== "won" && outcome !== "lost") error("deal_close_outcome", "A deal close outcome must be won or lost.", node.id);
    }
    if (node.operation === "task.create") {
      if (!text(node.config.title)) error("task_title", "Creating a task needs config.title.", node.id);
      if (configured(node.config.assignee_agent_id) && configured(node.config.assignee_sales_rep_id)) {
        error("task_multiple_assignees", "A task can be assigned to either an AI agent or a sales rep, not both.", node.id);
      }
    }
    if (node.operation === "email.send") {
      const recipients = typeof node.config.to === "string"
        ? node.config.to.trim().length > 0
        : Array.isArray(node.config.to) && node.config.to.some((value) => typeof value === "string" && value.trim().length > 0);
      if (!recipients) error("email_recipient", "Sending an email needs config.to with a recipient address or template.", node.id);
      if (!text(node.config.subject)) error("email_subject", "Sending an email needs config.subject.", node.id);
      if (!text(node.config.body) && !text(node.config.text)) error("email_body", "Sending an email needs config.body.", node.id);
    }
    if (node.operation === "notification.send") {
      warning("integration_required", `“${node.title}” needs an integration connection before live execution.`, node.id);
    }
  }

  const triggers = definition.nodes.filter((node) => node.kind === "trigger");
  if (triggers.length !== 1) error("trigger_count", `A workflow needs exactly one trigger; found ${triggers.length}.`);
  const trigger = triggers[0];

  const edgeIds = new Set<string>();
  const outgoing = new Map<string, WorkflowEdge[]>();
  const incoming = new Map<string, WorkflowEdge[]>();
  for (const edge of definition.edges) {
    if (!edge.id) error("missing_edge_id", "Every connection needs an id.");
    if (edgeIds.has(edge.id)) error("duplicate_edge_id", `Connection id “${edge.id}” is used more than once.`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) error("missing_edge_source", `Connection “${edge.id}” starts at unknown node “${edge.source}”.`);
    if (!nodeIds.has(edge.target)) error("missing_edge_target", `Connection “${edge.id}” ends at unknown node “${edge.target}”.`);
    if (edge.source === edge.target) error("self_loop", `Node “${edge.source}” cannot connect to itself.`, edge.source);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
  }

  if (trigger && (incoming.get(trigger.id)?.length ?? 0) > 0) {
    error("trigger_has_input", "The trigger cannot have an incoming connection.", trigger.id);
  }
  for (const node of definition.nodes) {
    if (node.kind !== "trigger" && (incoming.get(node.id)?.length ?? 0) === 0) {
      error("unconnected_node", `“${node.title || node.id}” is not connected from an earlier step.`, node.id);
    }
    if (node.kind === "condition") {
      const labels = (outgoing.get(node.id) ?? []).map((edge) => branchLabel(edge.label));
      if (labels.filter((label) => label === "yes").length !== 1 || labels.filter((label) => label === "no").length !== 1) {
        error("condition_branches", `“${node.title || node.id}” needs exactly one Yes edge and one No edge.`, node.id);
      }
    }
  }

  if (trigger) {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    let hasCycle = false;
    const visit = (id: string) => {
      if (visiting.has(id)) {
        hasCycle = true;
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      for (const edge of outgoing.get(id) ?? []) visit(edge.target);
      visiting.delete(id);
      visited.add(id);
    };
    visit(trigger.id);
    if (hasCycle) error("cycle", "Loops are not supported in workflow schema v1. Use a scheduled trigger for recurring work.");
    for (const node of definition.nodes) {
      if (!visited.has(node.id)) error("unreachable_node", `“${node.title || node.id}” cannot be reached from the trigger.`, node.id);
    }
  }

  return issues;
}

export function assertValidWorkflowDefinition(value: unknown): WorkflowDefinition {
  const definition = normalizeWorkflowDefinition(value);
  const errors = validateWorkflowDefinition(definition).filter((issue) => issue.level === "error");
  if (errors.length > 0) throw new Error(errors.map((issue) => issue.message).join(" "));
  return definition;
}

export function isYesBranch(label: string): boolean {
  return branchLabel(label) === "yes";
}

export function isNoBranch(label: string): boolean {
  return branchLabel(label) === "no";
}
