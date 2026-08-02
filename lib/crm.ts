import { ensureDb } from "./db";
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

function rowToAgent(row: Record<string, unknown>): Agent {
  const caps: Capabilities = { contacts: "none", deals: "none", activities: "none", tasks: "none" };
  try {
    const parsed = JSON.parse(String(row.capabilities || "{}"));
    for (const e of ENTITIES) {
      if (parsed[e] === "read" || parsed[e] === "write") caps[e] = parsed[e];
    }
  } catch {}
  return {
    id: Number(row.id),
    name: String(row.name),
    emoji: String(row.emoji),
    instructions: String(row.instructions),
    capabilities: caps,
    autonomy: row.autonomy === "ask" ? "ask" : "auto",
    model: String(row.model),
    created_at: String(row.created_at),
  };
}

// Exported for lib/mutations.ts, which journals and reverses the same rows.
export async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await ensureDb();
  const result = await db.prepare(sql).bind(...(params as D1Value[])).all<T>();
  return result.results;
}

export async function first<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const db = await ensureDb();
  return db.prepare(sql).bind(...(params as D1Value[])).first<T>();
}

export async function run(sql: string, params: unknown[] = []) {
  const db = await ensureDb();
  return db.prepare(sql).bind(...(params as D1Value[])).run();
}

export async function listAgents(): Promise<Agent[]> {
  return (await all<Record<string, unknown>>("SELECT * FROM agents ORDER BY id")).map(rowToAgent);
}

export async function getAgent(id: number): Promise<Agent | null> {
  const row = await first<Record<string, unknown>>("SELECT * FROM agents WHERE id = ?", [id]);
  return row ? rowToAgent(row) : null;
}

export async function createAgent(input: {
  name: string; emoji?: string; instructions?: string; capabilities?: Partial<Capabilities>; autonomy?: string; model?: string;
}): Promise<Agent> {
  const caps: Capabilities = { contacts: "none", deals: "none", activities: "none", tasks: "none" };
  for (const e of ENTITIES) {
    const value = input.capabilities?.[e];
    if (value === "read" || value === "write") caps[e] = value;
  }
  const result = await run(
    "INSERT INTO agents (name, emoji, instructions, capabilities, autonomy, model) VALUES (?, ?, ?, ?, ?, ?)",
    [input.name.trim(), input.emoji?.trim() || "🤖", input.instructions ?? "", JSON.stringify(caps), input.autonomy === "ask" ? "ask" : "auto", input.model || "claude-opus-5"],
  );
  return (await getAgent(Number(result.meta.last_row_id)))!;
}

export async function updateAgent(id: number, input: {
  name?: string; emoji?: string; instructions?: string; capabilities?: Partial<Capabilities>; autonomy?: string; model?: string;
}): Promise<Agent | null> {
  const existing = await getAgent(id);
  if (!existing) return null;
  const caps = { ...existing.capabilities };
  for (const e of ENTITIES) {
    const value = input.capabilities?.[e];
    if (value === "none" || value === "read" || value === "write") caps[e] = value;
  }
  const autonomy = input.autonomy === "ask" || input.autonomy === "auto" ? input.autonomy : existing.autonomy;
  await run("UPDATE agents SET name = ?, emoji = ?, instructions = ?, capabilities = ?, autonomy = ?, model = ? WHERE id = ?", [
    (input.name ?? existing.name).trim(),
    (input.emoji ?? existing.emoji).trim() || "🤖",
    input.instructions ?? existing.instructions,
    JSON.stringify(caps),
    autonomy,
    input.model ?? existing.model,
    id,
  ]);
  return getAgent(id);
}

export async function deleteAgent(id: number): Promise<boolean> {
  return (await run("DELETE FROM agents WHERE id = ?", [id])).meta.changes > 0;
}

