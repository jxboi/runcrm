export type AccessLevel = "none" | "read" | "write";

export const ENTITIES = ["contacts", "deals", "activities", "tasks"] as const;
export type Entity = (typeof ENTITIES)[number];

export type Capabilities = Record<Entity, AccessLevel>;

export interface Agent {
  id: number;
  name: string;
  emoji: string;
  instructions: string;
  capabilities: Capabilities;
  model: string;
  created_at: string;
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

export interface TraceEntry {
  tool: string;
  input: unknown;
  result: string;
  ok: boolean;
}

export interface ChatMessage {
  id: number;
  role: "user" | "agent";
  agent_id: number | null;
  agent_name?: string | null;
  agent_emoji?: string | null;
  content: string;
  trace: TraceEntry[];
  is_error: boolean;
  created_at: string;
}
