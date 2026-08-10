/** "write" is accepted for agents saved before write approval became per-entity. */
export type AccessLevel = "none" | "read" | "write_ask" | "write_full" | "write";

export function canRead(level: AccessLevel): boolean {
  return level !== "none";
}

export function canWrite(level: AccessLevel): boolean {
  return level === "write" || level === "write_ask" || level === "write_full";
}

export function writeRequiresApproval(level: AccessLevel): boolean {
  return level === "write_ask";
}

export const ENTITIES = ["contacts", "deals", "activities", "tasks", "sales_reps"] as const;
export type Entity = (typeof ENTITIES)[number];

/** Access scopes shown in an agent's Access rights panel. */
export const CAPABILITY_ENTITIES = [...ENTITIES, "workflows"] as const;
export type CapabilityEntity = (typeof CAPABILITY_ENTITIES)[number];

/** For labelling a single record — "activities" doesn't singularise by dropping an "s". */
export const ENTITY_SINGULAR: Record<Entity, string> = {
  contacts: "contact",
  deals: "deal",
  activities: "activity",
  tasks: "task",
  sales_reps: "sales rep",
};

export type Capabilities = Record<CapabilityEntity, AccessLevel>;

/** Legacy agent-wide write behavior, retained while saved agents migrate to per-entity access. */
export type Autonomy = "auto" | "ask";

export interface Agent {
  id: number;
  name: string;
  emoji: string;
  instructions: string;
  capabilities: Capabilities;
  autonomy: Autonomy;
  model: string;
  created_at: string;
}

export const WORKFLOW_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_NODE_KINDS = ["trigger", "condition", "action", "delay", "ai_agent"] as const;
export type WorkflowNodeKind = (typeof WORKFLOW_NODE_KINDS)[number];

/**
 * Stable v1 workflow document. Versions store this whole value as JSON so a
 * saved graph is immutable, portable, and easy to migrate as node types grow.
 */
export interface WorkflowDefinition {
  schema_version: 1;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  operation: string;
  title: string;
  description: string;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  /** Branch labels are normally "yes" / "no"; ordinary edges use "then". */
  label: string;
}

export interface WorkflowValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  node_id?: string;
}