export async function listContacts(filter?: { query?: string; status?: string }): Promise<Contact[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.query) {
    clauses.push("(name LIKE ? OR company LIKE ? OR email LIKE ?)");
    const query = `%${filter.query}%`;
    params.push(query, query, query);
  }
  if (filter?.status && (CONTACT_STATUSES as readonly string[]).includes(filter.status)) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Contact>(`SELECT * FROM contacts ${where} ORDER BY updated_at DESC`, params);
}

export async function getContact(id: number): Promise<(Contact & { deals: Deal[]; activities: Activity[] }) | null> {
  const contact = await first<Contact>("SELECT * FROM contacts WHERE id = ?", [id]);
  if (!contact) return null;
  const [deals, activities] = await Promise.all([
    all<Deal>("SELECT * FROM deals WHERE contact_id = ? ORDER BY updated_at DESC", [id]),
    all<Activity>("SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 20", [id]),
  ]);
  return { ...contact, deals, activities };
}

export async function createContact(input: {
  name: string; email?: string | null; phone?: string | null; company?: string | null; status?: string; notes?: string | null;
}): Promise<Contact> {
  if (!input.name?.trim()) throw new Error("Contact name is required");
  const status = (CONTACT_STATUSES as readonly string[]).includes(input.status ?? "") ? input.status! : "lead";
  const result = await run("INSERT INTO contacts (name, email, phone, company, status, notes) VALUES (?, ?, ?, ?, ?, ?)", [
    input.name.trim(), input.email ?? null, input.phone ?? null, input.company ?? null, status, input.notes ?? null,
  ]);
  return (await first<Contact>("SELECT * FROM contacts WHERE id = ?", [result.meta.last_row_id]))!;
}

export async function updateContact(id: number, input: Partial<Pick<Contact, "name" | "email" | "phone" | "company" | "status" | "notes">>): Promise<Contact> {
  const existing = await first<Contact>("SELECT * FROM contacts WHERE id = ?", [id]);
  if (!existing) throw new Error(`Contact ${id} not found`);
  if (input.status && !(CONTACT_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error(`Invalid status "${input.status}". Valid: ${CONTACT_STATUSES.join(", ")}`);
  }
  await run("UPDATE contacts SET name = ?, email = ?, phone = ?, company = ?, status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?", [
    input.name ?? existing.name,
    input.email !== undefined ? input.email : existing.email,
    input.phone !== undefined ? input.phone : existing.phone,
    input.company !== undefined ? input.company : existing.company,
    input.status ?? existing.status,
    input.notes !== undefined ? input.notes : existing.notes,
    id,
  ]);
  return (await first<Contact>("SELECT * FROM contacts WHERE id = ?", [id]))!;
}

export async function listDeals(filter?: { stage?: string; contact_id?: number }): Promise<Deal[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.stage && (DEAL_STAGES as readonly string[]).includes(filter.stage)) { clauses.push("d.stage = ?"); params.push(filter.stage); }
  if (filter?.contact_id) { clauses.push("d.contact_id = ?"); params.push(filter.contact_id); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Deal>(`SELECT d.*, c.name AS contact_name FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id ${where} ORDER BY d.updated_at DESC`, params);
}

export async function createDeal(input: {
  title: string; contact_id?: number | null; value?: number; stage?: string; notes?: string | null;
}): Promise<Deal> {
  if (!input.title?.trim()) throw new Error("Deal title is required");
  if (input.contact_id != null && !(await first("SELECT id FROM contacts WHERE id = ?", [input.contact_id]))) throw new Error(`Contact ${input.contact_id} not found`);
  const stage = (DEAL_STAGES as readonly string[]).includes(input.stage ?? "") ? input.stage! : "lead";
  const result = await run("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)", [
    input.title.trim(), input.contact_id ?? null, Number(input.value) || 0, stage, input.notes ?? null,
  ]);
  return (await first<Deal>("SELECT d.*, c.name AS contact_name FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id WHERE d.id = ?", [result.meta.last_row_id]))!;
}

export async function updateDeal(id: number, input: Partial<Pick<Deal, "title" | "contact_id" | "value" | "stage" | "notes">>): Promise<Deal> {
  const existing = await first<Deal>("SELECT * FROM deals WHERE id = ?", [id]);
  if (!existing) throw new Error(`Deal ${id} not found`);
  if (input.stage && !(DEAL_STAGES as readonly string[]).includes(input.stage)) throw new Error(`Invalid stage "${input.stage}". Valid: ${DEAL_STAGES.join(", ")}`);
  if (input.contact_id != null && !(await first("SELECT id FROM contacts WHERE id = ?", [input.contact_id]))) throw new Error(`Contact ${input.contact_id} not found`);
  await run("UPDATE deals SET title = ?, contact_id = ?, value = ?, stage = ?, notes = ?, updated_at = datetime('now') WHERE id = ?", [
    input.title ?? existing.title,
    input.contact_id !== undefined ? input.contact_id : existing.contact_id,
    input.value !== undefined ? Number(input.value) || 0 : existing.value,
    input.stage ?? existing.stage,
    input.notes !== undefined ? input.notes : existing.notes,
    id,
  ]);
  return (await first<Deal>("SELECT d.*, c.name AS contact_name FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id WHERE d.id = ?", [id]))!;
}

export async function listActivities(filter?: { contact_id?: number; deal_id?: number; limit?: number }): Promise<Activity[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.contact_id) { clauses.push("a.contact_id = ?"); params.push(filter.contact_id); }
  if (filter?.deal_id) { clauses.push("a.deal_id = ?"); params.push(filter.deal_id); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filter?.limit ?? 30, 1), 100);
  return all<Activity>(`SELECT a.*, c.name AS contact_name, d.title AS deal_title FROM activities a LEFT JOIN contacts c ON c.id = a.contact_id LEFT JOIN deals d ON d.id = a.deal_id ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`, params);
}

