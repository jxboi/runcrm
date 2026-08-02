# RunCRM — Vision

**The CRM that runs itself.**

Every CRM ever built shares a dirty secret: the people it serves hate feeding it. Selling happens in conversations — calls, emails, hallways, demos — and the CRM demands you stop and transcribe. So nobody does. Records rot, pipelines lie, and "CRM hygiene" becomes a chore stapled to every Friday. The database was supposed to serve the seller; the seller ended up serving the database.

RunCRM inverts this. The human does the part that requires a human: judgment, taste, relationships, the actual selling. A team of AI agents does everything else — recording, reconciling, chasing, enriching, summarizing, scheduling, nagging. You don't operate the CRM. You talk to the team that does.

**You run the relationships. RunCRM runs the record.**

---

## 1. Agents are teammates, not features

You don't configure automations. You **hire**. An agent is a colleague with a name, a job description (instructions), a badge (access rights), a toolbox (connectors), a memory, and a track record. You brief them, correct them, promote them, and — when a role changes — offboard them.

One set of primitives composes every role. Instructions + capabilities + access + triggers + memory is enough to build:

- **The Researcher** — enriches inbound leads, builds account dossiers, dedupes on sight
- **The Analyst** — read-only everywhere; answers any pipeline question with receipts, posts the Monday brief
- **The Sales Assistant** — drafts follow-ups, logs everything, keeps every record current
- **The Renewals Watchdog** — owns the renewal calendar; wakes up on date windows, not messages
- **The Janitor** — sweeps for stale stages, orphaned deals, conflicting fields; files fix-it proposals
- **The Coordinator** — breaks big asks into tasks, routes them to whichever agent holds the right badge

The product ships primitives. Users compose teammates.

Teammates remember. Tell the Analyst once to report in USD and it never asks again. Correct the Assistant's tone once and the correction sticks. Each account accumulates a dossier — history, preferences, landmines — that any agent consults before acting and any new human reads to onboard.

And teammates collaborate in the open: the Coordinator delegates, the Assistant hands a stuck negotiation to you, the Analyst reviews the Watchdog's numbers before they ship. Agent-to-agent work happens in the same visible room as everything else.

### 2. Trust is earned, permission is enforced

v0.1's core design decision scales all the way up: **access rights live in code, not in prompts.** If the model can be talked out of a rule, it isn't a rule. Every capability an agent has is a tool it was explicitly granted; everything else isn't "discouraged" — it's absent, and re-checked server-side on every call.

The perfect app grows this from entity-level read/write into an **autonomy ladder**, granted per agent, per capability:

| Level | The agent may… | Example |
| --- | --- | --- |
| Observer | read and report | Analyst answering "what's stuck?" |
| Advisor | propose changes as diffs | Janitor's Friday fix-it list |
| Operator (gated) | act after your one-tap approval | sending any email to a customer |
| Operator (reporting) | act, then tell you | logging notes, moving early stages |
| Owner | act silently within policy | dedupe, enrichment, field hygiene |

Policies get action-level teeth: *can draft email to anyone, send only to warm contacts, ≤ 10/day* · *can move deal stages, but closing anything over $25k needs a human tap* · *can touch only EMEA accounts.* Approval isn't a modal in your face; it's an inbox you clear with your coffee.

Promotion is evidence-based, and the app itself makes the case: *"You've edited 2 of the Assistant's last 40 drafts. Let it send directly to existing contacts?"* Trust ratchets up — and one click ratchets it back down.

### 3. Chat is the command line; the record is the truth

The chat is not a support widget bolted onto a database. It is the primary instrument. You say things; the world changes; receipts attach. @mentions route to the right agent, or the Coordinator routes for you. Long-running work streams progress live instead of vanishing into a spinner.

But chat-first is not chat-only. The record panel stays one glance away — because trust requires verification, and sometimes a human just wants to type a phone number into a field. Big accounts get their own threads; the home room stays for cross-cutting work and the daily pulse. Every message an agent acts on becomes structured history, so the conversation *is* the audit trail — searchable, quotable, replayable.

### 4. Proactive by default

A CRM that only answers is still a database. RunCRM **notices**:

