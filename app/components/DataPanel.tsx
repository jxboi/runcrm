"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Agent, Contact, CONTACT_STATUSES, Deal, DEAL_STAGES, Task } from "@/lib/types";
import { api, fmtMoney, fmtTime } from "@/lib/client";

type Tab = "contacts" | "deals" | "tasks" | "activity";

const STATUS_PILL: Record<string, string> = {
  lead: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  prospect: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  customer: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  churned: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const STAGE_PILL: Record<string, string> = {
  lead: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  qualified: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  proposal: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  won: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const TASK_PILL: Record<string, string> = {
  todo: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  running: "bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const ACTIVITY_ICON: Record<string, string> = { note: "📝", call: "📞", email: "✉️", meeting: "🗓️" };

function Pill({ text, map }: { text: string; map: Record<string, string> }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${map[text] ?? map.lead}`}>
      {text}
    </span>
  );
}

export default function DataPanel({
  agents,
  version,
  busy,
  onRunTask,
  onError,
}: {
  agents: Agent[];
  version: number;
  busy: boolean;
  onRunTask: (taskId: number, assigneeId: number | null) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, d, t, a] = await Promise.all([
        api<Contact[]>("/api/contacts"),
        api<Deal[]>("/api/deals"),
        api<Task[]>("/api/tasks"),
        api<Activity[]>("/api/activities"),
      ]);
      setContacts(c);
      setDeals(d);
      setTasks(t);
      setActivities(a);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load CRM data");
    }
  }, [onError]);

  useEffect(() => {
    reload();
  }, [version, reload]);

  const runTask = async (task: Task) => {
    setRunningTaskId(task.id);
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status: "running" } : t)));
    try {
      await onRunTask(task.id, task.assignee_agent_id);
    } finally {
      setRunningTaskId(null);
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "deals", label: "Deals", count: deals.length },
    { id: "tasks", label: "Tasks", count: tasks.filter((t) => t.status === "todo" || t.status === "running").length },
    { id: "activity", label: "Activity", count: activities.length },
  ];

  return (
    <aside className="hidden w-[400px] shrink-0 flex-col bg-slate-950 lg:flex">
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-slate-800/70 px-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[10px] ${tab === t.id ? "text-indigo-300" : "text-slate-600"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "contacts" && <ContactsTab contacts={contacts} onCreated={reload} onError={onError} />}
        {tab === "deals" && <DealsTab deals={deals} contacts={contacts} onCreated={reload} onError={onError} />}
        {tab === "tasks" && (
          <TasksTab
            tasks={tasks}
            agents={agents}
            busy={busy}
            runningTaskId={runningTaskId}
            onRun={runTask}
            onCreated={reload}
            onError={onError}
          />
        )}
        {tab === "activity" && <ActivityTab activities={activities} />}
      </div>
    </aside>
  );
}

// ---------------- contacts ----------------

function ContactsTab({
  contacts,
  onCreated,
  onError,
}: {
  contacts: Contact[];
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", status: "lead" });

  const create = async () => {
    try {
      await api("/api/contacts", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", company: "", status: "lead" });
      setShowForm(false);
      onCreated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to create contact");
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowForm((s) => !s)}
        className="w-full rounded-lg border border-dashed border-slate-700 py-1.5 text-xs text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
      >
        {showForm ? "Cancel" : "+ Add contact"}
      </button>
      {showForm && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <input
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <input
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={create}
              disabled={!form.name.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white enabled:hover:bg-indigo-500 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
      {contacts.map((c) => (
        <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-slate-200">{c.name}</div>
              <div className="truncate text-[11px] text-slate-500">
                {c.company ?? "—"}
                {c.email ? ` · ${c.email}` : ""}
              </div>
            </div>
            <Pill text={c.status} map={STATUS_PILL} />
          </div>
          {c.notes && <div className="mt-1.5 truncate text-[11px] italic text-slate-600">{c.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------------- deals ----------------

function DealsTab({
  deals,
  contacts,
  onCreated,
  onError,
}: {
  deals: Deal[];
  contacts: Contact[];
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", contact_id: "", stage: "lead" });

  const openValue = deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((sum, d) => sum + d.value, 0);
  const wonValue = deals.filter((d) => d.stage === "won").reduce((sum, d) => sum + d.value, 0);

  const create = async () => {
    try {
      await api("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          value: form.value ? Number(form.value) : 0,
          contact_id: form.contact_id ? Number(form.contact_id) : null,
          stage: form.stage,
        }),
      });
      setForm({ title: "", value: "", contact_id: "", stage: "lead" });
      setShowForm(false);
      onCreated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to create deal");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Open pipeline</div>
          <div className="text-sm font-semibold text-slate-100">{fmtMoney(openValue)}</div>
        </div>
        <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Won</div>
          <div className="text-sm font-semibold text-emerald-300">{fmtMoney(wonValue)}</div>
        </div>
      </div>

      <button
        onClick={() => setShowForm((s) => !s)}
        className="w-full rounded-lg border border-dashed border-slate-700 py-1.5 text-xs text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
      >
        {showForm ? "Cancel" : "+ Add deal"}
      </button>
      {showForm && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <input
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              placeholder="Value ($)"
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <select
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">No contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={create}
            disabled={!form.title.trim()}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white enabled:hover:bg-indigo-500 disabled:opacity-40"
          >
            Add deal
          </button>
        </div>
      )}

      {deals.map((d) => (
        <div key={d.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-slate-200">{d.title}</div>
              <div className="truncate text-[11px] text-slate-500">{d.contact_name ?? "No contact"}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">{fmtMoney(d.value)}</span>
              <Pill text={d.stage} map={STAGE_PILL} />
            </div>
          </div>
          {d.notes && <div className="mt-1.5 truncate text-[11px] italic text-slate-600">{d.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------------- tasks ----------------

function TasksTab({
  tasks,
  agents,
  busy,
  runningTaskId,
  onRun,
  onCreated,
  onError,
}: {
  tasks: Task[];
  agents: Agent[];
  busy: boolean;
  runningTaskId: number | null;
  onRun: (task: Task) => void;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assignee: agents[0]?.id?.toString() ?? "" });

  const create = async () => {
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          assignee_agent_id: form.assignee ? Number(form.assignee) : null,
        }),
      });
      setForm({ title: "", description: "", assignee: form.assignee });
      setShowForm(false);
      onCreated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to create task");
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowForm((s) => !s)}
        className="w-full rounded-lg border border-dashed border-slate-700 py-1.5 text-xs text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
      >
        {showForm ? "Cancel" : "+ Assign a task"}
      </button>
      {showForm && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <input
            placeholder="Task title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <textarea
            placeholder="Details for the agent (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <select
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name}
                </option>
              ))}
            </select>
            <button
              onClick={create}
              disabled={!form.title.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white enabled:hover:bg-indigo-500 disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {tasks.map((t) => {
        const isRunning = t.status === "running" || runningTaskId === t.id;
        return (
          <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-slate-200">{t.title}</div>
                {t.description && <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t.description}</div>}
                <div className="mt-1.5 flex items-center gap-2">
                  <Pill text={isRunning ? "running" : t.status} map={TASK_PILL} />
                  <span className="text-[11px] text-slate-500">
                    {t.assignee_name ? `${t.assignee_emoji ?? ""} ${t.assignee_name}` : "Unassigned"}
                  </span>
                </div>
              </div>
              {t.assignee_agent_id != null && (
                <button
                  onClick={() => onRun(t)}
                  disabled={busy || isRunning}
                  className="shrink-0 rounded-md border border-indigo-500/50 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition enabled:hover:bg-indigo-500/25 disabled:opacity-40"
                >
                  {isRunning ? "Running…" : t.status === "todo" ? "▶ Run" : "↻ Re-run"}
                </button>
              )}
            </div>
            {t.result && (
              <details className="mt-2">
                <summary className="text-[10px] text-slate-500 hover:text-slate-300">Show result</summary>
                <div className="mt-1 whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950 p-2 text-[11px] leading-relaxed text-slate-400">
                  {t.result}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- activity ----------------

function ActivityTab({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <div className="mt-8 text-center text-xs text-slate-600">No activity yet.</div>;
  }
  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <span className="text-sm">{ACTIVITY_ICON[a.type] ?? "📝"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] leading-relaxed text-slate-300">{a.content}</div>
              <div className="mt-1 text-[10px] text-slate-600">
                {a.actor} · {[a.contact_name, a.deal_title].filter(Boolean).join(" · ") || "unlinked"} ·{" "}
                {fmtTime(a.created_at)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
