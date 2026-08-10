import { sql } from "drizzle-orm";
import { AnySQLiteColumn, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("bot"),
  instructions: text("instructions").notNull().default(""),
  capabilities: text("capabilities").notNull().default("{}"),
  autonomy: text("autonomy").notNull().default("auto"),
  model: text("model").notNull().default("claude-sonnet-5"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const salesReps = sqliteTable("sales_reps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_sales_reps_name").on(table.name)]);

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), email: text("email"), phone: text("phone"), company: text("company"),
  salesRepId: integer("sales_rep_id").references(() => salesReps.id, { onDelete: "set null" }),
  status: text("status").notNull().default("lead"), notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("idx_contacts_updated_at").on(table.updatedAt),
  index("idx_contacts_sales_rep_id").on(table.salesRepId),
]);

export const deals = sqliteTable("deals", {
  id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  closedBySalesRepId: integer("closed_by_sales_rep_id").references(() => salesReps.id, { onDelete: "set null" }),
  closedAt: text("closed_at"),
  value: real("value").notNull().default(0), stage: text("stage").notNull().default("lead"), notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("idx_deals_updated_at").on(table.updatedAt),
  index("idx_deals_closed_by_sales_rep_id").on(table.closedBySalesRepId),
]);

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }), type: text("type").notNull().default("note"),
  content: text("content").notNull(), contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }), actor: text("actor").notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_activities_contact_id").on(table.contactId), index("idx_activities_deal_id").on(table.dealId)]);

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }), title: text("title").notNull(), description: text("description"),
  assigneeAgentId: integer("assignee_agent_id").references(() => agents.id, { onDelete: "set null" }),
  assigneeSalesRepId: integer("assignee_sales_rep_id").references(() => salesReps.id, { onDelete: "set null" }),
  status: text("status").notNull().default("todo"), result: text("result"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("idx_tasks_status").on(table.status),
  index("idx_tasks_assignee_sales_rep_id").on(table.assigneeSalesRepId),
]);

export const threads = sqliteTable("threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  accountName: text("account_name").unique(),
  pinned: integer("pinned").notNull().default(0),
  lastReadMessageId: integer("last_read_message_id"),
  memory: text("memory"),
  continuedFromThreadId: integer("continued_from_thread_id").references((): AnySQLiteColumn => threads.id, { onDelete: "set null" }),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }), role: text("role").notNull(),
  threadId: integer("thread_id").notNull().default(1).references(() => threads.id),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "set null" }), content: text("content").notNull(),
  trace: text("trace").notNull().default("[]"), isError: integer("is_error").notNull().default(0),
  liked: integer("liked").notNull().default(0),
  reaction: text("reaction"),
  pinned: integer("pinned").notNull().default(0),
  starred: integer("starred").notNull().default(0),
  feedback: text("feedback"),
  replyToId: integer("reply_to_id").references((): AnySQLiteColumn => messages.id, { onDelete: "set null" }),
  forwardedFromId: integer("forwarded_from_id").references((): AnySQLiteColumn => messages.id, { onDelete: "set null" }),
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

/** CRM writes held until the user decides, including all contact creation. */
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

/** A workflow points at one immutable definition version at a time. */
export const workflows = sqliteTable("workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  currentVersion: integer("current_version").notNull().default(1),
  createdByAgentId: integer("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_workflows_status").on(table.status, table.updatedAt)]);

export const workflowVersions = sqliteTable("workflow_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  definition: text("definition").notNull(),
  changeSummary: text("change_summary").notNull().default("Initial workflow"),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("idx_workflow_versions_number").on(table.workflowId, table.version),
  index("idx_workflow_versions_workflow").on(table.workflowId, table.createdAt),
]);

export const workflowRuns = sqliteTable("workflow_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: text("status").notNull().default("running"),
  trigger: text("trigger").notNull().default("test"),
  input: text("input").notNull().default("{}"),
  trace: text("trace").notNull().default("[]"),
  output: text("output"),
  error: text("error"),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
}, (table) => [index("idx_workflow_runs_workflow").on(table.workflowId, table.startedAt)]);
