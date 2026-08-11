import { ensureDb } from "./db";
import {
  Activity,
  ACTIVITY_TYPES,
  Agent,
  CAPABILITY_ENTITIES,
  Capabilities,
  ChatThread,
  ChatThreadContext,
  ChatMessage,
  MessageUpdate,
  Contact,
  CONTACT_STATUSES,
  EMAIL_PATTERN,
  Deal,
  DEAL_STAGES,
  SalesRep,
  Task,
  TASK_STATUSES,
  ThreadFilter,
  ThreadUpdate,
  TraceEntry,
} from "./types";

function rowToThread(row: Record<string, unknown>): ChatThread {
  return {
    id: Number(row.id),
    title: String(row.title),
    account_name: (row.account_name as string) ?? null,
    pinned: Boolean(row.pinned),
    unread: Boolean(row.unread),
    archived_at: (row.archived_at as string) ?? null,
    message_count: Number(row.message_count ?? 0),
    last_message: (row.last_message as string) ?? null,
    last_message_at: (row.last_message_at as string) ?? null,
    agent_names: String(row.agent_names ?? "").split(",").map((name) => name.trim()).filter(Boolean),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function rowToThreadContext(row: Record<string, unknown>): ChatThreadContext {
  return {
    ...rowToThread(row),
    memory: (row.memory as string) ?? null,
    continued_from_thread_id: row.continued_from_thread_id == null ? null : Number(row.continued_from_thread_id),
  };
}

function rowToAgent(row: Record<string, unknown>): Agent {
  const caps: Capabilities = { contacts: "none", deals: "none", activities: "none", tasks: "none", sales_reps: "none", workflows: "none" };
  const legacyAutonomy = row.autonomy === "ask" ? "ask" : "auto";
  try {
    const parsed = JSON.parse(String(row.capabilities || "{}"));
    for (const e of CAPABILITY_ENTITIES) {
      if (parsed[e] === "read" || parsed[e] === "write_ask" || parsed[e] === "write_full") caps[e] = parsed[e];
      else if (parsed[e] === "write") caps[e] = legacyAutonomy === "ask" ? "write_ask" : "write_full";
    }
  } catch {}
  return {
    id: Number(row.id),
    name: String(row.name),
    emoji: String(row.emoji),
    instructions: String(row.instructions),
    capabilities: caps,
    autonomy: legacyAutonomy,
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

const THREAD_SELECT = `SELECT t.*,
  (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id) AS message_count,
  (SELECT m.content FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message,
  (SELECT m.created_at FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
  (SELECT GROUP_CONCAT(DISTINCT a.name) FROM messages m JOIN agents a ON a.id = m.agent_id WHERE m.thread_id = t.id) AS agent_names,
  CASE WHEN t.last_read_message_id IS NULL THEN 0 ELSE EXISTS (
    SELECT 1 FROM messages unread_message
    WHERE unread_message.thread_id = t.id AND unread_message.id > t.last_read_message_id
  ) END AS unread
  FROM threads t`;

export async function listThreads(filter: ThreadFilter = "active"): Promise<ChatThread[]> {
  const where = filter === "all" ? "" : filter === "archived" ? "WHERE t.archived_at IS NOT NULL" : "WHERE t.archived_at IS NULL";
  const rows = await all<Record<string, unknown>>(
    `${THREAD_SELECT} ${where}
      ORDER BY t.pinned DESC, COALESCE(last_message_at, t.created_at) DESC, t.id DESC`
  );
  return rows.map(rowToThread);
}

export async function getThread(id: number): Promise<ChatThreadContext | null> {
  const row = await first<Record<string, unknown>>(`${THREAD_SELECT} WHERE t.id = ?`, [id]);
  return row ? rowToThreadContext(row) : null;
}

/** Start a normal chat without asking the user to classify it up front. */
export async function createConversationThread(): Promise<ChatThread> {
  // Reuse the latest untouched draft so repeated clicks cannot fill history
  // with empty conversations.
  const empty = await first<Record<string, unknown>>(
    `${THREAD_SELECT} WHERE t.id <> 1 AND t.account_name IS NULL AND t.archived_at IS NULL
      AND t.memory IS NULL
      AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id)
      ORDER BY t.id DESC LIMIT 1`
  );
  if (empty) return rowToThread(empty);

  const result = await run("INSERT INTO threads (title, account_name, last_read_message_id) VALUES ('New conversation', NULL, 0)");
  const row = await first<Record<string, unknown>>(`${THREAD_SELECT} WHERE t.id = ?`, [result.meta.last_row_id]);
  if (!row) throw new Error("Could not start a new conversation");
  return rowToThread(row);
}

export async function createAccountThread(accountNameInput: string): Promise<ChatThread> {
  const accountName = accountNameInput.trim().replace(/\s+/g, " ");
  if (!accountName) throw new Error("Account name is required");
  if (accountName.length > 80) throw new Error("Account name must be 80 characters or fewer");
  await run(
    `INSERT INTO threads (title, account_name, last_read_message_id) VALUES (?, ?, 0)
      ON CONFLICT(account_name) DO UPDATE SET archived_at = NULL, updated_at = datetime('now')`,
    [accountName, accountName]
  );
  const row = await first<Record<string, unknown>>(
    `${THREAD_SELECT} WHERE t.account_name = ? COLLATE NOCASE`,
    [accountName]
  );
  if (!row) throw new Error("Could not create that account thread");
  return rowToThread(row);
}

export async function updateThread(id: number, input: ThreadUpdate): Promise<ChatThread | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  if (input.archived && id === 1) throw new Error("The Home conversation cannot be archived");

  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.title !== undefined) {
    const title = input.title.trim().replace(/\s+/g, " ");
    if (!title) throw new Error("Conversation name is required");
    if (title.length > 120) throw new Error("Conversation name must be 120 characters or fewer");
    fields.push("title = ?");
    values.push(title);
  }
  if (input.archived !== undefined) {
    fields.push(`archived_at = ${input.archived ? "datetime('now')" : "NULL"}`);
    if (input.archived) fields.push("pinned = 0");
  }
  if (input.pinned !== undefined && !input.archived) {
    fields.push("pinned = ?");
    values.push(input.pinned ? 1 : 0);
  }
  if (input.read !== undefined) {
    fields.push(input.read
      ? "last_read_message_id = COALESCE((SELECT MAX(read_message.id) FROM messages read_message WHERE read_message.thread_id = threads.id), 0)"
      : "last_read_message_id = MAX(COALESCE((SELECT MAX(unread_message.id) FROM messages unread_message WHERE unread_message.thread_id = threads.id), 1) - 1, 0)"
    );
  }
  if (fields.length === 0) throw new Error("No supported conversation changes were provided");

  values.push(id);
  const result = await run(`UPDATE threads SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`, values);
  if (result.meta.changes === 0) return null;
  const row = await first<Record<string, unknown>>(`${THREAD_SELECT} WHERE t.id = ?`, [id]);
  return row ? rowToThread(row) : null;
}

/** Create an empty chat whose agents receive only a compact memory of the source chat. */
export async function createContinuationThread(sourceThreadId: number, memory: string): Promise<ChatThread> {
  const source = await getThread(sourceThreadId);
  if (!source) throw new Error("Conversation not found");
  const result = await run(
    "INSERT INTO threads (title, account_name, last_read_message_id, memory, continued_from_thread_id) VALUES ('New conversation', NULL, 0, ?, ?)",
    [memory.trim() || null, sourceThreadId]
  );
  const row = await first<Record<string, unknown>>(`${THREAD_SELECT} WHERE t.id = ?`, [result.meta.last_row_id]);
  if (!row) throw new Error("Could not continue that conversation");
  return rowToThread(row);
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
  const caps: Capabilities = { contacts: "none", deals: "none", activities: "none", tasks: "none", sales_reps: "none", workflows: "none" };
  for (const e of CAPABILITY_ENTITIES) {
    const value = input.capabilities?.[e];
    if (value === "read" || value === "write_ask" || value === "write_full") caps[e] = value;
    else if (value === "write") caps[e] = input.autonomy === "ask" ? "write_ask" : "write_full";
  }
  const result = await run(
    "INSERT INTO agents (name, emoji, instructions, capabilities, autonomy, model) VALUES (?, ?, ?, ?, ?, ?)",
    [input.name.trim(), input.emoji?.trim() || "bot", input.instructions ?? "", JSON.stringify(caps), input.autonomy === "ask" ? "ask" : "auto", input.model || "claude-sonnet-5"],
  );
  return (await getAgent(Number(result.meta.last_row_id)))!;
}

export async function updateAgent(id: number, input: {
  name?: string; emoji?: string; instructions?: string; capabilities?: Partial<Capabilities>; autonomy?: string; model?: string;
}): Promise<Agent | null> {
  const existing = await getAgent(id);
  if (!existing) return null;
  const caps = { ...existing.capabilities };
  for (const e of CAPABILITY_ENTITIES) {
    const value = input.capabilities?.[e];
    if (value === "none" || value === "read" || value === "write_ask" || value === "write_full") caps[e] = value;
    else if (value === "write") caps[e] = input.autonomy === "ask" ? "write_ask" : "write_full";
  }
  const autonomy = input.autonomy === "ask" || input.autonomy === "auto" ? input.autonomy : existing.autonomy;
  await run("UPDATE agents SET name = ?, emoji = ?, instructions = ?, capabilities = ?, autonomy = ?, model = ? WHERE id = ?", [
    (input.name ?? existing.name).trim(),
    (input.emoji ?? existing.emoji).trim() || "bot",
    input.instructions ?? existing.instructions,
    JSON.stringify(caps),
    autonomy,
    input.model ?? existing.model,
    id,
  ]);
  return getAgent(id);
}

export async function deleteAgent(id: number): Promise<boolean> {
  await run("UPDATE routines SET enabled = 0, next_run_at = NULL, lock_token = NULL, locked_at = NULL, updated_at = datetime('now') WHERE agent_id = ?", [id]);
  return (await run("DELETE FROM agents WHERE id = ?", [id])).meta.changes > 0;
}

const SALES_REP_SELECT = `SELECT sr.*,
  (SELECT COUNT(*) FROM contacts c WHERE c.sales_rep_id = sr.id) AS contact_count,
  (SELECT COUNT(*) FROM deals d WHERE d.closed_by_sales_rep_id = sr.id AND d.stage = 'won') AS won_deal_count,
  (SELECT COALESCE(SUM(d.value), 0) FROM deals d WHERE d.closed_by_sales_rep_id = sr.id AND d.stage = 'won') AS won_value
  FROM sales_reps sr`;

export async function listSalesReps(): Promise<SalesRep[]> {
  return all<SalesRep>(`${SALES_REP_SELECT} ORDER BY sr.name COLLATE NOCASE, sr.id`);
}

export async function getSalesRep(id: number): Promise<SalesRep | null> {
  return first<SalesRep>(`${SALES_REP_SELECT} WHERE sr.id = ?`, [id]);
}

export async function createSalesRep(input: { name: string; email?: string | null; phone?: string | null }): Promise<SalesRep> {
  if (!input.name?.trim()) throw new Error("Sales rep name is required");
  const result = await run("INSERT INTO sales_reps (name, email, phone) VALUES (?, ?, ?)", [
    input.name.trim(), input.email?.trim() || null, input.phone?.trim() || null,
  ]);
  return (await getSalesRep(Number(result.meta.last_row_id)))!;
}

export async function updateSalesRep(id: number, input: Partial<Pick<SalesRep, "name" | "email" | "phone">>): Promise<SalesRep> {
  const existing = await getSalesRep(id);
  if (!existing) throw new Error(`Sales rep ${id} not found`);
  const name = input.name === undefined ? existing.name : input.name.trim();
  if (!name) throw new Error("Sales rep name is required");
  await run("UPDATE sales_reps SET name = ?, email = ?, phone = ?, updated_at = datetime('now') WHERE id = ?", [
    name,
    input.email === undefined ? existing.email : input.email?.trim() || null,
    input.phone === undefined ? existing.phone : input.phone?.trim() || null,
    id,
  ]);
  return (await getSalesRep(id))!;
}

export async function listContacts(filter?: { query?: string; status?: string; sales_rep_id?: number }): Promise<Contact[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.query) {
    clauses.push("(c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ?)");
    const query = `%${filter.query}%`;
    params.push(query, query, query);
  }
  if (filter?.status && (CONTACT_STATUSES as readonly string[]).includes(filter.status)) {
    clauses.push("c.status = ?");
    params.push(filter.status);
  }
  if (filter?.sales_rep_id) { clauses.push("c.sales_rep_id = ?"); params.push(filter.sales_rep_id); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Contact>(`SELECT c.*, sr.name AS sales_rep_name FROM contacts c LEFT JOIN sales_reps sr ON sr.id = c.sales_rep_id ${where} ORDER BY c.updated_at DESC`, params);
}

export async function getContact(id: number): Promise<(Contact & { deals: Deal[]; activities: Activity[] }) | null> {
  const contact = await first<Contact>("SELECT c.*, sr.name AS sales_rep_name FROM contacts c LEFT JOIN sales_reps sr ON sr.id = c.sales_rep_id WHERE c.id = ?", [id]);
  if (!contact) return null;
  const [deals, activities] = await Promise.all([
    all<Deal>("SELECT * FROM deals WHERE contact_id = ? ORDER BY updated_at DESC", [id]),
    all<Activity>("SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 20", [id]),
  ]);
  return { ...contact, deals, activities };
}

export async function createContact(input: {
  name: string; email?: string | null; phone?: string | null; company?: string | null; sales_rep_id?: number | null; status?: string; notes?: string | null;
}): Promise<Contact> {
  if (!input.name?.trim()) throw new Error("Contact name is required");
  const email = input.email?.trim() || null;
  if (email && !EMAIL_PATTERN.test(email)) throw new Error("Invalid email address");
  const status = (CONTACT_STATUSES as readonly string[]).includes(input.status ?? "") ? input.status! : "lead";
  if (input.sales_rep_id != null && !(await getSalesRep(input.sales_rep_id))) throw new Error(`Sales rep ${input.sales_rep_id} not found`);
  const result = await run("INSERT INTO contacts (name, email, phone, company, sales_rep_id, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    input.name.trim(), email, input.phone ?? null, input.company ?? null, input.sales_rep_id ?? null, status, input.notes ?? null,
  ]);
  return (await getContact(Number(result.meta.last_row_id)))!;
}

export async function updateContact(id: number, input: Partial<Pick<Contact, "name" | "email" | "phone" | "company" | "sales_rep_id" | "status" | "notes">>): Promise<Contact> {
  const existing = await first<Contact>("SELECT * FROM contacts WHERE id = ?", [id]);
  if (!existing) throw new Error(`Contact ${id} not found`);
  if (input.status && !(CONTACT_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error(`Invalid status "${input.status}". Valid: ${CONTACT_STATUSES.join(", ")}`);
  }
  if (input.sales_rep_id != null && !(await getSalesRep(input.sales_rep_id))) throw new Error(`Sales rep ${input.sales_rep_id} not found`);
  const email = input.email === undefined ? existing.email : input.email?.trim() || null;
  if (email && !EMAIL_PATTERN.test(email)) throw new Error("Invalid email address");
  await run("UPDATE contacts SET name = ?, email = ?, phone = ?, company = ?, sales_rep_id = ?, status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?", [
    input.name ?? existing.name,
    email,
    input.phone !== undefined ? input.phone : existing.phone,
    input.company !== undefined ? input.company : existing.company,
    input.sales_rep_id !== undefined ? input.sales_rep_id : existing.sales_rep_id,
    input.status ?? existing.status,
    input.notes !== undefined ? input.notes : existing.notes,
    id,
  ]);
  return (await getContact(id))!;
}

export async function listDeals(filter?: { stage?: string; contact_id?: number }): Promise<Deal[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.stage && (DEAL_STAGES as readonly string[]).includes(filter.stage)) { clauses.push("d.stage = ?"); params.push(filter.stage); }
  if (filter?.contact_id) { clauses.push("d.contact_id = ?"); params.push(filter.contact_id); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Deal>(`SELECT d.*, c.name AS contact_name, sr.name AS closed_by_sales_rep_name FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id LEFT JOIN sales_reps sr ON sr.id = d.closed_by_sales_rep_id ${where} ORDER BY d.updated_at DESC`, params);
}

export async function createDeal(input: {
  title: string; contact_id?: number | null; value?: number; stage?: string; notes?: string | null; closed_by_sales_rep_id?: number | null;
}): Promise<Deal> {
  if (!input.title?.trim()) throw new Error("Deal title is required");
  if (input.contact_id != null && !(await first("SELECT id FROM contacts WHERE id = ?", [input.contact_id]))) throw new Error(`Contact ${input.contact_id} not found`);
  const stage = (DEAL_STAGES as readonly string[]).includes(input.stage ?? "") ? input.stage! : "lead";
  if (input.closed_by_sales_rep_id != null && !(await getSalesRep(input.closed_by_sales_rep_id))) throw new Error(`Sales rep ${input.closed_by_sales_rep_id} not found`);
  if (input.closed_by_sales_rep_id != null && stage !== "won" && stage !== "lost") throw new Error("A deal can only have a closing sales rep when it is won or lost");
  const result = await run("INSERT INTO deals (title, contact_id, value, stage, notes, closed_by_sales_rep_id, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    input.title.trim(), input.contact_id ?? null, Number(input.value) || 0, stage, input.notes ?? null,
    input.closed_by_sales_rep_id ?? null, stage === "won" || stage === "lost" ? new Date().toISOString() : null,
  ]);
  return (await first<Deal>("SELECT d.*, c.name AS contact_name, sr.name AS closed_by_sales_rep_name FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id LEFT JOIN sales_reps sr ON sr.id = d.closed_by_sales_rep_id WHERE d.id = ?", [result.meta.last_row_id]))!;
}

export async function updateDeal(id: number, input: Partial<Pick<Deal, "title" | "contact_id" | "value" | "stage" | "notes" | "closed_by_sales_rep_id">>): Promise<Deal> {
  const existing = await first<Deal>("SELECT * FROM deals WHERE id = ?", [id]);
  if (!existing) throw new Error(`Deal ${id} not found`);
  if (input.stage && !(DEAL_STAGES as readonly string[]).includes(input.stage)) throw new Error(`Invalid stage "${input.stage}". Valid: ${DEAL_STAGES.join(", ")}`);
  if (input.contact_id != null && !(await first("SELECT id FROM contacts WHERE id = ?", [input.contact_id]))) throw new Error(`Contact ${input.contact_id} not found`);
  if (input.closed_by_sales_rep_id != null && !(await getSalesRep(input.closed_by_sales_rep_id))) throw new Error(`Sales rep ${input.closed_by_sales_rep_id} not found`);
  const stage = input.stage ?? existing.stage;
  const closer = input.closed_by_sales_rep_id !== undefined ? input.closed_by_sales_rep_id : existing.closed_by_sales_rep_id;
  if (closer != null && stage !== "won" && stage !== "lost") throw new Error("A deal can only have a closing sales rep when it is won or lost");
  const closedAt = stage === "won" || stage === "lost" ? existing.closed_at ?? new Date().toISOString() : null;
  await run("UPDATE deals SET title = ?, contact_id = ?, value = ?, stage = ?, notes = ?, closed_by_sales_rep_id = ?, closed_at = ?, updated_at = datetime('now') WHERE id = ?", [
    input.title ?? existing.title,
    input.contact_id !== undefined ? input.contact_id : existing.contact_id,
    input.value !== undefined ? Number(input.value) || 0 : existing.value,
    stage,
    input.notes !== undefined ? input.notes : existing.notes,
    stage === "won" || stage === "lost" ? closer : null,
    closedAt,
    id,
  ]);
  return (await first<Deal>("SELECT d.*, c.name AS contact_name, sr.name AS closed_by_sales_rep_name FROM deals d LEFT JOIN contacts c ON c.id = d.contact_id LEFT JOIN sales_reps sr ON sr.id = d.closed_by_sales_rep_id WHERE d.id = ?", [id]))!;
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

export async function listTasks(filter?: { status?: string; sales_rep_id?: number }): Promise<Task[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.status && (TASK_STATUSES as readonly string[]).includes(filter.status)) { clauses.push("t.status = ?"); params.push(filter.status); }
  if (filter?.sales_rep_id) { clauses.push("t.assignee_sales_rep_id = ?"); params.push(filter.sales_rep_id); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Task>(`SELECT t.*, a.name AS assignee_name, a.emoji AS assignee_emoji, sr.name AS assignee_sales_rep_name FROM tasks t LEFT JOIN agents a ON a.id = t.assignee_agent_id LEFT JOIN sales_reps sr ON sr.id = t.assignee_sales_rep_id ${where} ORDER BY t.id DESC`, params);
}

export async function getTask(id: number): Promise<Task | null> {
  return first<Task>("SELECT t.*, a.name AS assignee_name, a.emoji AS assignee_emoji, sr.name AS assignee_sales_rep_name FROM tasks t LEFT JOIN agents a ON a.id = t.assignee_agent_id LEFT JOIN sales_reps sr ON sr.id = t.assignee_sales_rep_id WHERE t.id = ?", [id]);
}

export async function createTask(input: { title: string; description?: string | null; assignee_agent_id?: number | null; assignee_sales_rep_id?: number | null }): Promise<Task> {
  if (!input.title?.trim()) throw new Error("Task title is required");
  if (input.assignee_agent_id != null && input.assignee_sales_rep_id != null) throw new Error("A task can only have one assignee");
  if (input.assignee_agent_id != null && !(await getAgent(input.assignee_agent_id))) throw new Error(`Agent ${input.assignee_agent_id} not found`);
  if (input.assignee_sales_rep_id != null && !(await getSalesRep(input.assignee_sales_rep_id))) throw new Error(`Sales rep ${input.assignee_sales_rep_id} not found`);
  const result = await run("INSERT INTO tasks (title, description, assignee_agent_id, assignee_sales_rep_id) VALUES (?, ?, ?, ?)", [input.title.trim(), input.description ?? null, input.assignee_agent_id ?? null, input.assignee_sales_rep_id ?? null]);
  return (await getTask(Number(result.meta.last_row_id)))!;
}

export async function updateTask(id: number, input: Partial<Pick<Task, "title" | "description" | "assignee_agent_id" | "assignee_sales_rep_id" | "status" | "result">>): Promise<Task> {
  const existing = await getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);
  if (input.status && !(TASK_STATUSES as readonly string[]).includes(input.status)) throw new Error(`Invalid status "${input.status}". Valid: ${TASK_STATUSES.join(", ")}`);
  if (input.assignee_agent_id != null && !(await getAgent(input.assignee_agent_id))) throw new Error(`Agent ${input.assignee_agent_id} not found`);
  if (input.assignee_sales_rep_id != null && !(await getSalesRep(input.assignee_sales_rep_id))) throw new Error(`Sales rep ${input.assignee_sales_rep_id} not found`);
  let assigneeAgentId = input.assignee_agent_id !== undefined ? input.assignee_agent_id : existing.assignee_agent_id;
  let assigneeSalesRepId = input.assignee_sales_rep_id !== undefined ? input.assignee_sales_rep_id : existing.assignee_sales_rep_id;
  if (input.assignee_agent_id != null) assigneeSalesRepId = null;
  if (input.assignee_sales_rep_id != null) assigneeAgentId = null;
  if (assigneeAgentId != null && assigneeSalesRepId != null) throw new Error("A task can only have one assignee");
  await run("UPDATE tasks SET title = ?, description = ?, assignee_agent_id = ?, assignee_sales_rep_id = ?, status = ?, result = ?, updated_at = datetime('now') WHERE id = ?", [
    input.title ?? existing.title,
    input.description !== undefined ? input.description : existing.description,
    assigneeAgentId,
    assigneeSalesRepId,
    input.status ?? existing.status,
    input.result !== undefined ? input.result : existing.result,
    id,
  ]);
  return (await getTask(id))!;
}

/** Counts the writes still standing behind a message, i.e. what Undo would reverse. */
const UNDOABLE_COUNT =
  "(SELECT COUNT(*) FROM mutations mu WHERE mu.message_id = m.id AND mu.undone_at IS NULL) AS undoable";

const MESSAGE_SELECT = `SELECT
  m.*,
  a.name AS agent_name,
  a.emoji AS agent_emoji,
  reply.content AS reply_to_content,
  reply.role AS reply_to_role,
  reply_agent.name AS reply_to_agent_name,
  forwarded.role AS forwarded_from_role,
  forwarded_agent.name AS forwarded_from_agent_name,
  ${UNDOABLE_COUNT}
  FROM messages m
  LEFT JOIN agents a ON a.id = m.agent_id
  LEFT JOIN messages reply ON reply.id = m.reply_to_id
  LEFT JOIN agents reply_agent ON reply_agent.id = reply.agent_id
  LEFT JOIN messages forwarded ON forwarded.id = m.forwarded_from_id
  LEFT JOIN agents forwarded_agent ON forwarded_agent.id = forwarded.agent_id`;

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id),
    thread_id: Number(row.thread_id ?? 1),
    role: row.role as "user" | "agent",
    agent_id: row.agent_id == null ? null : Number(row.agent_id),
    agent_name: (row.agent_name as string) ?? null,
    agent_emoji: (row.agent_emoji as string) ?? null,
    content: String(row.content),
    trace: safeParseTrace(row.trace),
    is_error: Boolean(row.is_error),
    liked: Boolean(row.liked),
    reaction: (row.reaction as ChatMessage["reaction"]) ?? null,
    pinned: Boolean(row.pinned),
    starred: Boolean(row.starred),
    feedback: (row.feedback as ChatMessage["feedback"]) ?? null,
    reply_to_id: row.reply_to_id == null ? null : Number(row.reply_to_id),
    reply_to_content: (row.reply_to_content as string) ?? null,
    reply_to_role: (row.reply_to_role as ChatMessage["reply_to_role"]) ?? null,
    reply_to_agent_name: (row.reply_to_agent_name as string) ?? null,
    forwarded_from_id: row.forwarded_from_id == null ? null : Number(row.forwarded_from_id),
    forwarded_from_role: (row.forwarded_from_role as ChatMessage["forwarded_from_role"]) ?? null,
    forwarded_from_agent_name: (row.forwarded_from_agent_name as string) ?? null,
    undoable: Number(row.undoable ?? 0),
    created_at: String(row.created_at),
  };
}