export async function logActivity(input: {
  type?: string; content: string; contact_id?: number | null; deal_id?: number | null; actor: string;
}): Promise<Activity> {
  if (!input.content?.trim()) throw new Error("Activity content is required");
  const type = (ACTIVITY_TYPES as readonly string[]).includes(input.type ?? "") ? input.type! : "note";
  if (input.contact_id != null && !(await first("SELECT id FROM contacts WHERE id = ?", [input.contact_id]))) throw new Error(`Contact ${input.contact_id} not found`);
  if (input.deal_id != null && !(await first("SELECT id FROM deals WHERE id = ?", [input.deal_id]))) throw new Error(`Deal ${input.deal_id} not found`);
  const result = await run("INSERT INTO activities (type, content, contact_id, deal_id, actor) VALUES (?, ?, ?, ?, ?)", [
    type, input.content.trim(), input.contact_id ?? null, input.deal_id ?? null, input.actor,
  ]);
  return (await first<Activity>("SELECT a.*, c.name AS contact_name, d.title AS deal_title FROM activities a LEFT JOIN contacts c ON c.id = a.contact_id LEFT JOIN deals d ON d.id = a.deal_id WHERE a.id = ?", [result.meta.last_row_id]))!;
}

export async function listTasks(filter?: { status?: string }): Promise<Task[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.status && (TASK_STATUSES as readonly string[]).includes(filter.status)) { clauses.push("t.status = ?"); params.push(filter.status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Task>(`SELECT t.*, a.name AS assignee_name, a.emoji AS assignee_emoji FROM tasks t LEFT JOIN agents a ON a.id = t.assignee_agent_id ${where} ORDER BY t.id DESC`, params);
}

export async function getTask(id: number): Promise<Task | null> {
  return first<Task>("SELECT t.*, a.name AS assignee_name, a.emoji AS assignee_emoji FROM tasks t LEFT JOIN agents a ON a.id = t.assignee_agent_id WHERE t.id = ?", [id]);
}

export async function createTask(input: { title: string; description?: string | null; assignee_agent_id?: number | null }): Promise<Task> {
  if (!input.title?.trim()) throw new Error("Task title is required");
  if (input.assignee_agent_id != null && !(await getAgent(input.assignee_agent_id))) throw new Error(`Agent ${input.assignee_agent_id} not found`);
  const result = await run("INSERT INTO tasks (title, description, assignee_agent_id) VALUES (?, ?, ?)", [input.title.trim(), input.description ?? null, input.assignee_agent_id ?? null]);
  return (await getTask(Number(result.meta.last_row_id)))!;
}

export async function updateTask(id: number, input: Partial<Pick<Task, "title" | "description" | "assignee_agent_id" | "status" | "result">>): Promise<Task> {
  const existing = await getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);
  if (input.status && !(TASK_STATUSES as readonly string[]).includes(input.status)) throw new Error(`Invalid status "${input.status}". Valid: ${TASK_STATUSES.join(", ")}`);
  if (input.assignee_agent_id != null && !(await getAgent(input.assignee_agent_id))) throw new Error(`Agent ${input.assignee_agent_id} not found`);
  await run("UPDATE tasks SET title = ?, description = ?, assignee_agent_id = ?, status = ?, result = ?, updated_at = datetime('now') WHERE id = ?", [
    input.title ?? existing.title,
    input.description !== undefined ? input.description : existing.description,
    input.assignee_agent_id !== undefined ? input.assignee_agent_id : existing.assignee_agent_id,
    input.status ?? existing.status,
    input.result !== undefined ? input.result : existing.result,
    id,
  ]);
  return (await getTask(id))!;
}

