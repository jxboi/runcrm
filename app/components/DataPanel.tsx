"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronRight, FileText, Mail, Phone, Play, RefreshCw, UserRound, type LucideIcon } from "lucide-react";
import {
  Activity,
  Agent,
  Contact,
  CONTACT_STATUSES,
  Deal,
  DEAL_STAGES,
  Entity,
  EntityRef,
  SalesRep,
  Task,
} from "@/lib/types";
import { api, fmtMoney, fmtTime } from "@/lib/client";
import { AgentIcon } from "@/app/components/AgentIcon";
import RoutinesTab from "./RoutinesTab";

type Tab = "contacts" | "sales_reps" | "deals" | "tasks" | "routines" | "activity";
type Section = "records" | "work" | "activity";

const SECTION_FOR_TAB: Record<Tab, Section> = {
  contacts: "records",
  sales_reps: "records",
  deals: "records",
  tasks: "work",
  routines: "work",
  activity: "activity",
};

const SECTIONS: { id: Section; label: string }[] = [
  { id: "records", label: "Records" },
  { id: "work", label: "Work" },
  { id: "activity", label: "Activity" },
];

function handleTabKeyDown<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  currentIndex: number,
  ids: readonly T[],
  onSelect: (id: T) => void
) {
  let nextIndex: number;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % ids.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + ids.length) % ids.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = ids.length - 1;
  else return;

  event.preventDefault();
  onSelect(ids[nextIndex]);
  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]");
  buttons?.[nextIndex]?.focus();
}

/** Entity names from a trace ref map onto the panel's tabs. */
const TAB_FOR_ENTITY: Record<Entity, Tab> = {
  contacts: "contacts",
  deals: "deals",
  tasks: "tasks",
  activities: "activity",
  sales_reps: "sales_reps",
};

/**
 * Scrolls a record into view and rings it briefly when a trace chip points at
 * it — the link between "the agent did this" and "here's the row it changed".
 */
