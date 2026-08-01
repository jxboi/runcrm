# RunCRM v0.1

A chat-first CRM run by AI agents. The backend is a small CRM (contacts, deals, activities, tasks) on SQLite; the frontend is a workspace chat where you create agents, give them instructions and access rights, and ask or assign them to do things. Agents execute via Claude tool calls against the CRM.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The database (`data/crm.db`) is created and seeded on first run with sample contacts, deals, tasks, and two agents.

**Credentials:** the Anthropic SDK resolves `ANTHROPIC_API_KEY` (put it in `.env.local`), `ANTHROPIC_AUTH_TOKEN`, or an `ant auth login` profile automatically. Without credentials, agent replies show a clear error; the CRM itself still works.

## How it works

- **Agents** (`lib/agent/`): each agent has a name, instructions (appended to its system prompt), a model (Claude Opus 5 by default), and per-entity access rights — `none` / `read` / `write` for contacts, deals, activities, and tasks. Access rights decide which tools the agent receives, and the executor enforces them server-side again on every call.
- **Chat** (`POST /api/chat`): inserts your message, then runs the addressed agent in a tool-use loop (max 12 rounds) over the shared chat history. Other agents' messages appear to it as `[Name] ...` user turns, so agents share context. Tool calls are recorded and shown in the UI as an expandable trace.
- **Tasks** (`POST /api/tasks/:id/run`): assigning + running a task posts the assignment into the chat, executes the assignee agent, stores the report on the task (`todo → running → done/failed`), and logs whatever the agent did.
- **CRM API**: plain REST under `/api/contacts`, `/api/deals`, `/api/activities`, `/api/tasks`, `/api/agents`, `/api/messages` — usable without the chat.

## Stack

Next.js (App Router) · better-sqlite3 · @anthropic-ai/sdk (manual tool-use loop, server-side refusal fallback to Opus 4.8 on Opus 5)

## Ideas for v0.2

Streaming replies · @mentions to route between agents automatically · agent-to-agent handoffs · scheduled task runs · delete flows with confirmation