export interface Workflow {
  id: number;
  name: string;
  description: string;
  status: WorkflowStatus;
  current_version: number;
  definition: WorkflowDefinition;
  validation: WorkflowValidationIssue[];
  created_by_agent_id: number | null;
  created_by_agent_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersion {
  id: number;
  workflow_id: number;
  version: number;
  definition: WorkflowDefinition;
  change_summary: string;
  agent_id: number | null;
  agent_name?: string | null;
  created_at: string;
}

export interface WorkflowRunStep {
  node_id: string;
  node_title: string;
  kind: WorkflowNodeKind;
  status: "succeeded" | "skipped" | "failed";
  detail: string;
}

export interface WorkflowRun {
  id: number;
  workflow_id: number;
  workflow_name?: string | null;
  version: number;
  status: "running" | "succeeded" | "failed";
  trigger: "test" | "manual" | "event";
  input: Record<string, unknown>;
  trace: WorkflowRunStep[];
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export const PROPOSAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** A write waiting on the user (including every new contact). */
export interface Proposal {
  id: number;
  agent_id: number;
  agent_name?: string | null;
  agent_emoji?: string | null;
  message_id: number | null;
  thread_id: number | null;
  tool: string;
  input: Record<string, unknown>;
  status: ProposalStatus;
  result: string | null;
  created_at: string;
  decided_at: string | null;
}

export const CONTACT_STATUSES = ["lead", "prospect", "customer", "churned"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  sales_rep_id: number | null;
  sales_rep_name?: string | null;
  status: ContactStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const DEAL_STAGES = ["lead", "qualified", "proposal", "won", "lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export interface Deal {
  id: number;
  title: string;
  contact_id: number | null;
  contact_name?: string | null;
  closed_by_sales_rep_id: number | null;
  closed_by_sales_rep_name?: string | null;
  closed_at: string | null;
  value: number;
  stage: DealStage;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Activity {
  id: number;
  type: ActivityType;
  content: string;
  contact_id: number | null;
  contact_name?: string | null;
  deal_id: number | null;
  deal_title?: string | null;
  actor: string;
  created_at: string;
}

export const TASK_STATUSES = ["todo", "running", "done", "failed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: number;
  title: string;
  description: string | null;
  assignee_agent_id: number | null;
  assignee_sales_rep_id: number | null;
  assignee_name?: string | null;
  assignee_emoji?: string | null;
  assignee_sales_rep_name?: string | null;
  status: TaskStatus;
  result: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesRep {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  contact_count?: number;
  won_deal_count?: number;
  won_value?: number;
}

export type RoutineSchedule =
  | { kind: "daily"; time: string }
  | { kind: "weekly"; weekdays: number[]; time: string }
  | { kind: "monthly"; day: number; time: string };

export type RoutineRunStatus = "running" | "succeeded" | "failed";
export type RoutineRunTrigger = "scheduled" | "manual" | "retry";

export interface Routine {
  id: number;
  name: string;
  instructions: string;
  agent_id: number | null;
  agent_name?: string | null;
  agent_emoji?: string | null;
  schedule: RoutineSchedule;
  enabled: boolean;
  archived_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoutineRun {
  id: number;
  routine_id: number | null;
  routine_name?: string | null;
  trigger: RoutineRunTrigger;
  scheduled_for: string | null;
  status: RoutineRunStatus;
  result: string | null;
  error: string | null;
  trigger_message_id: number | null;
  retried_from_run_id: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface WorkspaceSettings {
  timezone: string;
  updated_at: string;
}

/** A durable conversation. Thread 1 is the workspace-wide Home room. */
export interface ChatThread {
  id: number;
  title: string;
  account_name: string | null;
  pinned: boolean;
  unread: boolean;
  archived_at: string | null;
  message_count: number;
  last_message: string | null;
  last_message_at: string | null;
  agent_names: string[];
  created_at: string;
  updated_at: string;
}

/** Server-only conversation context that is intentionally omitted from thread list DTOs. */
export interface ChatThreadContext extends ChatThread {
  memory: string | null;
  continued_from_thread_id: number | null;
}

export type ThreadFilter = "all" | "active" | "archived";

export interface ThreadUpdate {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  read?: boolean;
}

/** A CRM record a tool call touched, so the UI can point at it. */
export interface EntityRef {
  entity: Entity;
  id: number;
  label: string;
}

export interface TraceEntry {
  tool: string;
  input: unknown;
  result: string;
  ok: boolean;
  /** Wall-clock duration of the tool call. Absent on traces written before v0.2. */
  ms?: number;
  /** Records this call created or changed. */
  refs?: EntityRef[];
}

/** A tool call in a run that is still streaming; `ok` is undefined until it finishes. */
export interface LiveStep {
  index: number;
  tool: string;
  input: unknown;
  result?: string;
  ok?: boolean;
  ms?: number;
}

/** An agent turn currently streaming into the chat. */
export interface LiveRun {
  /** Identifies the request this turn belongs to; one request may run several agents. */
  runKey: string;
  /** Keeps background work attached to the conversation where it started. */
  threadId: number;
  agentId: number;
  agentName: string;
  agentEmoji: string;
  text: string;
  steps: LiveStep[];
}

/** Ephemeral "routed to X" / "X handed off to Y" line shown while a run is live. */
export interface RunNotice {
  id: string;
  threadId: number;
  text: string;
}

/** Who a composed message is addressed to when there is no @mention. */
export type Recipient = number | "auto";

export const MESSAGE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "👏", "🔥", "✅"] as const;
export type MessageReaction = (typeof MESSAGE_REACTIONS)[number];

export const MESSAGE_FEEDBACK = ["helpful", "needs_improvement", "incorrect", "unsafe"] as const;
export type MessageFeedback = (typeof MESSAGE_FEEDBACK)[number];

export interface MessageUpdate {
  reaction?: MessageReaction | null;
  pinned?: boolean;
  starred?: boolean;
  feedback?: MessageFeedback | null;
}

export interface ChatMessage {
  id: number;
  thread_id: number;
  role: "user" | "agent";
  agent_id: number | null;
  agent_name?: string | null;
  agent_emoji?: string | null;
  content: string;
  trace: TraceEntry[];
  is_error: boolean;
  liked: boolean;
  reaction: MessageReaction | null;
  pinned: boolean;
  starred: boolean;
  feedback: MessageFeedback | null;
  reply_to_id: number | null;
  reply_to_content?: string | null;
  reply_to_role?: "user" | "agent" | null;
  reply_to_agent_name?: string | null;
  forwarded_from_id: number | null;
  forwarded_from_role?: "user" | "agent" | null;
  forwarded_from_agent_name?: string | null;
  /** Writes from this message that haven't been undone yet — 0 means nothing to undo. */
  undoable?: number;
  created_at: string;
}