- **Routines** — the Monday brief, the Friday hygiene sweep, month-end forecast prep — run on schedules, not on asks.
- **Watchdogs** — deal stalled 14 days, champion gone quiet, renewal window opening, two agents about to write conflicting facts — fire on conditions.
- **Triggers** — inbound lead → enrich → dedupe → route → draft intro → park in Approvals — chain without a human pushing each domino.

Proactivity is polite. Everything non-urgent lands in one digest. An agent that pings you constantly gets its proactivity budget cut — by you, or by the app noticing you ignore it.

### 5. Connected to where selling actually happens

Selling doesn't happen inside a CRM, and in the perfect app data entry doesn't either. Email, calendar, call transcripts, Slack, billing, enrichment sources — each plugs in as a connector (MCP-shaped, swappable), and **every connector passes through the same permission gate as every native tool.** The Assistant reads your sent mail and logs the follow-up you already wrote. The meeting ends; the transcript becomes an activity, three field updates, and one task — attributed, undoable, and waiting in your digest if you care to check.

The CRM stops being a destination you visit to type. It becomes the place where all those streams reconcile into one truthful record.

### 6. Glass box, always

Every agent write is a journaled mutation: who, why, triggered by what, part of which run. "Why did you do that?" gets a real answer — the actual trace, not a shrug. Risky changes ship as diffs before they're facts. And the whole system honors one promise:

**Nothing an agent does is ever more than one click from undone.**

---

## Design principles — the constraints we won't trade

1. **Permissions are code, not prompts.** Enforcement lives server-side; the model is never the security boundary.
2. **No invisible writes.** Every change is attributed, traced, and reversible.
3. **Humans stay in the loop on outbound.** Nothing reaches a customer without approval until the user explicitly, narrowly, revocably delegates it.
4. **Agents never pretend to be people.** Externally they're labeled, or they draft and a human sends.
5. **The record belongs to the user.** One SQLite file today, one export button forever. No hostage data.
6. **Quiet competence beats impressive demos.** An agent that silently keeps 200 records honest is worth more than one that writes a flashy essay.
7. **The metric is time given back.** Every feature answers: does this move minutes from bookkeeping to relationships?

## What we refuse to build

- **Black-box automation.** If we can't show the trace, we don't ship the action.
- **Dashboard theater.** Charts exist to trigger decisions, not to be admired in standups.
- **A second inbox that nags.** RunCRM consolidates attention; it doesn't tax it.

## How we'll know it's working

- Time spent on data entry: **zero minutes a week.**
- Median record staleness: **under 24 hours** — without anyone being asked to update anything.
- Any pipeline question answered in **one message, with receipts.**
- Monday morning is **three approvals, not thirty updates.**
- Edit-rate on agent drafts falls while granted autonomy rises — trust, measured.
- A new human teammate onboards by **reading the room**, because the room is the record.

---

## The road from v0.1

**We have now** (working, verified): the primitive. Agents with instructions, per-entity access rights enforced in code, capability-scoped tools, a shared chat with visible tool traces, an assignable task board, and a seeded CRM underneath. The thesis already demos: a read-only analyst *refuses* writes and says why; an assistant completes a task and declines to fake a "won" deal.

**Next — Operate:** streaming replies · @mention routing and a Coordinator · agent-to-agent handoffs · the Approvals inbox and undo journal · scheduled routines · per-account threads · durable agent memory.

**Then — Anticipate:** watchdogs and triggers · action-level policies and the autonomy ladder · email/calendar/transcript connectors through the permission gate · enrichment · multiplayer (human teammates, Slack surface, voice capture on the go).

**1.0 — The CRM that runs itself:** a hired team of agents operating the record and the routine motion end-to-end, a human doing only what humans are for — and a company whose diary about its customers is, for the first time, actually true.

## Open questions we're holding honestly

- How much outbound autonomy is *ever* right? (Current bet: narrow, per-audience, always revocable.)
- Do agents get their own external identities — an email address, a name on the wire — or only draft as their human?
- One shared room or per-account threads as the center of gravity?
- Where does the CRM end and the inbox begin, and should we resist merging them?
- What do you pay for — human seats, hired agents, or work completed?

*— RunCRM, v0.1 → 1.0*
