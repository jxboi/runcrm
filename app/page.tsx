import {
  ArrowRight,
  BriefcaseBusiness,
  ChartNoAxesColumnIncreasing,
  Check,
  Circle,
  Clock3,
  Compass,
  Dog,
  LockKeyhole,
  Search,
  Trash2,
  Undo2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import AgentRoster from "./components/landing/AgentRoster";
import AutonomyLadder from "./components/landing/AutonomyLadder";
import LiveDemo from "./components/landing/LiveDemo";
import Reveal from "./components/landing/Reveal";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950">
      <Backdrop />
      <Nav />

      <main className="relative">
        <Hero />
        <JournalTicker />
        <Inversion />
        <Roster />
        <Permissions />
        <Ladder />
        <GlassBox />
        <Proactive />
        <Scoreboard />
        <Roadmap />
        <Principles />
        <CallToAction />
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden" aria-hidden>
      <div className="absolute inset-0 rc-grid" />
      <div className="rc-aurora absolute -left-40 -top-56 h-[560px] w-[560px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div
        className="rc-aurora absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[120px]"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="rc-aurora absolute left-1/3 top-40 h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-[120px]"
        style={{ animationDelay: "-15s" }}
      />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-900/80 bg-slate-950/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-3.5">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-950">
            R
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-100">RunCRM</span>
        </span>

        <div className="ml-6 hidden items-center gap-6 text-[13px] text-slate-400 md:flex">
          <a href="#agents" className="transition hover:text-slate-100">
            Agents
          </a>
          <a href="#trust" className="transition hover:text-slate-100">
            Permissions
          </a>
          <a href="#autonomy" className="transition hover:text-slate-100">
            Autonomy
          </a>
          <a href="#roadmap" className="transition hover:text-slate-100">
            Roadmap
          </a>
        </div>

        <a
          href="/app"
          className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-indigo-500"
        >
          Open the workspace
        </a>
      </nav>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
      <Reveal className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          v0.1 is running · agents, access rights, and live traces
        </span>

        <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-slate-50 sm:text-6xl">
          You run the relationships.{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400 bg-clip-text text-transparent">
            RunCRM runs the record.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
          Every CRM ever built shares a dirty secret: the people it serves hate feeding it. So nobody does —
          records rot and the pipeline lies. RunCRM inverts it. You do the part that needs a human. A team of
          agents does the recording, chasing, reconciling and nagging.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/app"
            className="group rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-950/60 transition hover:bg-indigo-500"
          >
            <span className="inline-flex items-center gap-1.5">
              Open the workspace
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </a>
          <a
            href="#trust"
            className="rounded-xl border border-slate-800 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            Why it can be trusted
          </a>
        </div>
      </Reveal>

      <Reveal delay={140} className="mt-14">
        <LiveDemo />
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ ticker */

const JOURNAL: ReadonlyArray<{ Icon: LucideIcon; text: string }> = [
  { Icon: BriefcaseBusiness, text: "Assistant · update_deal #7 · qualified → proposal · 96ms · undo" },
  { Icon: Search, text: "Researcher · enrich_contact #418 · 3 fields filled from the signature block" },
  { Icon: ChartNoAxesColumnIncreasing, text: "Analyst · read-only · answered “what slipped this week?” · 2 receipts" },
  { Icon: Trash2, text: "Janitor · proposed 6 fixes · waiting on you" },
  { Icon: BriefcaseBusiness, text: "Assistant · log_activity #212 · call → deal #7 · 71ms · undo" },
  { Icon: Clock3, text: "Watchdog · Umbrella renewal window opens in 30 days · task #37 created" },
  { Icon: Compass, text: "Coordinator · split “clean up EMEA” into 4 tasks · routed by badge" },
  { Icon: LockKeyhole, text: "Analyst · update_deal denied · read access to deals · 0 rows touched" },
];

function JournalTicker() {
  return (
    <section className="relative overflow-hidden border-y border-slate-900 bg-slate-950/60 py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-slate-950 to-transparent" />
      <div className="flex w-max rc-marquee">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {JOURNAL.map(({ Icon, text }) => (
              <span
                key={text}
                className="mx-3 inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] text-slate-600"
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- inversion */

function Inversion() {
  return (
    <Section
      eyebrow="The inversion"
      title="The database was supposed to serve the seller."
      lede="Somewhere along the way, the seller ended up serving the database. Friday afternoon “CRM hygiene” is the tax you pay for a record that still isn't true."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Reveal className="h-full">
          <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              The CRM you have
            </div>
            <ul className="space-y-3 text-sm leading-relaxed text-slate-400">
              {[
                "Selling happens in calls, emails and hallways. The CRM demands you stop and transcribe.",
                "Fields go stale the moment a human gets busy — which is always.",
                "“Automations” fire invisibly; nobody can say why a stage changed.",
                "Dashboards get admired in standups and change nothing.",
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-700" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={120} className="h-full">
          <div className="relative h-full overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.07] to-transparent p-6">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-indigo-300/80">
              RunCRM
            </div>
            <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
              {[
                "You say what happened, in one sentence, in the room you already live in.",
                "Agents reconcile it into contacts, deals, activities and tasks — attributed and traced.",
                "The chat is the audit trail: searchable, quotable, replayable.",
                "Nothing an agent does is ever more than one click from undone.",
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ roster */

function Roster() {
  return (
    <Section
      id="agents"
      eyebrow="Agents are teammates, not features"
      title="You don't configure automations. You hire."
      lede="An agent is a colleague with a name, a job description, a badge, a toolbox and a track record. One set of primitives — instructions, capabilities, access, triggers, memory — composes every role you'd ever want on the team."
    >
      <Reveal>
        <AgentRoster />
      </Reveal>
      <Reveal delay={120}>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
          The dots are the badge:{" "}
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" /> none
          </span>{" "}
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> read
          </span>{" "}
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> write
          </span>{" "}
          — per entity, set when you hire, changed in one click.
        </p>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------- permissions */

const SNIPPET = `function allowed(agent: Agent, spec: ToolSpec): boolean {
  const level = agent.capabilities[spec.entity];
  if (spec.level === "read") return level === "read" || level === "write";
  return level === "write";
}

/** Tool definitions this agent is allowed to use. */
export function toolsForAgent(agent: Agent): ToolDef[] {
  return TOOL_SPECS.filter((s) => allowed(agent, s)).map((s) => s.def);
}

export async function executeTool(agent, name, input) {
  const spec = TOOL_SPECS.find((s) => s.def.name === name);
  // Re-checked server-side on every single call.
  if (!allowed(agent, spec)) return { ok: false, result: "Permission denied" };
  …
}`;

function Permissions() {
  return (
    <Section
      id="trust"
      eyebrow="Trust is earned, permission is enforced"
      title="Permissions are code, not prompts."
      lede="If the model can be talked out of a rule, it isn't a rule. Every capability an agent has is a tool it was explicitly granted. Everything else isn't discouraged — it's absent from the toolbox, and re-checked server-side on every call."
    >
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
              <span className="font-mono text-[11px] text-slate-500">lib/agent/tools.ts</span>
              <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                shipping in v0.1
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-slate-400">
              <code>{SNIPPET}</code>
            </pre>
          </div>
        </Reveal>

        <Reveal delay={120} className="h-full">
          <div className="flex h-full flex-col gap-4">
            {[
              {
                head: "The model is never the security boundary",
                body: "No jailbreak reaches a tool that was never put in the request. Prompt injection can't grant access the badge doesn't carry.",
              },
              {
                head: "Refusals come with a reason",
                body: "“I have read access to deals, and update_deal requires write.” The agent tells you exactly which door was locked, and who can open it.",
              },
              {
                head: "Connectors pass the same gate",
                body: "Email, calendar, transcripts, billing — every connector is checked by the same code path as every native tool. No side doors.",
              },
            ].map((item) => (
              <div key={item.head} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
                <h3 className="text-sm font-semibold text-slate-200">{item.head}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- autonomy */

function Ladder() {
  return (
    <Section
      id="autonomy"
      eyebrow="The autonomy ladder"
      title="Trust ratchets up. One click ratchets it back."
      lede="Access starts as read or write per entity. It grows into a ladder you grant per agent, per capability — and promotion is evidence-based: “you've edited 2 of the Assistant's last 40 drafts. Let it send directly to existing contacts?”"
      badge="next"
    >
      <Reveal>
        <AutonomyLadder />
      </Reveal>
    </Section>
  );
}

/* --------------------------------------------------------------- glass box */

function GlassBox() {
  return (
    <Section
      eyebrow="Glass box, always"
      title="“Why did you do that?” gets a real answer."
      lede="Every agent write is a journaled mutation: who, why, triggered by what, part of which run. Risky changes ship as diffs before they become facts."
    >
      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30">
          <div className="grid divide-y divide-slate-800 md:grid-cols-3 md:divide-x md:divide-y-0">
            {[
              { k: "who", v: "Sales Assistant", d: "acting as you, labelled as itself", Icon: BriefcaseBusiness },
              { k: "why", v: "you said: “they want a proposal by Friday”", d: "message #1184 · 4:31pm", Icon: null },
              { k: "what", v: "deal #7 · stage qualified → proposal", d: "run r_8c21 · step 2 of 4", Icon: null },
            ].map((cell) => (
              <div key={cell.k} className="p-5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">{cell.k}</div>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-200">
                  {cell.Icon ? <cell.Icon aria-hidden="true" className="h-4 w-4 text-slate-400" /> : null}
                  {cell.v}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{cell.d}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 bg-slate-950/60 px-5 py-3">
            <span className="text-sm text-slate-400">
              Nothing an agent does is ever more than one click from undone.
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-300">
              <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> Undo this change
            </span>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

/* --------------------------------------------------------------- proactive */

function Proactive() {
  return (
    <Section
      eyebrow="Proactive by default"
      title="A CRM that only answers is still a database."
      lede="RunCRM notices. And it's polite about it: everything non-urgent lands in one digest, and an agent that pings you too often gets its budget cut — by you, or by the app noticing you ignore it."
      badge="next"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            Icon: Clock3,
            head: "Routines",
            body: "The Monday brief, the Friday hygiene sweep, month-end forecast prep — on a schedule, not on an ask.",
          },
          {
            Icon: Dog,
            head: "Watchdogs",
            body: "Deal stalled 14 days. Champion gone quiet. Renewal window opening. Two agents about to write conflicting facts.",
          },
          {
            Icon: Zap,
            head: "Triggers",
            body: "Inbound lead → enrich → dedupe → route → draft intro → park in Approvals. No human pushing each domino.",
          },
        ].map((card, i) => (
          <Reveal key={card.head} delay={i * 100} className="h-full">
            <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/30 p-6 transition hover:border-slate-700">
              <card.Icon aria-hidden="true" className="h-6 w-6 text-indigo-300" strokeWidth={1.7} />
              <h3 className="mt-3 text-sm font-semibold text-slate-200">{card.head}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{card.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- scoreboard */

function Scoreboard() {
  return (
    <Section
      eyebrow="How we'll know it's working"
      title="The metric is time given back."
      lede="Every feature answers one question: does this move minutes from bookkeeping to relationships? These are the numbers we're building toward — hold us to them."
    >
      <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { n: "0", u: "minutes a week", d: "spent on data entry" },
          { n: "<24h", u: "median staleness", d: "without anyone being asked to update anything" },
          { n: "1", u: "message", d: "answers any pipeline question — with receipts" },
          { n: "3", u: "approvals", d: "on a Monday morning, not thirty updates" },
        ].map((stat, i) => (
          <Reveal key={stat.u} delay={i * 80} className="h-full">
            <div className="h-full bg-slate-950 p-6">
              <div className="text-3xl font-semibold tracking-tight text-slate-100">{stat.n}</div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-indigo-300/80">
                {stat.u}
              </div>
              <div className="mt-2 text-xs leading-relaxed text-slate-500">{stat.d}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- roadmap */

const PHASES = [
  {
    tag: "Now · v0.1",
    head: "The primitive",
    state: "working, verified",
    items: [
      "Agents with instructions and a model",
      "Per-entity access rights enforced in code",
      "Capability-scoped tools + live traces",
      "Shared chat, assignable task board, seeded CRM",
    ],
    done: true,
  },
  {
    tag: "Next",
    head: "Operate",
    state: "in flight",
    items: [
      "Streaming replies · @mention routing",
      "A Coordinator and agent-to-agent handoffs",
      "The Approvals inbox and undo journal",
      "Scheduled routines · per-account threads · memory",
    ],
    done: false,
  },
  {
    tag: "Then",
    head: "Anticipate",
    state: "designed",
    items: [
      "Watchdogs, triggers, action-level policies",
      "The autonomy ladder",
      "Email, calendar and transcript connectors",
      "Multiplayer: human teammates, Slack, voice capture",
    ],
    done: false,
  },
  {
    tag: "1.0",
    head: "The CRM that runs itself",
    state: "the point of all this",
    items: [
      "A hired team operating the record end-to-end",
      "A human doing only what humans are for",
      "A company diary about its customers that is, finally, true",
    ],
    done: false,
  },
];

function Roadmap() {
  return (
    <Section
      id="roadmap"
      eyebrow="The road from v0.1"
      title="Shipped, in flight, and honestly labelled."
      lede="v0.1 already demos the thesis: a read-only analyst refuses a write and says why; an assistant finishes a task and declines to fake a “won” deal."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PHASES.map((phase, i) => (
          <Reveal key={phase.head} delay={i * 90} className="h-full">
            <div
              className={`flex h-full flex-col rounded-2xl border p-5 ${
                phase.done
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border-slate-800 bg-slate-900/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${
                    phase.done ? "text-emerald-300/90" : "text-slate-500"
                  }`}
                >
                  {phase.tag}
                </span>
              </div>
              <h3 className="mt-1 text-sm font-semibold text-slate-200">{phase.head}</h3>
              <p className="mt-0.5 text-[11px] italic text-slate-500">{phase.state}</p>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
                {phase.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className={phase.done ? "text-emerald-400" : "text-slate-600"}>
                      {phase.done ? <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5" /> : <Circle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5" />}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- principles */

function Principles() {
  return (
    <Section
      eyebrow="The constraints we won't trade"
      title="Quiet competence beats impressive demos."
      lede="An agent that silently keeps 200 records honest is worth more than one that writes a flashy essay."
    >
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Reveal>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 sm:grid-cols-2">
            {[
              ["Permissions are code, not prompts", "Enforcement is server-side. The model is never the boundary."],
              ["No invisible writes", "Every change is attributed, traced and reversible."],
              ["Humans stay in the loop on outbound", "Nothing reaches a customer until you narrowly, revocably delegate it."],
              ["Agents never pretend to be people", "Externally they're labelled, or they draft and a human sends."],
              ["The record belongs to the user", "One SQLite file today, one export button forever. No hostage data."],
              ["The metric is time given back", "Minutes moved from bookkeeping to relationships, or it doesn't ship."],
            ].map(([head, body], i) => (
              <li key={head} className="bg-slate-950 p-5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-indigo-400/70">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-medium text-slate-200">{head}</span>
                </div>
                <p className="mt-1.5 pl-6 text-xs leading-relaxed text-slate-500">{body}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={120} className="h-full">
          <div className="h-full rounded-2xl border border-rose-500/20 bg-rose-950/10 p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300/70">
              What we refuse to build
            </div>
            <ul className="mt-4 space-y-4">
              {[
                ["Black-box automation", "If we can't show the trace, we don't ship the action."],
                ["Dashboard theater", "Charts exist to trigger decisions, not to be admired in standups."],
                ["A second inbox that nags", "RunCRM consolidates attention; it doesn't tax it."],
              ].map(([head, body]) => (
                <li key={head}>
                  <div className="flex gap-2 text-sm font-medium text-slate-200">
                    <X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/80" />
                    {head}
                  </div>
                  <p className="mt-1 pl-6 text-xs leading-relaxed text-slate-500">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------------- CTA */

function CallToAction() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-600/15 via-violet-600/10 to-transparent p-10 text-center sm:p-16">
          <div className="rc-aurora pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-[100px]" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Stop feeding the database.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
            Hire an agent, give it a badge, and tell it what happened on your last call. Watch the record
            update itself — with every tool call visible, and every change one click from undone.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/app"
              className="group rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-950/60 transition hover:bg-indigo-500"
            >
              Open the workspace
              <span className="ml-1.5 inline-block transition group-hover:translate-x-0.5">→</span>
            </a>
            <span className="text-xs text-slate-500">Runs locally · your data stays in one SQLite file</span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            R
          </span>
          <span className="text-xs text-slate-500">RunCRM · v0.1</span>
        </div>
        <p className="text-xs text-slate-600">
          Open questions we&rsquo;re holding honestly: how much outbound autonomy is ever right? Where does
          the CRM end and the inbox begin?
        </p>
        <a href="/app" className="ml-auto text-xs text-slate-400 transition hover:text-indigo-300">
          Open the workspace →
        </a>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ shared */

function Section({
  id,
  eyebrow,
  title,
  lede,
  badge,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lede: string;
  badge?: "next";
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20 sm:py-24">
      <Reveal className="mb-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-indigo-400/80">
            {eyebrow}
          </span>
          {badge === "next" && (
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
              on the roadmap
            </span>
          )}
        </div>
        <h2 className="mt-3 max-w-3xl text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
          {lede}
        </p>
      </Reveal>
      {children}
    </section>
  );
}
