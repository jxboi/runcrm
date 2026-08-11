"use client";

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Mail,
  Pencil,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import {
  Activity,
  Agent,
  Contact,
  CONTACT_STATUSES,
  Deal,
  DEAL_STAGES,
  EMAIL_PATTERN,
  Entity,
  EntityRef,
  SalesRep,
  Task,
} from "@/lib/types";
import { api, fmtMoney, fmtTime } from "@/lib/client";
import { AgentIcon } from "@/app/components/AgentIcon";
import DropdownMenu from "@/app/components/DropdownMenu";
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

type ViewMenuOption = { id: Tab; label: string; count: number; attention?: boolean };

type ContactMenuOption = { value: string; label: string };
type ContactMenuSection = "root" | "status" | "sort";

function ContactViewMenu({
  statusFilter,
  sortBy,
  onStatusChange,
  onSortChange,
}: {
  statusFilter: string;
  sortBy: string;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
}) {
  const [section, setSection] = useState<ContactMenuSection>("root");
  const statusOptions: ContactMenuOption[] = [
    { value: "all", label: "All" },
    ...CONTACT_STATUSES.map((status) => ({
      value: status,
      label: status.charAt(0).toUpperCase() + status.slice(1),
    })),
  ];
  const sortOptions: ContactMenuOption[] = [
    { value: "none", label: "None" },
    { value: "recent", label: "Recently updated" },
    { value: "name-asc", label: "Name A–Z" },
    { value: "name-desc", label: "Name Z–A" },
  ];

  const selectStatus = (value: string, close: () => void) => {
    onStatusChange(value);
    close();
  };

  const selectSort = (value: string, close: () => void) => {
    onSortChange(value);
    close();
  };

  return (
    <Popover as="div" className="relative w-auto shrink-0">
      {({ close }) => (
        <>
          <PopoverButton
            id="crm-contact-view-options"
            aria-label="Contact filter and sort options"
            title="Filter and sort contacts"
            onClick={() => setSection("root")}
            className="crm-dropdown-trigger inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 outline-none transition hover:bg-slate-900 hover:text-slate-200 focus-visible:bg-slate-900 focus-visible:text-indigo-300"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
          </PopoverButton>
          <PopoverPanel
            aria-label="Contact filter and sort options"
            anchor="bottom start"
            portal
            transition
            className="z-[70] mt-2 w-48 origin-top-left rounded-2xl bg-slate-900 p-1 text-slate-200 shadow-xl shadow-slate-900/10 outline-none transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
          >
            {section === "root" ? (
              <div className="space-y-0.5" role="menu">
                <ContactMenuSectionButton label="Filter by status" onClick={() => setSection("status")} />
                <ContactMenuSectionButton label="Sort by" onClick={() => setSection("sort")} />
              </div>
            ) : (
              <div role="menu">
                <button
                  type="button"
                  onClick={() => setSection("root")}
                  className="flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus:bg-slate-800 focus:text-slate-100 focus:outline-none"
                >
                  <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                  {section === "status" ? "Filter by status" : "Sort by"}
                </button>
                <div aria-hidden="true" className="my-1 h-px bg-slate-800" />
                {(section === "status" ? statusOptions : sortOptions).map((option) => (
                  <ContactMenuOptionButton
                    key={option.value}
                    option={option}
                    selected={section === "status" ? statusFilter === option.value : sortBy === option.value}
                    onClick={() => section === "status" ? selectStatus(option.value, close) : selectSort(option.value, close)}
                  />
                ))}
              </div>
            )}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
}

function ContactMenuSectionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 focus:bg-slate-800 focus:text-slate-100 focus:outline-none"
    >
      {label}
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} />
    </button>
  );
}

function ContactMenuOptionButton({
  option,
  selected,
  onClick,
}: {
  option: ContactMenuOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={option.label}
      aria-current={selected || undefined}
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 focus:bg-slate-800 focus:text-slate-100 focus:outline-none"
    >
      <span>{option.label}</span>
      {selected && <Check aria-hidden="true" className="h-3.5 w-3.5 text-indigo-400" strokeWidth={2} />}
    </button>
  );
}