/** Counts the writes still standing behind a message, i.e. what Undo would reverse. */
const UNDOABLE_COUNT =
  "(SELECT COUNT(*) FROM mutations mu WHERE mu.message_id = m.id AND mu.undone_at IS NULL) AS undoable";

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id),
    role: row.role as "user" | "agent",
    agent_id: row.agent_id == null ? null : Number(row.agent_id),
    agent_name: (row.agent_name as string) ?? null,
    agent_emoji: (row.agent_emoji as string) ?? null,
    content: String(row.content),
    trace: safeParseTrace(row.trace),
    is_error: Boolean(row.is_error),
    undoable: Number(row.undoable ?? 0),
    created_at: String(row.created_at),
  };
}

export async function listMessages(limit = 200): Promise<ChatMessage[]> {
  const rows = await all<Record<string, unknown>>(`SELECT m.*, a.name AS agent_name, a.emoji AS agent_emoji, ${UNDOABLE_COUNT} FROM messages m LEFT JOIN agents a ON a.id = m.agent_id ORDER BY m.id DESC LIMIT ${Math.min(Math.max(limit, 1), 500)}`);
  return rows.reverse().map(rowToMessage);
}

function safeParseTrace(raw: unknown): TraceEntry[] {
  try { const parsed = JSON.parse(String(raw ?? "[]")); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function insertMessage(input: {
  role: "user" | "agent"; agent_id?: number | null; content: string; trace?: TraceEntry[]; is_error?: boolean;
}): Promise<ChatMessage> {
  const result = await run("INSERT INTO messages (role, agent_id, content, trace, is_error) VALUES (?, ?, ?, ?, ?)", [
    input.role, input.agent_id ?? null, input.content, JSON.stringify(input.trace ?? []), input.is_error ? 1 : 0,
  ]);
  const row = await first<Record<string, unknown>>(`SELECT m.*, a.name AS agent_name, a.emoji AS agent_emoji, ${UNDOABLE_COUNT} FROM messages m LEFT JOIN agents a ON a.id = m.agent_id WHERE m.id = ?`, [result.meta.last_row_id]);
  return rowToMessage(row!);
}

/** Re-read one message, e.g. after an undo changed what it still has standing. */
export async function getMessage(id: number): Promise<ChatMessage | null> {
  const row = await first<Record<string, unknown>>(`SELECT m.*, a.name AS agent_name, a.emoji AS agent_emoji, ${UNDOABLE_COUNT} FROM messages m LEFT JOIN agents a ON a.id = m.agent_id WHERE m.id = ?`, [id]);
  return row ? rowToMessage(row) : null;
}
