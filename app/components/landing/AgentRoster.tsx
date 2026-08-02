import { AccessLevel, Capabilities, ENTITIES } from "@/lib/types";

/** Same three states, same three colours the workspace sidebar uses. */
const DOT: Record<AccessLevel, string> = {
  none: "bg-slate-700",
  read: "bg-sky-500",
  write: "bg-emerald-500",
};

type Hire = {
  emoji: string;
  name: string;
  brief: string;
  capabilities: Capabilities;
  status: "live" | "next";
};

const caps = (
  contacts: AccessLevel,
  deals: AccessLevel,
  activities: AccessLevel,
  tasks: AccessLevel
): Capabilities => ({ contacts, deals, activities, tasks });

const ROSTER: Hire[] = [
  {
    emoji: "🔍",
    name: "The Researcher",
    brief: "Enrich inbound leads, build the account dossier, dedupe on sight.",
    capabilities: caps("write", "read", "write", "read"),
    status: "live",
  },
  {
    emoji: "📊",
    name: "The Analyst",
    brief: "Read-only everywhere. Answer any pipeline question with receipts.",
    capabilities: caps("read", "read", "read", "read"),
    status: "live",
  },
  {
    emoji: "🤝",
    name: "The Sales Assistant",
    brief: "Draft the follow-up, log the call, keep every record current.",
    capabilities: caps("write", "write", "write", "write"),
    status: "live",
  },
  {
    emoji: "🧹",
    name: "The Janitor",
    brief: "Sweep for stale stages and orphaned deals. File fix-it proposals.",
    capabilities: caps("read", "read", "read", "write"),
    status: "live",
  },
  {
    emoji: "⏰",
    name: "The Renewals Watchdog",
    brief: "Own the renewal calendar. Wake on date windows, not on messages.",
    capabilities: caps("read", "write", "write", "write"),
    status: "next",
  },
  {
    emoji: "🧭",
    name: "The Coordinator",
    brief: "Split a big ask into tasks, route each to whoever holds the badge.",
    capabilities: caps("none", "read", "none", "write"),
    status: "next",
  },
];

export default function AgentRoster() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ROSTER.map((hire) => (
        <div
          key={hire.name}
          className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-indigo-500/40 hover:bg-slate-900/70"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg">
              {hire.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-slate-200">{hire.name}</h3>
                {hire.status === "next" && (
                  <span className="shrink-0 rounded-full border border-slate-700 px-1.5 py-px text-[9px] uppercase tracking-wider text-slate-500">
                    next
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{hire.brief}</p>
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-slate-800/80 pt-3">
            {ENTITIES.map((entity) => {
              const level = hire.capabilities[entity];
              return (
                <span
                  key={entity}
                  className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500"
                  title={`${entity}: ${level}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT[level]}`} />
                  {entity}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
