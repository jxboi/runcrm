# RunCRM v0.2

A chat-first CRM run by AI agents. The backend is a small CRM (contacts, deals, activities, tasks) on Cloudflare D1; the frontend is a workspace chat where you create agents, give them instructions and access rights, and ask or assign them to do things. Agents execute via Claude tool calls against the CRM.

## Run it

```bash
npm install
npm run dev
```

The landing page is at http://localhost:3000 and the workspace at http://localhost:3000/app. The database is created and seeded on first run with sample contacts, deals, tasks, and two agents.

**Credentials:** the Anthropic SDK resolves `ANTHROPIC_API_KEY` (put it in `.env.local`), `ANTHROPIC_AUTH_TOKEN`, or an `ant auth login` profile automatically. Without credentials, agent replies show a clear error; the CRM itself still works.

## Conversations and history

- **Home** is the shared workspace room for cross-account questions, daily updates, tasks, and general CRM work. Messages created before thread support are kept here.
- Click **+ New** under **Conversations** to open a blank chat immediately. There is no setup form; RunCRM creates the title automatically from the first message.
- To start or reopen an account conversation, open **Contacts** and click the **💬** button beside a contact. RunCRM uses the contact's company automatically (or the contact's name when no company is present), so the user never has to type an account name.
- Conversations remain listed in the left sidebar with their latest message and timestamp. Select one to reopen its history.
- Each conversation has isolated agent context. Work that starts in a thread—including streamed replies, handoffs, tasks, routines, approvals, stopped runs, and undo notes—stays in that thread.
- The workspace loads the latest 200 messages from the selected conversation.

## How it works

- **Agents** (`lib/agent/`): each agent has a name, instructions (appended to its system prompt), a model (Claude Opus 5 by default), per-entity access rights — `none` / `read` / `write` for contacts, deals, activities, and tasks — and an autonomy setting. Access rights decide which tools the agent receives, and `executeTool` enforces them server-side again on every call.
- **Live turns** (`POST /api/chat/stream`): replies stream over SSE — text as it's written, and each tool call as it starts and finishes with its timing and result. Runs are stoppable mid-flight; a stopped run keeps the partial reply and its receipts. The composer stays usable while agents work, and different agents can run at the same time.
- **Routing** (`lib/agent/mentions.ts`, `lib/agent/routing.ts`): address agents inline with `@Name` (the composer autocompletes), and several mentioned agents answer in turn — each one re-reads history, so later agents see earlier replies. With **Auto** selected, a small Haiku call picks the best-suited agent.
- **Conversation and account threads** (`/api/threads`): **+ New** opens a blank conversation immediately and titles it from the first message. Account conversations open directly from CRM contact rows, so nobody has to type or remember an account name. Home keeps cross-account work, while each thread has isolated history and agent context. Existing messages migrate safely into Home; task, routine, handoff, approval, stop, and undo messages stay where the work began.
- **Handoff** (`lib/agent/chain.ts`): `handoff_to_agent` lets an agent pass work it lacks the badge for to one who has it. The brief lands in the chat under the delegating agent's name; chains are capped at 2 hops and each agent answers at most once per message.
- **Receipts and undo** (`lib/mutations.ts`): every agent write is journaled with the row before and after. Each tool call in the trace expands to its input and result, and links to the records it touched — clicking one jumps the panel to that row. **Undo** reverses everything one message changed, newest first; a record edited after the agent touched it is left alone and reported.
- **Approvals** (`lib/proposals.ts`): an agent set to *ask me first* files each write as a proposal instead of making it. Approving re-fetches the agent and re-checks its access rights before executing, so a queued proposal is a request, never a stored permission.
- **Tasks** (`POST /api/tasks/:id/run`): assigning + running a task posts the assignment into the chat, streams the assignee's work, stores the report on the task (`todo → running → done/failed`), and logs whatever the agent did.
- **Routines** (`/api/routines`): daily, selected-weekday, and monthly work runs in the workspace timezone. A five-minute Cloudflare Cron Trigger claims due work without duplicates, catches up only the latest missed occurrence, and sends it through the same visible agent chain. Manual runs and failed-run retries stream live; scheduled results appear through lightweight workspace polling.
- **CRM API**: plain REST under `/api/contacts`, `/api/deals`, `/api/activities`, `/api/tasks`, `/api/agents`, `/api/threads`, `/api/messages`, `/api/proposals`, `/api/mutations/undo` — usable without the chat. `GET /api/messages?threadId=<id>` returns one conversation; `POST /api/threads` with `{}` starts a normal conversation, while `{ "accountName": "Acme Corp" }` creates or reopens an account thread.

Routine schedules are configured in the workspace's **Routines** tab. Local scheduled events can be exercised at `/cdn-cgi/handler/scheduled`; hosted deployments must retain the `*/5 * * * *` trigger declared in `vite.config.ts`.

## Stack

Next.js (App Router) on Cloudflare Workers via vinext · D1 (schema in `lib/db.ts`, mirrored in `db/schema.ts` for drizzle-kit) · @anthropic-ai/sdk (streaming tool-use loop, server-side refusal fallback to Opus 4.8 on Opus 5)

## Ideas for v0.3

Agent memory that persists corrections · watchdog triggers · the rest of the autonomy ladder (advisor diffs, per-action policies) · connectors for email and calendar
