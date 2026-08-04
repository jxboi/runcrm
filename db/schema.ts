import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🤖"),
  instructions: text("instructions").notNull().default(""),
  capabilities: text("capabilities").notNull().default("{}"),
  autonomy: text("autonomy").notNull().default("auto"),
  model: text("model").notNull().default("claude-opus-5"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), email: text("email"), phone: text("phone"), company: text("company"),
  status: text("status").notNull().default("lead"), notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_contacts_updated_at").on(table.updatedAt)]);

export const deals = sqliteTable("deals", {
  id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  value: real("value").notNull().default(0), stage: text("stage").notNull().default("lead"), notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_deals_updated_at").on(table.updatedAt)]);

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }), type: text("type").notNull().default("note"),
  content: text("content").notNull(), contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }), actor: text("actor").notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_activities_contact_id").on(table.contactId), index("idx_activities_deal_id").on(table.dealId)]);

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(), description: text("description"),
  assigneeAgentId: integer("assignee_agent_id").references(() => agents.id, { onDelete: "set null" }),
  status: text("status").notNull().default("todo"), result: text("result"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_tasks_status").on(table.status)]);

export const threads = sqliteTable("threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  accountName: text("account_name").unique(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }), role: text("role").notNull(),
  threadId: integer("thread_id").notNull().default(1).references(() => threads.id),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "set null" }), content: text("content").notNull(),
  trace: text("trace").notNull().default("[]"), isError: integer("is_error").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_messages_agent_id").on(table.agentId), index("idx_messages_thread_id").on(table.threadId, table.id)]);

/** Journal of every agent write, so any change can be explained and undone. */
export const mutations = sqliteTable("mutations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "set null" }),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "set null" }),
  tool: text("tool").notNull(), entity: text("entity").notNull(), entityId: integer("entity_id").notNull(),
  before: text("before"), after: text("after"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  undoneAt: text("undone_at"),
}, (table) => [index("idx_mutations_message_id").on(table.messageId)]);

/** Writes an "ask" agent wants to make, held until the user decides. */
export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "set null" }),
  tool: text("tool").notNull(), input: text("input").notNull().default("{}"),
  status: text("status").notNull().default("pending"), result: text("result"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  decidedAt: text("decided_at"),
}, (table) => [index("idx_proposals_status").on(table.status)]);

export const workspaceSettings = sqliteTable("workspace_settings", {
  id: integer("id").primaryKey(),
  timezone: text("timezone").notNull().default("UTC"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const routines = sqliteTable("routines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  instructions: text("instructions").notNull(),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "set null" }),
  schedule: text("schedule").notNull(),
  enabled: integer("enabled").notNull().default(1),
  archivedAt: text("archived_at"),
  nextRunAt: text("next_run_at"),
  lockToken: text("lock_token"),
  lockedAt: text("locked_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_routines_due").on(table.enabled, table.archivedAt, table.nextRunAt)]);

export const routineRuns = sqliteTable("routine_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  routineId: integer("routine_id").references(() => routines.id, { onDelete: "set null" }),
  runKey: text("run_key").notNull(),
  trigger: text("trigger").notNull(),
  scheduledFor: text("scheduled_for"),
  status: text("status").notNull().default("running"),
  result: text("result"),
  error: text("error"),
  triggerMessageId: integer("trigger_message_id").references(() => messages.id, { onDelete: "set null" }),
  retriedFromRunId: integer("retried_from_run_id"),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("idx_routine_runs_key").on(table.runKey),
  index("idx_routine_runs_routine").on(table.routineId, table.startedAt),
]);