function ViewMenu({
  options,
  value,
  onChange,
  buttonId,
  className = "w-auto shrink-0",
  buttonClassName = "w-max justify-end rounded-full bg-slate-900 px-3 text-slate-200 hover:bg-slate-800",
  menuClassName = "-translate-x-2 bg-slate-900",
  optionClassName,
}: {
  options: ViewMenuOption[];
  value: Tab;
  onChange: (value: Tab) => void;
  buttonId: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
}) {
  return (
    <DropdownMenu
      options={options.map((item) => ({ value: item.id, label: item.label }))}
      value={value}
      onChange={(nextValue) => onChange(nextValue as Tab)}
      id={buttonId}
      ariaLabel="Choose view"
      className={className}
      buttonClassName={buttonClassName}
      menuClassName={menuClassName}
      optionClassName={optionClassName}
      borderless
      renderValue={(option) => <span className="truncate">{option?.label ?? ""}</span>}
      showSelectedIndicator={false}
    />
  );
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

const RECORD_ROW_CLASS = "group -mx-1 px-3 transition-colors hover:bg-slate-950/65";

export default function DataPanel({
  agents,
  version,
  busyAgentIds,
  focusRef,
  onRunTask,
  onRunRoutine,
  onError,
}: {
  agents: Agent[];
  version: number;
  busyAgentIds: number[];
  focusRef: EntityRef | null;
  onRunTask: (taskId: number, assigneeId: number | null) => Promise<void>;
  onRunRoutine: (routineId: number, retryRunId?: number) => Promise<void>;
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
  const [contactFormOpen, setContactFormOpen] = useState(false);

  const selectTab = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab === "contacts" || nextTab === "sales_reps" || nextTab === "deals") setLastRecordsTab(nextTab);
    if (nextTab === "tasks" || nextTab === "routines") setLastWorkTab(nextTab);
  }, []);

  const { focusedId, containerRef } = useFocusedRecord(focusRef, selectTab);
  const section = SECTION_FOR_TAB[tab];

  const selectSection = (nextSection: Section) => {
    if (nextSection === "records") {
      selectTab(lastRecordsTab);
    } else if (nextSection === "work") {
      setContactFormOpen(false);
      selectTab(lastWorkTab);
    } else {
      setContactFormOpen(false);
      selectTab("activity");
    }
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
          { id: "sales_reps", label: "Sales Reps", count: salesReps.length },
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

  const hasChildViews = secondaryTabs !== null;

  return (
    <aside aria-label="CRM data" className="crm-data-panel hidden w-[clamp(20rem,25vw,23rem)] shrink-0 flex-col overflow-x-hidden bg-slate-950 lg:flex">
      <div className="flex h-16 shrink-0 items-stretch border-b border-slate-800/70 px-3">
        <div
          role="tablist"
          aria-label="CRM data sections"
          className="flex min-w-0 flex-[2_1_0%] items-stretch gap-0"
        >
          {SECTIONS.map((item, index) => {
            const selected = section === item.id;
            return (
              <button
                key={item.id}
                id={`crm-section-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`crm-section-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectSection(item.id)}
                onKeyDown={(event) =>
                  handleTabKeyDown(
                    event,
                    index,
                    SECTIONS.map((candidate) => candidate.id),
                    selectSection
                  )
                }
                className={`-mb-px flex min-w-0 flex-1 items-center justify-center whitespace-nowrap border-b-2 px-1 text-xs font-medium transition ${
                  selected
                    ? "border-indigo-500 text-slate-100"
                    : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {secondaryTabs ? (
          <div className="flex min-w-[9rem] flex-1 items-stretch justify-end">
            <span aria-hidden="true" className="mx-1.5 my-5 h-6 w-px shrink-0 bg-slate-800/80" />
            <div className="flex min-w-0 items-center">
              <ViewMenu
                options={secondaryTabs}
                value={tab}
                onChange={selectTab}
                buttonId={section === "records" ? "crm-view-menu-button" : "crm-work-menu-button"}
                className={section === "records" ? "w-28 shrink-0" : undefined}
                buttonClassName={section === "records" ? "w-full justify-between rounded-full bg-slate-900 px-3 text-slate-200 hover:bg-slate-800" : undefined}
                menuClassName={section === "records" ? "-translate-x-1 bg-slate-900 p-1" : undefined}
                optionClassName={section === "records" ? "px-2 py-1.5 text-xs" : undefined}
              />
            </div>
          </div>
        ) : (
          <div aria-hidden="true" className="flex min-w-[9rem] flex-1" />
        )}
      </div>

      <div
        ref={containerRef}
        id={`crm-section-panel-${section}`}
        role="tabpanel"
        aria-labelledby={
          section === "records"
            ? "crm-view-menu-button"
            : section === "work"
              ? "crm-work-menu-button"
              : `crm-section-tab-${section}`
        }
        className="flex-1 overflow-y-auto px-4 pb-4 pt-3"
      >
        {(section === "activity" || hasChildViews) && (
          <div
            id={`crm-view-panel-${tab}`}
            role={hasChildViews ? "tabpanel" : undefined}
            aria-labelledby={
              section === "records"
                ? "crm-view-menu-button"
                : section === "work"
                  ? "crm-work-menu-button"
                  : undefined
            }
          >
            {tab === "contacts" && (
              <ContactsTab
                contacts={contacts}
                focusedId={focusedId}
                showForm={contactFormOpen}
                onToggleForm={() => setContactFormOpen((open) => !open)}
                onCreated={() => {
                  setContactFormOpen(false);
                  void reload();
                }}
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
        )}
      </div>
    </aside>
  );
}

// ---------------- contacts ----------------

type ContactFormValues = { name: string; email: string; company: string; status: string };

function ContactFormModal({
  mode,
  form,
  hasChanges,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  form: ContactFormValues;
  hasChanges?: boolean;
  saving?: boolean;
  onChange: (form: ContactFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isEdit = mode === "edit";
  const titleId = `${mode}-contact-title`;
  const emailInvalid = Boolean(form.email.trim() && !EMAIL_PATTERN.test(form.email.trim()));

  return (
    <div
      id={`${mode}-contact-form`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="crm-contact-modal fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label={`Close ${isEdit ? "edit" : "add contact"} dialog`}
        onClick={onClose}
        className="crm-contact-modal-backdrop absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="relative w-full max-w-[34rem] space-y-4 rounded-[1.35rem] border border-slate-700/80 bg-slate-950 p-5 shadow-[0_24px_70px_rgba(25,27,33,0.24)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-200">
            {isEdit ? "Edit contact" : "Add a contact"}
          </h2>
          <button
            type="button"
            aria-label={`Cancel ${isEdit ? "editing" : "adding"} contact`}
            onClick={onClose}
            className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-slate-500 shadow-[0_3px_12px_rgba(25,27,33,0.12)] transition hover:bg-slate-900 hover:text-slate-200 hover:shadow-[0_4px_16px_rgba(25,27,33,0.16)]"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Name</span>
          <input
            required
            autoFocus={!isEdit}
            autoComplete="name"
            placeholder="Jane Doe"
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            disabled={saving}
            className="crm-contact-input h-11 w-full rounded-xl border-0 bg-slate-800 px-3 text-sm text-slate-200 transition placeholder:text-slate-500 focus:border-0 focus:outline-none disabled:opacity-60"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="min-w-0 space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="jane@company.com"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
              aria-invalid={emailInvalid}
              aria-describedby={emailInvalid ? `${mode}-contact-email-error` : undefined}
              disabled={saving}
              className="crm-contact-input h-11 w-full rounded-xl border-0 bg-slate-800 px-3 text-sm text-slate-200 transition placeholder:text-slate-500 focus:border-0 focus:outline-none disabled:opacity-60"
            />
            {emailInvalid && (
              <span id={`${mode}-contact-email-error`} className="block text-xs text-rose-500">
                Enter a valid email address.
              </span>
            )}
          </label>
          <label className="min-w-0 space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Company</span>
            <input
              autoComplete="organization"
              placeholder="Acme"
              value={form.company}
              onChange={(event) => onChange({ ...form, company: event.target.value })}
              disabled={saving}
              className="crm-contact-input h-11 w-full rounded-xl border-0 bg-slate-800 px-3 text-sm text-slate-200 transition placeholder:text-slate-500 focus:border-0 focus:outline-none disabled:opacity-60"
            />
          </label>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Status</span>
            <DropdownMenu
              options={CONTACT_STATUSES.map((status) => ({
                value: status,
                label: status.charAt(0).toUpperCase() + status.slice(1),
              }))}
              value={form.status}
              onChange={(status) => onChange({ ...form, status })}
              id={`crm-${mode}-contact-status`}
              ariaLabel="Contact status"
              className="w-full"
              buttonClassName="h-11 rounded-xl border-slate-600 bg-slate-950 px-3 text-sm capitalize text-slate-200"
              portal={false}
            />
          </label>
          <button
            type="submit"
            disabled={saving || !form.name.trim() || emailInvalid || (isEdit && !hasChanges)}
            className="h-11 shrink-0 rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white transition enabled:hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 sm:min-w-36"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add contact"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ContactsTab({
  contacts,
  focusedId,
  showForm,
  onToggleForm,
  onCreated,
  onError,
}: {
  contacts: Contact[];
  focusedId: string | null;
  showForm: boolean;
  onToggleForm: () => void;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", company: "", status: "lead" });
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingForm, setEditingForm] = useState({ name: "", email: "", company: "", status: "lead" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("none");

  const editHasChanges = editingContact !== null && (
    editingForm.name.trim() !== editingContact.name.trim() ||
    editingForm.email.trim() !== (editingContact.email ?? "").trim() ||
    editingForm.company.trim() !== (editingContact.company ?? "").trim() ||
    editingForm.status !== editingContact.status
  );

  const visibleContacts = contacts
    .filter((contact) => {
      const matchesQuery = [contact.name, contact.email, contact.company, contact.sales_rep_name, contact.notes]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase());
      return matchesQuery && (statusFilter === "all" || contact.status === statusFilter);
    })
    .sort((a, b) => {
      if (sortBy === "recent") return b.updated_at.localeCompare(a.updated_at);
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });

  const create = async () => {
    try {
      await api("/api/contacts", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", email: "", company: "", status: "lead" });
      onCreated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to create contact");
    }
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setEditingForm({
      name: contact.name,
      email: contact.email ?? "",
      company: contact.company ?? "",
      status: contact.status,
    });
  };

  const saveEdit = async () => {
    if (!editingContact || !editingForm.name.trim()) return;
    setSavingEdit(true);
    try {
      await api(`/api/contacts/${editingContact.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingForm.name.trim(),
          email: editingForm.email.trim() || null,
          company: editingForm.company.trim() || null,
          status: editingForm.status,
        }),
      });
      setEditingContact(null);
      onCreated();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to update contact");
    } finally {
      setSavingEdit(false);
    }
  };

  const editButton = (contact: Contact) => {
    return (
      <button
        type="button"
        onClick={() => openEdit(contact)}
        title={`Edit ${contact.name}`}
        aria-label={`Edit ${contact.name}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-slate-500 opacity-0 transition-all hover:text-slate-200 focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
    );
  };

  return (
    <div>
      {showForm && (
        <ContactFormModal
          mode="add"
          form={form}
          onChange={setForm}
          onClose={onToggleForm}
          onSubmit={() => void create()}
        />
      )}
      {editingContact && (
        <ContactFormModal
          mode="edit"
          form={editingForm}
          hasChanges={editHasChanges}
          saving={savingEdit}
          onChange={setEditingForm}
          onClose={() => setEditingContact(null)}
          onSubmit={() => void saveEdit()}
        />
      )}
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search contacts</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contacts"
            className="crm-contacts-search h-9 w-full rounded-lg border border-slate-700 bg-transparent pl-8 pr-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-slate-700 focus:outline-none"
          />
        </label>
        <ContactViewMenu
          statusFilter={statusFilter}
          sortBy={sortBy}
          onStatusChange={setStatusFilter}
          onSortChange={setSortBy}
        />
        <button
          type="button"
          onClick={onToggleForm}
          aria-label="Add a contact"
          aria-expanded={showForm}
          aria-controls="add-contact-form"
          title="Add a contact"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-400 transition hover:border-slate-500 hover:text-slate-200 focus:outline-none focus-visible:border-slate-500 focus-visible:text-slate-200"
        >
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="divide-y divide-slate-800/85">
        {visibleContacts.map((c) => (
          <article
            key={c.id}
            data-record={`contacts-${c.id}`}
            aria-labelledby={`contact-${c.id}-name`}
            className={`${RECORD_ROW_CLASS} py-3.5 first:pt-0${focusClass(focusedId, "contacts", c.id)}`}
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
                  {c.notes && (
                    <span
                      title={c.notes}
                      aria-label={`Contact note: ${c.notes}`}
                      tabIndex={0}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-900 hover:text-indigo-300 focus-visible:bg-slate-900 focus-visible:text-indigo-300"
                    >
                      <Info aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                  )}
                </div>
                <div
                  title={[c.company, c.email, c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : ""].filter(Boolean).join(" · ") || "No contact details"}
                  className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-400"
                >
                  {[c.company, c.email, c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : ""].filter(Boolean).join(" · ") || "No contact details"}
                </div>
                {c.sales_rep_name && (
                  <div className="mt-2.5 min-w-0">
                    <div className="text-[11px] font-medium text-slate-400">Sales rep</div>
                    <div title={c.sales_rep_name} className="mt-0.5 truncate text-xs font-semibold text-slate-300">
                      {c.sales_rep_name}
                    </div>
                  </div>
                )}
              </div>
              {editButton(c)}
            </div>
          </article>
        ))}
      </div>
      {visibleContacts.length === 0 && (
        <div className="mt-2 rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-400">
          No contacts match your search.
        </div>
      )}
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
            <DropdownMenu
              options={[{ value: "", label: "No contact" }, ...contacts.map((contact) => ({ value: String(contact.id), label: contact.name }))]}
              value={form.contact_id}
              onChange={(contact_id) => setForm({ ...form, contact_id })}
              id="crm-deal-contact"
              ariaLabel="Deal contact"
              className="min-w-0 flex-1"
              buttonClassName="h-8 rounded-md border-slate-500 bg-slate-950 px-2 text-xs text-slate-200"
            />
            <DropdownMenu
              options={DEAL_STAGES.map((stage) => ({ value: stage, label: stage }))}
              value={form.stage}
              onChange={(stage) => setForm({ ...form, stage })}
              id="crm-deal-stage"
              ariaLabel="Deal stage"
              className="w-24 shrink-0"
              buttonClassName="h-8 rounded-md border-slate-500 bg-slate-950 px-2 text-xs capitalize text-slate-200"
            />
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
                <DropdownMenu
                  options={[{ value: "", label: "Choose closer" }, ...salesReps.map((salesRep) => ({ value: String(salesRep.id), label: salesRepLabel(salesRep) }))]}
                  value={String(closers[d.id] ?? contacts.find((contact) => contact.id === d.contact_id)?.sales_rep_id ?? "")}
                  onChange={(salesRepId) => setClosers((current) => ({ ...current, [d.id]: salesRepId }))}
                  id={`crm-deal-closer-${d.id}`}
                  ariaLabel={`Sales rep closing ${d.title}`}
                  className="min-w-0 flex-1"
                  buttonClassName="h-7 rounded-md border-slate-500 bg-slate-950 px-2 text-[11px] text-slate-300"
                />
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

type TaskFormValues = { title: string; description: string; assignee: string };

function TaskFormModal({
  form,
  assigneeOptions,
  onChange,
  onClose,
  onSubmit,
}: {
  form: TaskFormValues;
  assigneeOptions: { value: string; label: string }[];
  onChange: (form: TaskFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      id="assign-task-form"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-task-title"
      className="crm-contact-modal fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close assign task dialog"
        onClick={onClose}
        className="crm-contact-modal-backdrop absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="relative w-full max-w-[34rem] space-y-4 rounded-[1.35rem] border border-slate-700/80 bg-slate-950 p-5 shadow-[0_24px_70px_rgba(25,27,33,0.24)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="assign-task-title" className="text-lg font-semibold text-slate-200">Assign a task</h2>
          <button
            type="button"
            aria-label="Cancel assigning task"
            onClick={onClose}
            className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-slate-500 shadow-[0_3px_12px_rgba(25,27,33,0.12)] transition hover:bg-slate-900 hover:text-slate-200 hover:shadow-[0_4px_16px_rgba(25,27,33,0.16)]"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Task title</span>
          <input
            required
            autoFocus
            placeholder="Follow up with the lead"
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            className="crm-contact-input h-11 w-full rounded-xl border-0 bg-slate-800 px-3 text-sm text-slate-200 transition placeholder:text-slate-500 focus:border-0 focus:outline-none"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Details</span>
          <textarea
            aria-label="Task details"
            placeholder="Details for the assignee (optional)"
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
            rows={4}
            className="crm-contact-input w-full resize-none rounded-xl border-0 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 transition placeholder:text-slate-500 focus:border-0 focus:outline-none"
          />
        </label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Assignee</span>
            <DropdownMenu
              options={[
                { value: "", label: "Unassigned" },
                ...assigneeOptions,
              ]}
              value={form.assignee}
              onChange={(assignee) => onChange({ ...form, assignee })}
              id="crm-task-assignee"
              ariaLabel="Task assignee"
              className="w-full"
              buttonClassName="h-11 rounded-xl border-slate-600 bg-slate-950 px-3 text-sm text-slate-200"
              portal={false}
            />
          </label>
          <button
            type="submit"
            disabled={!form.title.trim()}
            className="h-11 shrink-0 rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white transition enabled:hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 sm:min-w-36"
          >
            Assign task
          </button>
        </div>
      </form>
    </div>
  );
}

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

  const assigneeOptions = [
    ...agents.map((agent) => ({ value: `agent:${agent.id}`, label: `AI · ${agent.name}` })),
    ...salesReps.map((salesRep) => ({ value: `rep:${salesRep.id}`, label: `Rep · ${salesRepLabel(salesRep)}` })),
  ];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowForm(true)}
        aria-expanded={showForm}
        aria-controls="assign-task-form"
        className="w-full rounded-lg border border-dashed border-slate-700 py-1.5 text-xs text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300"
      >
        + Assign a task
      </button>
      {showForm && (
        <TaskFormModal
          form={form}
          assigneeOptions={assigneeOptions}
          onChange={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={() => void create()}
        />
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