function useFocusedRecord(focusRef: EntityRef | null, setTab: (tab: Tab) => void) {
  const [handled, setHandled] = useState<EntityRef | null>(null);
  const [faded, setFaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Switching tabs is derived from the request, so it happens during render
  // rather than in an effect — no second render pass to show the right tab.
  if (focusRef !== handled) {
    setHandled(focusRef);
    setFaded(false);
    if (focusRef) setTab(TAB_FOR_ENTITY[focusRef.entity]);
  }

  const focusedId = focusRef && !faded ? `${focusRef.entity}-${focusRef.id}` : null;

  useEffect(() => {
    if (!focusRef) return;
    const key = `${focusRef.entity}-${focusRef.id}`;
    const scroll = requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      containerRef.current
        ?.querySelector(`[data-record="${key}"]`)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
    const fade = setTimeout(() => setFaded(true), 2600);
    return () => {
      cancelAnimationFrame(scroll);
      clearTimeout(fade);
    };
  }, [focusRef]);

  return { focusedId, containerRef };
}

/** Ring applied to the row a trace chip points at. */
function focusClass(focusedId: string | null, entity: Entity, id: number): string {
  return focusedId === `${entity}-${id}` ? " ring-2 ring-indigo-400/70" : "";
}

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

function salesRepLabel(salesRep: SalesRep): string {
  return `${salesRep.name} · ID ${salesRep.id}`;
}

const TASK_PILL: Record<string, string> = {
  todo: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  running: "bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  note: FileText,
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
};

function ActivityTypeIcon({ type }: { type: string }) {
  const Icon = ACTIVITY_ICON[type] ?? FileText;
  return <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />;
}

function Pill({ text, map }: { text: string; map: Record<string, string> }) {
  return (
    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-none capitalize ${map[text] ?? map.lead}`}>
      {text}
    </span>
  );
}

const RECORD_ROW_CLASS = "group -mx-1 rounded-xl px-3 transition-colors hover:bg-slate-950/65";

export default function DataPanel({
  agents,
  version,
  busyAgentIds,
  focusRef,
  onRunTask,
  onRunRoutine,
  onOpenAccountThread,
  onError,
}: {
  agents: Agent[];
  version: number;
  busyAgentIds: number[];
  focusRef: EntityRef | null;
  onRunTask: (taskId: number, assigneeId: number | null) => Promise<void>;
  onRunRoutine: (routineId: number, retryRunId?: number) => Promise<void>;
  onOpenAccountThread: (accountName: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("contacts");
  const [lastRecordsTab, setLastRecordsTab] = useState<"contacts" | "sales_reps" | "deals">("contacts");
  const [lastWorkTab, setLastWorkTab] = useState<"tasks" | "routines">("tasks");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);
  const [routineCount, setRoutineCount] = useState(0);

  const selectTab = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab === "contacts" || nextTab === "sales_reps" || nextTab === "deals") setLastRecordsTab(nextTab);
    if (nextTab === "tasks" || nextTab === "routines") setLastWorkTab(nextTab);
  }, []);

  const { focusedId, containerRef } = useFocusedRecord(focusRef, selectTab);
  const section = SECTION_FOR_TAB[tab];

  const selectSection = (nextSection: Section) => {
    if (nextSection === "records") selectTab(lastRecordsTab);
    else if (nextSection === "work") selectTab(lastWorkTab);
    else selectTab("activity");
  };

  const reload = useCallback(async () => {
    try {
      const [c, sr, d, t, a] = await Promise.all([
        api<Contact[]>("/api/contacts"),
        api<SalesRep[]>("/api/sales-reps"),
        api<Deal[]>("/api/deals"),
        api<Task[]>("/api/tasks"),
        api<Activity[]>("/api/activities"),
      ]);
      setContacts(c);
      setSalesReps(sr);
      setDeals(d);
      setTasks(t);
      setActivities(a);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load CRM data");
    }
  }, [onError]);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
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

  const secondaryTabs: { id: Tab; label: string; count: number; attention?: boolean }[] | null =
    section === "records"
      ? [
          { id: "contacts", label: "Contacts", count: contacts.length },
          { id: "sales_reps", label: "Sales reps", count: salesReps.length },
          { id: "deals", label: "Deals", count: deals.length },
        ]
      : section === "work"
        ? [
            {
              id: "tasks",
              label: "Tasks",
              count: tasks.filter((task) => task.status === "todo" || task.status === "running").length,
              attention: true,
            },
            { id: "routines", label: "Routines", count: routineCount },
          ]
        : null;

  return (
    <aside aria-label="CRM data" className="crm-data-panel hidden w-[clamp(20rem,25vw,23rem)] shrink-0 flex-col overflow-x-hidden bg-slate-950 lg:flex">
      <div
        role="tablist"
        aria-label="CRM data sections"
        className="flex h-16 shrink-0 items-stretch gap-7 border-b border-slate-800/70 px-5"
      >
        {SECTIONS.map((item, index) => (
          <button
            key={item.id}
            id={`crm-section-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            aria-controls={`crm-section-panel-${item.id}`}
            tabIndex={section === item.id ? 0 : -1}
            onClick={() => selectSection(item.id)}
            onKeyDown={(event) =>
              handleTabKeyDown(
                event,
                index,
                SECTIONS.map((candidate) => candidate.id),
                selectSection
              )
            }
            className={`-mb-px border-b-2 px-0.5 pt-0.5 text-sm font-semibold transition ${
              section === item.id
                ? "border-indigo-500 text-slate-100"
                : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        id={`crm-section-panel-${section}`}
        role="tabpanel"
        aria-labelledby={`crm-section-tab-${section}`}
        className="flex-1 overflow-y-auto px-4 pb-4 pt-3"
      >
        {secondaryTabs && (
          <div
            role="tablist"
            aria-label={`${section === "records" ? "Record" : "Work"} views`}
            className="mb-3 flex rounded-xl bg-slate-900/70 p-1"
          >
            {secondaryTabs.map((item, index) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  id={`crm-view-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`crm-view-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(item.id)}
                  onKeyDown={(event) =>
                    handleTabKeyDown(
                      event,
                      index,
                      secondaryTabs.map((candidate) => candidate.id),
                      selectTab
                    )
                  }
                  className={`flex min-w-0 flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition ${
                    selected
                      ? "bg-indigo-950/80 text-indigo-200 shadow-sm ring-1 ring-indigo-800/80"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                  {item.count > 0 && (
                    <span
                      className={`ml-1.5 tabular-nums ${
                        item.attention
                          ? "rounded-full bg-indigo-950 px-1.5 py-0.5 text-[10px] leading-none text-indigo-300"
                          : selected
                            ? "text-indigo-300"
                            : "text-slate-400"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div
          id={`crm-view-panel-${tab}`}
          role={secondaryTabs ? "tabpanel" : undefined}
          aria-labelledby={secondaryTabs ? `crm-view-tab-${tab}` : undefined}
        >
          {tab === "contacts" && (
            <ContactsTab
              contacts={contacts}
              focusedId={focusedId}
              onCreated={reload}
              onOpenAccountThread={onOpenAccountThread}
              onError={onError}
            />
          )}
          {tab === "sales_reps" && (
            <SalesRepsTab salesReps={salesReps} focusedId={focusedId} onCreated={reload} onError={onError} />
          )}
          {tab === "deals" && (
            <DealsTab
              deals={deals}
              contacts={contacts}
              salesReps={salesReps}
              focusedId={focusedId}
              onCreated={reload}
              onError={onError}
            />
          )}
          {tab === "tasks" && (
            <TasksTab
              tasks={tasks}
              agents={agents}
              salesReps={salesReps}
              busyAgentIds={busyAgentIds}
              runningTaskId={runningTaskId}
              focusedId={focusedId}
              onRun={runTask}
              onCreated={reload}
              onError={onError}
            />
          )}
          {tab === "routines" && (
            <RoutinesTab
              agents={agents}
              busyAgentIds={busyAgentIds}
              version={version}
              onRun={onRunRoutine}
              onCount={setRoutineCount}
              onError={onError}
            />
          )}
          {tab === "activity" && <ActivityTab activities={activities} focusedId={focusedId} />}
        </div>
      </div>
    </aside>
  );
}

// ---------------- contacts ----------------

function ContactsTab({
  contacts,
  focusedId,
  onCreated,
  onOpenAccountThread,
  onError,
}: {
  contacts: Contact[];
  focusedId: string | null;
  onCreated: () => void;
  onOpenAccountThread: (accountName: string) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "", status: "lead" });
  const [openingContactId, setOpeningContactId] = useState<number | null>(null);

  const create = async () => {
    try {
      await api("/api/contacts", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", email: "", company: "", status: "lead" });
      setShowForm(false);
      onCreated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to create contact");
    }
  };

  const openAccountThread = async (contact: Contact) => {
    if (openingContactId !== null) return;
    setOpeningContactId(contact.id);
    try {
      await onOpenAccountThread(contact.company ?? contact.name);
    } finally {
      setOpeningContactId(null);
    }
  };

  return (
    <div>
      <div className="mb-2 flex min-h-8 items-center justify-end px-1">
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          aria-expanded={showForm}
          aria-controls="add-contact-form"
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/75 px-2.5 text-xs font-semibold text-slate-300 shadow-sm transition hover:border-indigo-500/35 hover:bg-indigo-950/55 hover:text-indigo-300"
        >
          <span aria-hidden="true" className="text-sm leading-none">
            {showForm ? "×" : "+"}
          </span>
          {showForm ? "Close" : "New contact"}
        </button>
      </div>
      {showForm && (
        <form
          id="add-contact-form"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
          className="mb-2.5 space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/90 p-3 shadow-sm"
        >
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Name</span>
            <input
              required
              autoComplete="name"
              placeholder="Jane Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-500 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 transition focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="jane@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-500 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 transition focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="min-w-0 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Company</span>
              <input
                autoComplete="organization"
                placeholder="Acme"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-lg border border-slate-500 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 transition focus:border-indigo-500 focus:outline-none"
              />
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-slate-500 bg-slate-950 px-2.5 py-2 text-xs capitalize text-slate-200 transition focus:border-indigo-500 focus:outline-none"
              >
                {CONTACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!form.name.trim()}
              className="min-h-9 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition enabled:hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add contact
            </button>
          </div>
        </form>
      )}
      <div className="divide-y divide-slate-800/85">
        {contacts.map((c) => (
          <article
            key={c.id}
            data-record={`contacts-${c.id}`}
            aria-labelledby={`contact-${c.id}-name`}
            className={`${RECORD_ROW_CLASS} py-3.5${focusClass(focusedId, "contacts", c.id)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3
                    id={`contact-${c.id}-name`}
                    title={c.name}
                    className="min-w-0 truncate text-sm font-semibold leading-5 text-slate-100"
                  >
                    {c.name}
                  </h3>
                  <Pill text={c.status} map={STATUS_PILL} />
                </div>
                <div
                  title={[c.company, c.email].filter(Boolean).join(" · ") || "No contact details"}
                  className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-400"
                >
                  {[c.company, c.email].filter(Boolean).join(" · ") || "No contact details"}
                </div>
              </div>
            </div>
            {c.notes && (
              <p
                title={c.notes}
                className="mt-2.5 line-clamp-2 border-l-2 border-slate-800 pl-2.5 text-xs leading-4 text-slate-400"
              >
                {c.notes}
              </p>
            )}
            <div className="mt-2.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-400">Sales rep</div>
                <div
                  title={c.sales_rep_name ?? "Unassigned"}
                  className="mt-0.5 truncate text-xs font-semibold text-slate-300"
                >
                  {c.sales_rep_name ?? "Unassigned"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void openAccountThread(c)}
                disabled={openingContactId !== null}
                title={`Open ${c.company ?? c.name} conversation`}
                aria-label={`Open ${c.company ?? c.name} conversation`}
                className="min-h-8 shrink-0 rounded-lg border border-transparent bg-transparent px-2.5 text-xs font-semibold text-slate-400 transition group-hover:text-indigo-300 hover:border-indigo-800 hover:bg-indigo-950/80 hover:text-indigo-200 focus-visible:text-indigo-300 disabled:cursor-wait disabled:opacity-60"
              >
                {openingContactId === c.id ? "Opening…" : "Message"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ---------------- sales reps ----------------

function SalesRepsTab({
  salesReps,
  focusedId,
  onCreated,
  onError,
}: {
  salesReps: SalesRep[];
  focusedId: string | null;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const create = async () => {
    try {
      await api("/api/sales-reps", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", phone: "" });
      setShowForm(false);
      onCreated();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to add sales rep");
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowForm((shown) => !shown)}
        className="w-full rounded-lg border border-dashed border-slate-700 py-1.5 text-xs text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
      >
        {showForm ? "Cancel" : "+ Add sales rep"}
      </button>
      {showForm && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <input
            aria-label="Sales rep name"
            placeholder="Name *"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="w-full rounded-md border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              aria-label="Sales rep email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="min-w-0 flex-1 rounded-md border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <input
              aria-label="Sales rep phone"
              placeholder="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="min-w-0 flex-1 rounded-md border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            onClick={create}
            disabled={!form.name.trim()}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white enabled:hover:bg-indigo-700 disabled:opacity-40"
          >
            Add sales rep
          </button>
        </div>
      )}
      <div className="divide-y divide-slate-800/85">
        {salesReps.map((salesRep) => (
          <div
            key={salesRep.id}
            data-record={`sales_reps-${salesRep.id}`}
            className={`${RECORD_ROW_CLASS} py-3${focusClass(focusedId, "sales_reps", salesRep.id)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-[13px] font-medium text-slate-200">{salesRep.name}</div>
              <span className="shrink-0 rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                ID {salesRep.id}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-400">
              {[salesRep.email, salesRep.phone].filter(Boolean).join(" · ") || "No contact details"}
            </div>
            <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
              <span>{Number(salesRep.contact_count ?? 0)} contacts</span>
              <span>{Number(salesRep.won_deal_count ?? 0)} won · {fmtMoney(Number(salesRep.won_value ?? 0))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- deals ----------------

function DealsTab({
  deals,
  contacts,
  salesReps,
  focusedId,
  onCreated,
  onError,
}: {
  deals: Deal[];
  contacts: Contact[];
  salesReps: SalesRep[];
  focusedId: string | null;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", contact_id: "", stage: "lead" });
  const [closers, setClosers] = useState<Record<number, string>>({});

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

  const closeDeal = async (deal: Deal) => {
    const contact = contacts.find((candidate) => candidate.id === deal.contact_id);
    const salesRepId = closers[deal.id] || contact?.sales_rep_id?.toString() || "";
    if (!salesRepId) {
      onError("Choose a sales rep before closing the deal");
      return;
    }
    try {
      await api(`/api/deals/${deal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: "won", closed_by_sales_rep_id: Number(salesRepId) }),
      });
      onCreated();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to close deal");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Open pipeline</div>
          <div className="text-sm font-semibold text-slate-100">{fmtMoney(openValue)}</div>
        </div>
        <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Won</div>
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
            aria-label="Deal title"
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              aria-label="Deal value"
              placeholder="Value ($)"
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="w-24 rounded-md border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <select
              aria-label="Deal contact"
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              className="flex-1 rounded-md border border-slate-500 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">No contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Deal stage"
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              className="w-24 rounded-md border border-slate-500 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
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
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white enabled:hover:bg-indigo-700 disabled:opacity-40"
          >
            Add deal
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-800/85">
        {deals.map((d) => (
          <div
            key={d.id}
            data-record={`deals-${d.id}`}
            className={`${RECORD_ROW_CLASS} py-3${focusClass(focusedId, "deals", d.id)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-slate-200">{d.title}</div>
                <div className="truncate text-[11px] text-slate-400">{d.contact_name ?? "No contact"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">{fmtMoney(d.value)}</span>
                <Pill text={d.stage} map={STAGE_PILL} />
              </div>
            </div>
            {d.notes && <div className="mt-1.5 truncate text-[11px] italic text-slate-400">{d.notes}</div>}
            {d.stage === "won" || d.stage === "lost" ? (
              <div className="mt-2 text-[11px] text-slate-400">
                Closed{d.closed_by_sales_rep_name ? ` by ${d.closed_by_sales_rep_name}` : ""}
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <select
                  value={closers[d.id] ?? contacts.find((contact) => contact.id === d.contact_id)?.sales_rep_id ?? ""}
                  onChange={(event) => setClosers((current) => ({ ...current, [d.id]: event.target.value }))}
                  aria-label={`Sales rep closing ${d.title}`}
                  className="min-w-0 flex-1 rounded-md border border-slate-500 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                >
                  <option value="">Choose closer</option>
                  {salesReps.map((salesRep) => (
                    <option key={salesRep.id} value={salesRep.id}>{salesRepLabel(salesRep)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void closeDeal(d)}
                  disabled={salesReps.length === 0}
                  className="min-h-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition enabled:hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  Close won
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- tasks ----------------

function TasksTab({
  tasks,
  agents,
  salesReps,
  busyAgentIds,
  runningTaskId,
  focusedId,
  onRun,
  onCreated,
  onError,
}: {
  tasks: Task[];
  agents: Agent[];
  salesReps: SalesRep[];
  busyAgentIds: number[];
  runningTaskId: number | null;
  focusedId: string | null;
  onRun: (task: Task) => void;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assignee: agents[0] ? `agent:${agents[0].id}` : "" });

  const create = async () => {
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          assignee_agent_id: form.assignee.startsWith("agent:") ? Number(form.assignee.slice(6)) : null,
          assignee_sales_rep_id: form.assignee.startsWith("rep:") ? Number(form.assignee.slice(4)) : null,
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
            aria-label="Task title"
            placeholder="Task title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-md border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <textarea
            aria-label="Task details"
            placeholder="Details for the agent (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-md border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <select
              aria-label="Task assignee"
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="flex-1 rounded-md border border-slate-500 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">Unassigned</option>
              <optgroup label="AI agents">
                {agents.map((a) => (
                  <option key={a.id} value={`agent:${a.id}`}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Sales reps">
                {salesReps.map((salesRep) => (
                  <option key={salesRep.id} value={`rep:${salesRep.id}`}>
                    {salesRepLabel(salesRep)}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              onClick={create}
              disabled={!form.title.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white enabled:hover:bg-indigo-700 disabled:opacity-40"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-800/85">
        {tasks.map((t) => {
          const isRunning = t.status === "running" || runningTaskId === t.id;
          // Only the assignee being busy blocks a run — other agents stay free.
          const assigneeBusy = t.assignee_agent_id != null && busyAgentIds.includes(t.assignee_agent_id);
          return (
            <div
              key={t.id}
              data-record={`tasks-${t.id}`}
              className={`${RECORD_ROW_CLASS} py-3${focusClass(focusedId, "tasks", t.id)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate-200">{t.title}</div>
                  {t.description && <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{t.description}</div>}
                  <div className="mt-1.5 flex items-center gap-2">
                    <Pill text={isRunning ? "running" : t.status} map={TASK_PILL} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      {t.assignee_name ? (
                        <><AgentIcon icon={t.assignee_emoji} name={t.assignee_name} className="h-3 w-3" />{t.assignee_name}</>
                      ) : t.assignee_sales_rep_name ? (
                        <><UserRound aria-hidden="true" className="h-3 w-3" />{t.assignee_sales_rep_name}</>
                      ) : (
                        "Unassigned"
                      )}
                    </span>
                  </div>
                </div>
                {t.assignee_agent_id != null && (
                  <button
                    onClick={() => onRun(t)}
                    disabled={assigneeBusy || isRunning}
                    className="min-h-6 shrink-0 rounded-md border border-indigo-500/50 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition enabled:hover:bg-indigo-500/25 disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1">
                      {t.status === "todo" ? <Play aria-hidden="true" className="h-3 w-3" /> : <RefreshCw aria-hidden="true" className={`h-3 w-3 ${isRunning ? "animate-spin" : ""}`} />}
                      {isRunning ? "Running…" : t.status === "todo" ? "Run" : "Re-run"}
                    </span>
                  </button>
                )}
              </div>
              {t.result && (
                <details className="group mt-2">
                  <summary className="inline-flex min-h-6 items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200">
                    <ChevronRight aria-hidden="true" className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Show result
                  </summary>
                  <div className="mt-1 whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950 p-2 text-[11px] leading-relaxed text-slate-400">
                    {t.result}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- activity ----------------

function ActivityTab({ activities, focusedId }: { activities: Activity[]; focusedId: string | null }) {
  if (activities.length === 0) {
    return <div className="mt-8 text-center text-xs text-slate-400">No activity yet.</div>;
  }
  return (
    <div className="divide-y divide-slate-800/85">
      {activities.map((a) => (
        <div
          key={a.id}
          data-record={`activities-${a.id}`}
          className={`${RECORD_ROW_CLASS} py-3${focusClass(focusedId, "activities", a.id)}`}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400"><ActivityTypeIcon type={a.type} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] leading-relaxed text-slate-300">{a.content}</div>
              <div className="mt-1 text-[11px] text-slate-400">
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
