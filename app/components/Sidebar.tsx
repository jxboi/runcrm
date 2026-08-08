"use client";

import { useState } from "react";
import { fmtTime } from "@/lib/client";
import { Agent, ChatThread, ENTITIES, Recipient } from "@/lib/types";

const ACCESS_DOT: Record<string, string> = {
  none: "bg-slate-700",
  read: "bg-sky-500",
  write: "bg-emerald-500",
};

const ENTITY_LABEL: Record<(typeof ENTITIES)[number], string> = {
  contacts: "contacts",
  deals: "deals",
  activities: "activity",
  tasks: "tasks",
  sales_reps: "sales reps",
};

type IconProps = { className?: string };

function PlusIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <path d="m7.5 4.75 5 5.25-5 5.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function PencilIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <path d="m13.9 3.85 2.25 2.25M4.25 15.75l.65-3.2 8.55-8.55a1.6 1.6 0 0 1 2.25 0l.3.3a1.6 1.6 0 0 1 0 2.25L7.45 15.1l-3.2.65Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function WorkflowIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <path d="M11.2 2.75 5.4 10h4.1l-.7 7.25 5.8-8.5h-4.1l.7-6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function ThreadIcon({ kind, className = "h-4 w-4" }: IconProps & { kind: "home" | "account" | "chat" }) {
  if (kind === "home") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
        <path d="m3.5 9 6.5-5.5L16.5 9v6.75a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75V9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M8 16.5v-4.25h4v4.25" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    );
  }

  if (kind === "account") {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
        <path d="M3.75 17V4.75a1 1 0 0 1 1-1h7.5a1 1 0 0 1 1 1V17M13.25 8h2a1 1 0 0 1 1 1v8M2.5 17h15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45" />
        <path d="M6.5 7h.01M10.5 7h.01M6.5 10.25h.01M10.5 10.25h.01M6.5 13.5h.01M10.5 13.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <path d="M4.25 4.25h11.5a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H9l-3.75 2.5v-2.5h-1a1.5 1.5 0 0 1-1.5-1.5v-6.5a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M6.5 9h.01M10 9h.01M13.5 9h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function SectionAction({
  children,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      aria-busy={disabled || undefined}
      className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-transparent bg-transparent px-1.5 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-slate-900 hover:text-indigo-300 disabled:cursor-wait disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      <PlusIcon />
      {children}
    </button>
  );
}

export default function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  agents,
  selectedAgentId,
  busyAgentIds,
  onSelect,
  onNewAgent,
  onEditAgent,
  workspaceMode,
  onOpenWorkflowStudio,
}: {
  threads: ChatThread[];
  activeThreadId: number;
  onSelectThread: (id: number) => void;
  onCreateThread: () => Promise<void>;
  agents: Agent[];
  selectedAgentId: number | null;
  busyAgentIds: number[];
  onSelect: (id: Recipient) => void;
  onNewAgent: () => void;
  onEditAgent: (agent: Agent) => void;
  workspaceMode: "crm" | "workflows";
  onOpenWorkflowStudio: () => void;
}) {
  const [savingThread, setSavingThread] = useState(false);

  const submitThread = async () => {
    if (savingThread) return;
    setSavingThread(true);
    try {
      await onCreateThread();
    } finally {
      setSavingThread(false);
    }
  };

  return (
    <aside aria-label="Workspace sidebar" className="crm-sidebar flex w-[16rem] shrink-0 flex-col bg-slate-950">
      <div className="flex shrink-0 items-center gap-3 px-4 pb-4 pt-5">
        <div className="crm-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-bold text-white shadow-lg shadow-indigo-950">
          R
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold tracking-tight text-slate-100">RunCRM</span>
            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">v0.1</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">Chat-first CRM</div>
        </div>
      </div>

      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          aria-pressed={workspaceMode === "workflows"}
          onClick={onOpenWorkflowStudio}
          className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${
            workspaceMode === "workflows"
              ? "border-indigo-500/25 bg-indigo-500/[0.08] shadow-sm"
              : "border-transparent bg-transparent hover:border-slate-800 hover:bg-white/55"
          }`}
        >
          {workspaceMode === "workflows" && (
            <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-indigo-500" />
          )}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 transition-colors group-hover:bg-indigo-500/15">
            <WorkflowIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-slate-200">Workflow Studio</span>
            <span className="mt-0.5 block truncate text-[11px] text-slate-400">Build automations with AI</span>
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-indigo-400" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        <section aria-labelledby="sidebar-conversations-heading">
          <div className="flex items-center justify-between gap-3 px-1 pb-2 pt-2">
            <h2 id="sidebar-conversations-heading" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Conversations
            </h2>
            <SectionAction
              disabled={savingThread}
              onClick={() => void submitThread()}
              title="Start a new conversation"
            >
              {savingThread ? "Starting…" : "New chat"}
            </SectionAction>
          </div>

          <nav aria-label="Conversations" className="space-y-1">
            {threads.map((thread) => {
              const selected = workspaceMode === "crm" && thread.id === activeThreadId;
              const kind = thread.account_name ? "account" : thread.id === 1 ? "home" : "chat";
              const preview = thread.last_message ?? (thread.id === 1 ? "Workspace-wide conversation" : "No messages yet");

              return (
                <button
                  type="button"
                  key={thread.id}
                  aria-current={selected ? "page" : undefined}
                  aria-label={`Open ${thread.title} conversation`}
                  onClick={() => onSelectThread(thread.id)}
                  title={`${thread.title} — ${preview}`}
                  className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-indigo-500/20 bg-indigo-500/[0.08] shadow-sm"
                      : "border-transparent hover:border-slate-700/70 hover:bg-slate-800/55"
                  }`}
                >
                  {selected && (
                    <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-indigo-500" />
                  )}
                  <span className="flex items-start gap-2.5">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-indigo-500/10 text-indigo-400" : "bg-slate-800/75 text-slate-400"}`}>
                      <ThreadIcon kind={kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[13px] text-slate-200 ${selected ? "font-semibold" : "font-medium"}`}>{thread.title}</span>
                        {thread.last_message_at && (
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{fmtTime(thread.last_message_at)}</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-400">{preview}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </section>

        <div aria-hidden="true" className="mx-1 my-4 h-px bg-slate-800/85" />

        <section aria-labelledby="sidebar-agents-heading">
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <h2 id="sidebar-agents-heading" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Agents
            </h2>
            <SectionAction onClick={onNewAgent} title="Create a new agent">
              New agent
            </SectionAction>
          </div>

          <div className="space-y-1" role="list">
            {agents.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-700 bg-white/45 px-4 py-5 text-center text-[12px] leading-5 text-slate-400">
                No agents yet.
                <br />
                Create one to start chatting.
              </div>
            )}

            {agents.map((agent) => {
              const selected = agent.id === selectedAgentId;
              const busy = busyAgentIds.includes(agent.id);
              const accessSummary = ENTITIES.map((entity) => `${ENTITY_LABEL[entity]}: ${agent.capabilities[entity]}`).join(", ");

              return (
                <div className="group relative" key={agent.id} role="listitem">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(agent.id)}
                    className={`relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border py-2.5 pl-3 pr-10 text-left transition-colors ${
                      selected
                        ? "border-transparent bg-slate-900/85"
                        : "border-transparent hover:border-slate-700/70 hover:bg-slate-800/55"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${selected ? "bg-indigo-950 text-indigo-300 ring-1 ring-indigo-500/20" : "bg-slate-800/80"}`}>
                      {agent.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`truncate text-[13px] font-medium ${selected ? "text-indigo-300" : "text-slate-200"}`}>{agent.name}</span>
                        {busy && (
                          <span className="inline-flex shrink-0 items-center" title="Working">
                            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                            <span className="sr-only">Working</span>
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex min-w-0 items-center gap-1.5">
                        {agent.kind === "workflow" && (
                          <span className="shrink-0 rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-400">
                            Builder
                          </span>
                        )}
                        <span aria-label={`Access: ${accessSummary}`} className="inline-flex shrink-0 items-center gap-1" role="img">
                          {ENTITIES.map((entity) => (
                            <span
                              aria-hidden="true"
                              className={`h-1.5 w-1.5 rounded-full ring-1 ring-white/70 ${ACCESS_DOT[agent.capabilities[entity]]}`}
                              key={entity}
                              title={`${ENTITY_LABEL[entity]}: ${agent.capabilities[entity]}`}
                            />
                          ))}
                        </span>
                        <span className="min-w-0 truncate text-[11px] text-slate-400">{agent.model.replace("claude-", "")}</span>
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label={`Edit ${agent.name}`}
                    onClick={() => onEditAgent(agent)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-transparent bg-slate-950/90 text-slate-500 opacity-0 shadow-sm transition-all hover:border-slate-700 hover:text-slate-200 focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                    title={`Edit ${agent.name}`}
                  >
                    <PencilIcon />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <details className="group shrink-0 border-t border-slate-800/85 bg-white/50">
        <summary className="flex min-h-11 items-center gap-2 px-4 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200">
          <span>Permission key</span>
          <span aria-hidden="true" className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
          </span>
          <ChevronRightIcon className="h-3.5 w-3.5 text-slate-500 transition-transform group-open:rotate-90" />
        </summary>
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Write
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Read
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-700" /> None
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-500">Dot order: contacts, deals, activity, tasks, sales reps.</p>
        </div>
      </details>
    </aside>
  );
}
