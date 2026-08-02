import { env } from "cloudflare:workers";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🤖',
    instructions TEXT NOT NULL DEFAULT '',
    capabilities TEXT NOT NULL DEFAULT '{}',
    model TEXT NOT NULL DEFAULT 'claude-opus-5',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status TEXT NOT NULL DEFAULT 'lead',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    value REAL NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'lead',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'note',
    content TEXT NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
    actor TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assignee_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    trace TEXT NOT NULL DEFAULT '[]',
    is_error INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Writes an "ask" agent wants to make, held until the user decides.
  `CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    tool TEXT NOT NULL,
    input TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT
  )`,
  // Journal of every agent write, so any change can be explained and undone.
  `CREATE TABLE IF NOT EXISTS mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    tool TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    before TEXT,
    after TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    undone_at TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_mutations_message_id ON mutations(message_id)",
  "CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status)",
  "CREATE INDEX IF NOT EXISTS idx_deals_updated_at ON deals(updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id)",
  "CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)",
  "CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id)",
] as const;

let ready: Promise<D1Database> | undefined;

export function getDb(): D1Database {
  if (!env.DB) {
    throw new Error("RunCRM's hosted database is unavailable.");
  }
  return env.DB;
}

export function ensureDb(): Promise<D1Database> {
  ready ??= initializeDb();
  return ready;
}

/**
 * Columns added after v0.1. `CREATE TABLE IF NOT EXISTS` leaves existing tables
 * untouched, so new columns need an explicit ALTER on databases already in use.
 */
const addedColumns: { table: string; column: string; definition: string }[] = [
  { table: "agents", column: "autonomy", definition: "TEXT NOT NULL DEFAULT 'auto'" },
];

async function applyColumnMigrations(db: D1Database) {
  for (const { table, column, definition } of addedColumns) {
    const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    if (info.results.some((c: { name: string }) => c.name === column)) continue;
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

async function initializeDb(): Promise<D1Database> {
  const db = getDb();
  await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
  await applyColumnMigrations(db);

  const count = await db.prepare("SELECT COUNT(*) AS n FROM agents").first<{ n: number }>();
  if (!count?.n) await seed(db);
  return db;
}

async function seed(db: D1Database) {
  await db.batch([
    db.prepare("INSERT INTO agents (name, emoji, instructions, capabilities, model) VALUES (?, ?, ?, ?, ?)").bind(
      "Sales Assistant",
      "💼",
      "You are a proactive sales assistant. Keep the CRM tidy: create and update contacts and deals when asked, log activities for anything noteworthy, and always confirm exactly what you changed (names, IDs, values). Be brief and action-oriented.",
      JSON.stringify({ contacts: "write", deals: "write", activities: "write", tasks: "read" }),
      "claude-opus-5",
    ),
    db.prepare("INSERT INTO agents (name, emoji, instructions, capabilities, model) VALUES (?, ?, ?, ?, ?)").bind(
      "Data Analyst",
      "📊",
      "You are a read-only CRM analyst. Answer questions about the pipeline with concrete numbers: totals, counts, stage breakdowns, top deals. Never guess — look the data up with your tools first. Present findings compactly, leading with the headline number.",
      JSON.stringify({ contacts: "read", deals: "read", activities: "read", tasks: "read" }),
      "claude-opus-5",
    ),
  ]);

  const contacts: [string, string, string, string, string, string | null][] = [
    ["Maya Chen", "maya@acme.io", "+1 415 555 0101", "Acme Corp", "customer", "Champion for the enterprise rollout."],
    ["Tom Novak", "tom@brightlabs.com", "+1 646 555 0102", "Bright Labs", "prospect", "Evaluating against a competitor."],
    ["Sofia Reyes", "sofia@northwind.co", "+44 20 555 0103", "Northwind", "lead", null],
    ["Daniel Okafor", "dan@helixsoft.dev", "+1 206 555 0104", "HelixSoft", "prospect", "Wants SSO before signing."],
    ["Emma Larsson", "emma@polarventures.se", "+46 8 555 0105", "Polar Ventures", "customer", null],
    ["Ravi Patel", "ravi@quantumleap.ai", "+1 617 555 0106", "QuantumLeap", "lead", "Met at SaaStr booth."],
    ["Lucia Moretti", "lucia@vertexmedia.it", "+39 02 555 0107", "Vertex Media", "churned", "Churned Q2 over pricing."],
    ["James Park", "james@oakbridge.com", "+1 312 555 0108", "Oakbridge", "prospect", null],
  ];
  await db.batch(
    contacts.map((contact) =>
      db.prepare("INSERT INTO contacts (name, email, phone, company, status, notes) VALUES (?, ?, ?, ?, ?, ?)").bind(...contact),
    ),
  );

  await db.batch([
    db.prepare("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)").bind("Acme Corp — Enterprise renewal", 1, 48000, "proposal", "Renewal due end of month."),
    db.prepare("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)").bind("Bright Labs — Team plan", 2, 12000, "qualified", null),
    db.prepare("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)").bind("Northwind — Pilot", 3, 5000, "lead", null),
    db.prepare("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)").bind("HelixSoft — Growth plan", 4, 24000, "proposal", "Blocked on SSO commitment."),
    db.prepare("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)").bind("Polar Ventures — Expansion", 5, 30000, "won", "Closed last week."),
    db.prepare("INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)").bind("QuantumLeap — Starter", 6, 3600, "lead", null),
    db.prepare("INSERT INTO activities (type, content, contact_id, deal_id, actor) VALUES (?, ?, ?, ?, ?)").bind("call", "Renewal call with Maya — pricing agreed in principle, waiting on legal.", 1, 1, "user"),
    db.prepare("INSERT INTO activities (type, content, contact_id, deal_id, actor) VALUES (?, ?, ?, ?, ?)").bind("email", "Sent Bright Labs the comparison sheet vs. competitor.", 2, 2, "user"),
    db.prepare("INSERT INTO activities (type, content, contact_id, deal_id, actor) VALUES (?, ?, ?, ?, ?)").bind("meeting", "Demo with HelixSoft engineering; SSO is the main blocker.", 4, 4, "user"),
    db.prepare("INSERT INTO activities (type, content, contact_id, deal_id, actor) VALUES (?, ?, ?, ?, ?)").bind("note", "Polar Ventures signed the expansion order form.", 5, 5, "user"),
    db.prepare("INSERT INTO tasks (title, description, assignee_agent_id, status) VALUES (?, ?, ?, ?)").bind("Summarize the current pipeline", "Give a stage-by-stage breakdown of all open deals with total value, and flag anything that looks stuck.", 2, "todo"),
    db.prepare("INSERT INTO tasks (title, description, assignee_agent_id, status) VALUES (?, ?, ?, ?)").bind("Log follow-up for the Acme renewal", "Add a note on the Acme Corp renewal deal that legal review is expected to finish this week, and set the contact status appropriately.", 1, "todo"),
  ]);
}
