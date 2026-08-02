export type AccessLevel = "none" | "read" | "write";

export const ENTITIES = ["contacts", "deals", "activities", "tasks"] as const;
export type Entity = (typeof ENTITIES)[number];

/** For labelling a single record — "activities" doesn't singularise by dropping an "s". */
export const ENTITY_SINGULAR: Record<Entity, string> = {
  contacts: "contact",
  deals: "deal",
  activities: "activity",
  tasks: "task",
};

export type Capabilities = Record<Entity, AccessLevel>;

/**
 * First rung of the autonomy ladder: "auto" writes straight through, "ask"
 * files each write as a proposal for the user to approve.
 */
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

export const PROPOSAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** A write an "ask" agent wants to make, waiting on the user. */
export interface Proposal {
  id: number;
  agent_id: number;
  agent_name?: string | null;
  agent_emoji?: string | null;
  message_id: number | null;
  tool: string;
  input: Record<string, unknown>;
  status: ProposalStatus;
  result: string | null;
  created_at: string;
  decided_at: string | null;
}

export const CONTACT_STATUSES = ["lead", "prospect", "customer", "churned"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
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
  assignee_name?: string | null;
  assignee_emoji?: string | null;
  status: TaskStatus;
  result: string | null;
  created_at: string;
  updated_at: string;
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
  agentId: number;
  agentName: string;
  agentEmoji: string;
  text: string;
  steps: LiveStep[];
}

/** Ephemeral "routed to X" / "X handed off to Y" line shown while a run is live. */
export interface RunNotice {
  id: string;
  text: string;
}

/** Who a composed message is addressed to when there is no @mention. */
export type Recipient = number | "auto";

export interface ChatMessage {
  id: number;
  role: "user" | "agent";
  agent_id: number | null;
  agent_name?: string | null;
  agent_emoji?: string | null;
  content: string;
  trace: TraceEntry[];
  is_error: boolean;
  /** Writes from this message that haven't been undone yet — 0 means nothing to undo. */
  undoable?: number;
  created_at: string;
}
