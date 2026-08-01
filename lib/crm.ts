import { getDb } from "./db";
import {
  Activity,
  ACTIVITY_TYPES,
  Agent,
  Capabilities,
  ChatMessage,
  Contact,
  CONTACT_STATUSES,
  Deal,
  DEAL_STAGES,
  ENTITIES,
  Task,
  TASK_STATUSES,
  TraceEntry,
} from "./types";

// ---------- agents ----------

function rowToAgent(row: Record<string, unknown>): Agent {
  const caps: Capabilities = { contacts: "none", deals: "none", activities: "none", tasks: "none" };
  try {
    const parsed = JSON.parse(String(row.capabilities || "{}"));
    for (const e of ENTITIES) {
      if (parsed[e] === "read" || parsed[e] === "write") caps[e] = parsed[e];
    }
  } catch {
    // keep defaults
  }
  return {
    id: Number(row.id),
    name: String(row.name),
    emoji: String(row.emoji),
    instructions: String(row.instructions),
    capabilities: caps,
    model: String(row.model),
    created_at: String(row.created_at),
  };
}

export function listAgents(): Agent[] {
  const rows = getDb().prepare("SELECT * FROM agents ORDER BY id").all() as Record<string, unknown>[];
  return rows.map(rowToAgent);
}

export function getAgent(id: number): Agent | null {
  const row = getDb().prepare("SELECT * FROM agents WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToAgent(row) : null;
}

export function createAgent(input: {
  name: string;
  emoji?: string;
  instructions?: string;
  capabilities?: Partial<Capabilities>;
  model?: string;
}): Agent {
  const caps: Capabilities = { contacts: "none", deals: "none", activities: "none", tasks: "none" };
  for (const e of ENTITIES) {
    const v = input.capabilities?.[e];
    if (v === "read" || v === "write") caps[e] = v;
  }
  const info = getDb()
    .prepare("INSERT INTO agents (name, emoji, instructions, capabilities, model) VALUES (?, ?, ?, ?, ?)")
    .run(
      input.name.trim(),
      input.emoji?.trim() || "🤖",
      input.instructions ?? "",
      JSON.stringify(caps),
      input.model || "claude-opus-5"
    );
  return getAgent(Number(info.lastInsertRowid))!;
}

export function updateAgent(
  id: number,
  input: {
    name?: string;
    emoji?: string;
    instructions?: string;
    capabilities?: Partial<Capabilities>;
    model?: string;
  }
): Agent | null {
  const existing = getAgent(id);
  if (!existing) return null;
  const caps: Capabilities = { ...existing.capabilities };
  if (input.capabilities) {
    for (const e of ENTITIES) {
      const v = input.capabilities[e];
      if (v === "none" || v === "read" || v === "write") caps[e] = v;
    }
  }
  getDb()
    .prepare("UPDATE agents SET name = ?, emoji = ?, instructions = ?, capabilities = ?, model = ? WHERE id = ?")
    .run(
      (input.name ?? existing.name).trim(),
      (input.emoji ?? existing.emoji).trim() || "🤖",
      input.instructions ?? existing.instructions,
      JSON.stringify(caps),
      input.model ?? existing.model,
      id
    );
  return getAgent(id);
}

export function deleteAgent(id: number): boolean {
  return getDb().prepare("DELETE FROM agents WHERE id = ?").run(id).changes > 0;
}

// ---------- contacts ----------

export function listContacts(filter?: { query?: string; status?: string }): Contact[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.query) {
    clauses.push("(name LIKE ? OR company LIKE ? OR email LIKE ?)");
    const q = `%${filter.query}%`;
    params.push(q, q, q);
  }
  if (filter?.status && (CONTACT_STATUSES as readonly string[]).includes(filter.status)) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare(`SELECT * FROM contacts ${where} ORDER BY updated_at DESC`)
    .all(...params) as Contact[];
}

