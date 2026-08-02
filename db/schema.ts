import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }), role: text("role").notNull(),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "set null" }), content: text("content").notNull(),
  trace: text("trace").notNull().default("[]"), isError: integer("is_error").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [index("idx_messages_agent_id").on(table.agentId)]);

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