export async function listMessages(limit = 200, threadId = 1): Promise<ChatMessage[]> {
  const rows = await all<Record<string, unknown>>(`${MESSAGE_SELECT} WHERE m.thread_id = ? ORDER BY m.id DESC LIMIT ${Math.min(Math.max(limit, 1), 500)}`, [threadId]);
  return rows.reverse().map(rowToMessage);
}

function safeParseTrace(raw: unknown): TraceEntry[] {
  try { const parsed = JSON.parse(String(raw ?? "[]")); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function insertMessage(input: {
  role: "user" | "agent";
  thread_id?: number;
  agent_id?: number | null;
  content: string;
  trace?: TraceEntry[];
  is_error?: boolean;
  reply_to_id?: number | null;
  forwarded_from_id?: number | null;
}): Promise<ChatMessage> {
  const threadId = input.thread_id ?? 1;
  const replyToId = input.reply_to_id ?? null;
  if (replyToId != null) {
    if (!Number.isInteger(replyToId) || replyToId < 1) throw new Error("Invalid reply target");
    const reply = await first<{ id: number }>("SELECT id FROM messages WHERE id = ? AND thread_id = ?", [replyToId, threadId]);
    if (!reply) throw new Error("The message being replied to is unavailable");
  }
  const forwardedFromId = input.forwarded_from_id ?? null;
  if (forwardedFromId != null) {
    if (!Number.isInteger(forwardedFromId) || forwardedFromId < 1) throw new Error("Invalid forwarded message");
    if (!(await first<{ id: number }>("SELECT id FROM messages WHERE id = ?", [forwardedFromId]))) {
      throw new Error("The message being forwarded is unavailable");
    }
  }
  // Databases created before read tracking treat their existing history as read,
  // then only messages arriving after this point can make the chat unread.
  await run(
    `UPDATE threads SET last_read_message_id = COALESCE(
      last_read_message_id,
      (SELECT COALESCE(MAX(existing_message.id), 0) FROM messages existing_message WHERE existing_message.thread_id = threads.id)
    ) WHERE id = ?`,
    [threadId]
  );
  const result = await run("INSERT INTO messages (thread_id, role, agent_id, content, trace, is_error, reply_to_id, forwarded_from_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    threadId,
    input.role,
    input.agent_id ?? null,
    input.content,
    JSON.stringify(input.trace ?? []),
    input.is_error ? 1 : 0,
    replyToId,
    forwardedFromId,
  ]);
  if (input.role === "user") {
    await run("UPDATE threads SET last_read_message_id = ? WHERE id = ?", [result.meta.last_row_id, threadId]);
  }
  const normalized = input.content.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ");
  const automaticTitle = `${words.slice(0, 8).join(" ")}${words.length > 8 ? "…" : ""}`.slice(0, 80);
  await run(
    `UPDATE threads SET
      title = CASE WHEN account_name IS NULL AND title = 'New conversation' AND ? = 'user' THEN ? ELSE title END,
      updated_at = datetime('now')
      WHERE id = ?`,
    [input.role, automaticTitle || "Conversation", threadId]
  );
  const row = await first<Record<string, unknown>>(`${MESSAGE_SELECT} WHERE m.id = ?`, [result.meta.last_row_id]);
  return rowToMessage(row!);
}

/** Re-read one message, e.g. after an undo changed what it still has standing. */
export async function getMessage(id: number): Promise<ChatMessage | null> {
  const row = await first<Record<string, unknown>>(`${MESSAGE_SELECT} WHERE m.id = ?`, [id]);
  return row ? rowToMessage(row) : null;
}

export async function updateMessage(id: number, input: MessageUpdate): Promise<ChatMessage | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  const existing = await getMessage(id);
  if (!existing) return null;
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.content !== undefined) {
    if (existing.role !== "user") return null;
    const content = input.content.trim();
    if (!content) return null;
    fields.push("content = ?");
    values.push(content);
  }
  if (input.reaction !== undefined) { fields.push("reaction = ?"); values.push(input.reaction); }
  if (input.pinned !== undefined) { fields.push("pinned = ?"); values.push(input.pinned ? 1 : 0); }
  if (input.starred !== undefined) { fields.push("starred = ?"); values.push(input.starred ? 1 : 0); }
  if (input.feedback !== undefined) { fields.push("feedback = ?"); values.push(input.feedback); }
  if (fields.length === 0) return getMessage(id);
  values.push(id);
  await run(`UPDATE messages SET ${fields.join(", ")} WHERE id = ?`, values);
  if (input.content !== undefined) {
    await run("UPDATE threads SET updated_at = datetime('now') WHERE id = ?", [existing.thread_id]);
  }
  return getMessage(id);
}

export async function deleteMessage(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id < 1) return false;
  const existing = await getMessage(id);
  if (!existing) return false;
  await run("DELETE FROM messages WHERE id = ?", [id]);
  await run("UPDATE threads SET updated_at = datetime('now') WHERE id = ?", [existing.thread_id]);
  return true;
}
