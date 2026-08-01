import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function createDb(): Database.Database {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "crm.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🤖',
      instructions TEXT NOT NULL DEFAULT '',
      capabilities TEXT NOT NULL DEFAULT '{}',
      model TEXT NOT NULL DEFAULT 'claude-opus-5',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      status TEXT NOT NULL DEFAULT 'lead',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      value REAL NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'lead',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'note',
      content TEXT NOT NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
      actor TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      assignee_agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      trace TEXT NOT NULL DEFAULT '[]',
      is_error INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const agentCount = (db.prepare("SELECT COUNT(*) AS n FROM agents").get() as { n: number }).n;
  if (agentCount === 0) seed(db);
}

function seed(db: Database.Database) {
  const insertAgent = db.prepare(
    "INSERT INTO agents (name, emoji, instructions, capabilities, model) VALUES (?, ?, ?, ?, ?)"
  );

  const salesId = insertAgent.run(
    "Sales Assistant",
    "💼",
    "You are a proactive sales assistant. Keep the CRM tidy: create and update contacts and deals when asked, log activities for anything noteworthy, and always confirm exactly what you changed (names, IDs, values). Be brief and action-oriented.",
    JSON.stringify({ contacts: "write", deals: "write", activities: "write", tasks: "read" }),
    "claude-opus-5"
  ).lastInsertRowid;

  insertAgent.run(
    "Data Analyst",
    "📊",
    "You are a read-only CRM analyst. Answer questions about the pipeline with concrete numbers: totals, counts, stage breakdowns, top deals. Never guess — look the data up with your tools first. Present findings compactly, leading with the headline number.",
    JSON.stringify({ contacts: "read", deals: "read", activities: "read", tasks: "read" }),
    "claude-opus-5"
  );

  const insertContact = db.prepare(
    "INSERT INTO contacts (name, email, phone, company, status, notes) VALUES (?, ?, ?, ?, ?, ?)"
  );
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
  const contactIds: number[] = [];
  for (const c of contacts) contactIds.push(Number(insertContact.run(...c).lastInsertRowid));

  const insertDeal = db.prepare(
    "INSERT INTO deals (title, contact_id, value, stage, notes) VALUES (?, ?, ?, ?, ?)"
  );
  insertDeal.run("Acme Corp — Enterprise renewal", contactIds[0], 48000, "proposal", "Renewal due end of month.");
  insertDeal.run("Bright Labs — Team plan", contactIds[1], 12000, "qualified", null);
  insertDeal.run("Northwind — Pilot", contactIds[2], 5000, "lead", null);
  insertDeal.run("HelixSoft — Growth plan", contactIds[3], 24000, "proposal", "Blocked on SSO commitment.");
  insertDeal.run("Polar Ventures — Expansion", contactIds[4], 30000, "won", "Closed last week.");
  insertDeal.run("QuantumLeap — Starter", contactIds[5], 3600, "lead", null);

  const insertActivity = db.prepare(
    "INSERT INTO activities (type, content, contact_id, deal_id, actor) VALUES (?, ?, ?, ?, ?)"
  );
  insertActivity.run("call", "Renewal call with Maya — pricing agreed in principle, waiting on legal.", contactIds[0], 1, "user");
  insertActivity.run("email", "Sent Bright Labs the comparison sheet vs. competitor.", contactIds[1], 2, "user");
  insertActivity.run("meeting", "Demo with HelixSoft engineering; SSO is the main blocker.", contactIds[3], 4, "user");
  insertActivity.run("note", "Polar Ventures signed the expansion order form.", contactIds[4], 5, "user");

  db.prepare(
    "INSERT INTO tasks (title, description, assignee_agent_id, status) VALUES (?, ?, ?, ?)"
  ).run(
    "Summarize the current pipeline",
    "Give a stage-by-stage breakdown of all open deals with total value, and flag anything that looks stuck.",
    2,
    "todo"
  );
  db.prepare(
    "INSERT INTO tasks (title, description, assignee_agent_id, status) VALUES (?, ?, ?, ?)"
  ).run(
    "Log follow-up for the Acme renewal",
    "Add a note on the Acme Corp renewal deal that legal review is expected to finish this week, and set the contact status appropriately.",
    Number(salesId),
    "todo"
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __crmDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!globalThis.__crmDb) globalThis.__crmDb = createDb();
  return globalThis.__crmDb;
}