export function getContact(id: number): (Contact & { deals: Deal[]; activities: Activity[] }) | null {
  const contact = getDb().prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Contact | undefined;
  if (!contact) return null;
  const deals = getDb().prepare("SELECT * FROM deals WHERE contact_id = ? ORDER BY updated_at DESC").all(id) as Deal[];
  const activities = getDb()
    .prepare("SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(id) as Activity[];
  return { ...contact, deals, activities };
}

export function createContact(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status?: string;
  notes?: string | null;
}): Contact {
  if (!input.name?.trim()) throw new Error("Contact name is required");
  const status = (CONTACT_STATUSES as readonly string[]).includes(input.status ?? "") ? input.status : "lead";
  const info = getDb()
    .prepare("INSERT INTO contacts (name, email, phone, company, status, notes) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.name.trim(), input.email ?? null, input.phone ?? null, input.company ?? null, status, input.notes ?? null);
  return getDb().prepare("SELECT * FROM contacts WHERE id = ?").get(info.lastInsertRowid) as Contact;
}

export function updateContact(
  id: number,
  input: Partial<Pick<Contact, "name" | "email" | "phone" | "company" | "status" | "notes">>
): Contact {
  const existing = getDb().prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Contact | undefined;
  if (!existing) throw new Error(`Contact ${id} not found`);
  if (input.status && !(CONTACT_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error(`Invalid status "${input.status}". Valid: ${CONTACT_STATUSES.join(", ")}`);
  }
  getDb()
    .prepare(
      "UPDATE contacts SET name = ?, email = ?, phone = ?, company = ?, status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(
      input.name ?? existing.name,
      input.email !== undefined ? input.email : existing.email,
      input.phone !== undefined ? input.phone : existing.phone,
      input.company !== undefined ? input.company : existing.company,
      input.status ?? existing.status,
      input.notes !== undefined ? input.notes : existing.notes,
      id
    );
  return getDb().prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Contact;
}

// ---------- deals ----------

export function listDeals(filter?: { stage?: string; contact_id?: number }): Deal[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.stage && (DEAL_STAGES as readonly string[]).includes(filter.stage)) {
    clauses.push("d.stage = ?");
    params.push(filter.stage);
  }
  if (filter?.contact_id) {
    clauses.push("d.contact_id = ?");
    params.push(filter.contact_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare(
      `SELECT d.*, c.name AS contact_name FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id ${where} ORDER BY d.updated_at DESC`
    )
    .all(...params) as Deal[];
}

export function createDeal(input: {
  title: string;
  contact_id?: number | null;
  value?: number;
  stage?: string;
  notes?: string | null;
}): Deal {
  if (!input.title?.trim()) throw new Error("Deal title is required");
  if (input.contact_id != null) {
    const c = getDb().prepare("SELECT id FROM contacts WHERE id = ?").get(input.contact_id);
    if (!c) throw new Error(`Contact ${input.contact_id} not found`);
  }
  const stage = (DEAL_STAGES as readonly string[]).includes(input.stage ?? "") ? input.stage : "lead";
  const info = getDb()
    .prepare("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)")
    .run(input.title.trim(), input.contact_id ?? null, Number(input.value) || 0, stage, input.notes ?? null);
  return listDeals().find((d) => d.id === Number(info.lastInsertRowid))!;
}

export function updateDeal(
  id: number,
  input: Partial<Pick<Deal, "title" | "contact_id" | "value" | "stage" | "notes">>
): Deal {
  const existing = getDb().prepare("SELECT * FROM deals WHERE id = ?").get(id) as Deal | undefined;
  if (!existing) throw new Error(`Deal ${id} not found`);
  if (input.stage && !(DEAL_STAGES as readonly string[]).includes(input.stage)) {
    throw new Error(`Invalid stage "${input.stage}". Valid: ${DEAL_STAGES.join(", ")}`);
  }
  if (input.contact_id != null) {
    const c = getDb().prepare("SELECT id FROM contacts WHERE id = ?").get(input.contact_id);
    if (!c) throw new Error(`Contact ${input.contact_id} not found`);
  }
  getDb()
    .prepare(
      "UPDATE deals SET title = ?, contact_id = ?, value = ?, stage = ?, notes = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(
      input.title ?? existing.title,
      input.contact_id !== undefined ? input.contact_id : existing.contact_id,
      input.value !== undefined ? Number(input.value) || 0 : existing.value,
      input.stage ?? existing.stage,
      input.notes !== undefined ? input.notes : existing.notes,
      id
    );
  return listDeals().find((d) => d.id === id)!;
}

// ---------- activities ----------

export function listActivities(filter?: { contact_id?: number; deal_id?: number; limit?: number }): Activity[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.contact_id) {
    clauses.push("a.contact_id = ?");
    params.push(filter.contact_id);
  }
  if (filter?.deal_id) {
    clauses.push("a.deal_id = ?");
    params.push(filter.deal_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filter?.limit ?? 30, 1), 100);
  return getDb()
    .prepare(
      `SELECT a.*, c.name AS contact_name, d.title AS deal_title
       FROM activities a
       LEFT JOIN contacts c ON c.id = a.contact_id
       LEFT JOIN deals d ON d.id = a.deal_id
       ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`
    )
    .all(...params) as Activity[];
}

export function logActivity(input: {
  type?: string;
  content: string;
  contact_id?: number | null;
  deal_id?: number | null;
  actor: string;
}): Activity {
  if (!input.content?.trim()) throw new Error("Activity content is required");
  const type = (ACTIVITY_TYPES as readonly string[]).includes(input.type ?? "") ? input.type : "note";
  if (input.contact_id != null && !getDb().prepare("SELECT id FROM contacts WHERE id = ?").get(input.contact_id)) {
    throw new Error(`Contact ${input.contact_id} not found`);
  }
  if (input.deal_id != null && !getDb().prepare("SELECT id FROM deals WHERE id = ?").get(input.deal_id)) {
    throw new Error(`Deal ${input.deal_id} not found`);
  }
  const info = getDb()
    .prepare("INSERT INTO activities (type, content, contact_id, deal_id, actor) VALUES (?, ?, ?, ?, ?)")
    .run(type, input.content.trim(), input.contact_id ?? null, input.deal_id ?? null, input.actor);
  return listActivities({ limit: 100 }).find((a) => a.id === Number(info.lastInsertRowid))!;
}

// ---------- tasks ----------

export function listTasks(filter?: { status?: string }): Task[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.status && (TASK_STATUSES as readonly string[]).includes(filter.status)) {
    clauses.push("t.status = ?");
    params.push(filter.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare(
      `SELECT t.*, a.name AS assignee_name, a.emoji AS assignee_emoji
       FROM tasks t LEFT JOIN agents a ON a.id = t.assignee_agent_id
       ${where} ORDER BY t.id DESC`
    )
    .all(...params) as Task[];
}

export function getTask(id: number): Task | null {
  return (listTasks().find((t) => t.id === id) as Task) ?? null;
}

export function createTask(input: {
  title: string;
  description?: string | null;
  assignee_agent_id?: number | null;
}): Task {
  if (!input.title?.trim()) throw new Error("Task title is required");
  if (input.assignee_agent_id != null && !getAgent(input.assignee_agent_id)) {
    throw new Error(`Agent ${input.assignee_agent_id} not found`);
  }
  const info = getDb()
    .prepare("INSERT INTO tasks (title, description, assignee_agent_id) VALUES (?, ?, ?)")
    .run(input.title.trim(), input.description ?? null, input.assignee_agent_id ?? null);
  return getTask(Number(info.lastInsertRowid))!;
}

export function updateTask(
  id: number,
  input: Partial<Pick<Task, "title" | "description" | "assignee_agent_id" | "status" | "result">>
): Task {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);
  if (input.status && !(TASK_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error(`Invalid status "${input.status}". Valid: ${TASK_STATUSES.join(", ")}`);
  }
  if (input.assignee_agent_id != null && !getAgent(input.assignee_agent_id)) {
    throw new Error(`Agent ${input.assignee_agent_id} not found`);
  }
  getDb()
    .prepare(
      "UPDATE tasks SET title = ?, description = ?, assignee_agent_id = ?, status = ?, result = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(
      input.title ?? existing.title,
      input.description !== undefined ? input.description : existing.description,
      input.assignee_agent_id !== undefined ? input.assignee_agent_id : existing.assignee_agent_id,
      input.status ?? existing.status,
      input.result !== undefined ? input.result : existing.result,
      id
    );
  return getTask(id)!;
}

// ---------- chat messages ----------

export function listMessages(limit = 200): ChatMessage[] {
  const rows = getDb()
    .prepare(
      `SELECT m.*, a.name AS agent_name, a.emoji AS agent_emoji
       FROM messages m LEFT JOIN agents a ON a.id = m.agent_id
       ORDER BY m.id DESC LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];
  return rows.reverse().map((r) => ({
    id: Number(r.id),
    role: r.role as "user" | "agent",
    agent_id: r.agent_id == null ? null : Number(r.agent_id),
    agent_name: (r.agent_name as string) ?? null,
    agent_emoji: (r.agent_emoji as string) ?? null,
    content: String(r.content),
    trace: safeParseTrace(r.trace),
    is_error: Boolean(r.is_error),
    created_at: String(r.created_at),
  }));
}

function safeParseTrace(raw: unknown): TraceEntry[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function insertMessage(input: {
  role: "user" | "agent";
  agent_id?: number | null;
  content: string;
  trace?: TraceEntry[];
  is_error?: boolean;
}): ChatMessage {
  const info = getDb()
    .prepare("INSERT INTO messages (role, agent_id, content, trace, is_error) VALUES (?, ?, ?, ?, ?)")
    .run(
      input.role,
      input.agent_id ?? null,
      input.content,
      JSON.stringify(input.trace ?? []),
      input.is_error ? 1 : 0
    );
  return listMessages().find((m) => m.id === Number(info.lastInsertRowid))!;
}
