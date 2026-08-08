"use client";

import { useState } from "react";
import { Building2, ChevronRight, Home, MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Workflow } from "lucide-react";
import { fmtTime } from "@/lib/client";
import { Agent, ChatThread, ENTITIES, Recipient } from "@/lib/types";
import { AgentIcon } from "@/app/components/AgentIcon";

const ACCESS_DOT: Record<string, string> = {
  none: "bg-slate-500",
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

function ThreadIcon({ kind, className = "h-4 w-4" }: { kind: "home" | "account" | "chat"; className?: string }) {
  const Icon = kind === "home" ? Home : kind === "account" ? Building2 : MessageSquare;
  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} />;
}

function SectionAction({
  children,
  disabled,
  onClick,
  title,
  collapsed = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-busy={disabled || undefined}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap border border-transparent bg-transparent text-[11px] font-semibold text-slate-400 transition-colors disabled:cursor-wait disabled:opacity-50 ${collapsed ? "h-10 w-10 rounded-xl p-0 hover:bg-slate-100 hover:text-slate-900" : "h-7 gap-1 rounded-lg px-1.5 hover:bg-slate-900 hover:text-indigo-300"}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
      <span className={collapsed ? "sr-only" : ""}>{children}</span>
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
  const [collapsed, setCollapsed] = useState(false);

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
    <aside
      aria-label="Workspace sidebar"
      data-collapsed={collapsed || undefined}
      className={`crm-sidebar flex shrink-0 flex-col overflow-x-hidden bg-slate-950 transition-[width] duration-200 motion-reduce:transition-none ${collapsed ? "w-20" : "w-[clamp(12.5rem,18vw,16rem)]"}`}
    >
      <div className={`flex shrink-0 items-center ${collapsed ? "flex-col gap-5 px-3 pb-6 pt-5" : "gap-3 px-4 pb-4 pt-5"}`}>
        <div className={`crm-mark flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-lg shadow-indigo-950 ${collapsed ? "h-10 w-10 rounded-full text-sm" : "h-10 w-10 rounded-xl text-base"}`}>
          R
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold tracking-tight text-slate-100">RunCRM</span>
              <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">v0.1</span>
            </div>
          </div>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex shrink-0 items-center justify-center border text-slate-500 transition-colors hover:text-slate-900 ${collapsed ? "h-11 w-11 rounded-xl border-slate-200 bg-white shadow-[0_3px_10px_rgba(17,18,22,0.07)] hover:border-slate-300 hover:bg-slate-50" : "ml-auto h-8 w-8 rounded-lg border-transparent hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200"}`}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}
        </button>
      </div>

      <div className={`shrink-0 ${collapsed ? "px-3 pb-5" : "px-3 pb-3"}`}>
        <button
          type="button"
          aria-pressed={workspaceMode === "workflows"}
          onClick={onOpenWorkflowStudio}
          title={collapsed ? "Workflow Studio" : undefined}
          className={`group relative flex w-full items-center overflow-hidden rounded-xl border text-left transition-colors ${collapsed ? "h-11 justify-center p-0" : "gap-3 px-3 py-2.5"} ${
            workspaceMode === "workflows"
              ? collapsed ? "border-transparent bg-slate-200/75 text-slate-900 shadow-sm" : "border-indigo-500/25 bg-indigo-500/[0.08] shadow-sm"
              : collapsed ? "border-transparent bg-transparent hover:bg-slate-100" : "border-transparent bg-transparent hover:border-slate-800 hover:bg-white/55"
          }`}
        >
          {workspaceMode === "workflows" && !collapsed && (
            <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-indigo-500" />
          )}
          <span
            className={`flex shrink-0 items-center justify-center rounded-lg border transition-colors ${collapsed ? "h-10 w-10 border-transparent bg-transparent text-slate-500 group-hover:text-slate-900" : "h-9 w-9"} ${
              workspaceMode === "workflows"
                ? collapsed ? "text-slate-900" : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
                : collapsed ? "" : "border-slate-800 bg-slate-900/80 text-slate-400 group-hover:border-indigo-500/20 group-hover:bg-indigo-500/10 group-hover:text-indigo-400"
            }`}
          >
            <Workflow aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-200">Workflow Studio</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-400">Build automations with AI</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-indigo-400" strokeWidth={1.8} />
            </>
          )}
        </button>
      </div>

      <div className="crm-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5">
        <section aria-labelledby="sidebar-conversations-heading">
          <div className={`flex items-center ${collapsed ? "justify-center pb-3" : "justify-between gap-3 px-1 pb-2 pt-2"}`}>
            <h2 id="sidebar-conversations-heading" className={collapsed ? "sr-only" : "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"}>
              Conversations
            </h2>
            <SectionAction
              collapsed={collapsed}
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
                  className={`relative w-full overflow-hidden rounded-xl border text-left transition-colors ${collapsed ? "flex h-11 items-center justify-center p-0" : "px-3 py-2.5"} ${
                    selected
                      ? collapsed ? "border-transparent bg-slate-200/75 shadow-sm" : "border-indigo-500/20 bg-indigo-500/[0.08] shadow-sm"
                      : collapsed ? "border-transparent hover:bg-slate-100" : "border-transparent hover:border-slate-700/70 hover:bg-slate-800/55"
                  }`}
                >
                  {selected && !collapsed && (
                    <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-indigo-500" />
                  )}
                  <span className={`flex items-start ${collapsed ? "justify-center" : "gap-2.5"}`}>
                    <span className={`flex shrink-0 items-center justify-center rounded-lg ${collapsed ? "mt-0 h-9 w-9 bg-transparent" : "mt-0.5 h-7 w-7"} ${selected ? collapsed ? "text-slate-900" : "bg-indigo-500/10 text-indigo-400" : collapsed ? "text-slate-500" : "bg-slate-800/75 text-slate-400"}`}>
                      <ThreadIcon kind={kind} />
                    </span>
                    {!collapsed && <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[13px] text-slate-200 ${selected ? "font-semibold" : "font-medium"}`}>{thread.title}</span>
                        {thread.last_message_at && (
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{fmtTime(thread.last_message_at)}</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-400">{preview}</span>
                    </span>}
                  </span>
                </button>
              );
            })}
          </nav>
        </section>

        <div aria-hidden="true" className={`${collapsed ? "mx-2 my-5 bg-slate-200" : "mx-1 my-4 bg-slate-800/85"} h-px`} />

        <section aria-labelledby="sidebar-agents-heading">
          <div className={`flex items-center ${collapsed ? "justify-center pb-3" : "justify-between gap-3 px-1 pb-2"}`}>
            <h2 id="sidebar-agents-heading" className={collapsed ? "sr-only" : "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"}>
              Agents
            </h2>
            <SectionAction collapsed={collapsed} onClick={onNewAgent} title="Create a new agent">
              New agent
            </SectionAction>
          </div>

          <div className="space-y-1" role="list">
            {agents.length === 0 && !collapsed && (
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
                    title={collapsed ? agent.name : undefined}
                    className={`relative flex w-full items-center overflow-hidden rounded-xl border text-left transition-colors ${collapsed ? "h-12 justify-center p-0" : "gap-2.5 py-2.5 pl-3 pr-10"} ${
                      selected
                        ? collapsed ? "border-transparent bg-slate-200/75 shadow-sm" : "border-transparent bg-transparent"
                        : collapsed ? "border-transparent hover:bg-slate-100" : "border-transparent hover:border-slate-700/70 hover:bg-slate-800/55"
                    }`}
                  >
                    <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${selected ? collapsed ? "bg-transparent text-slate-900" : "bg-indigo-950 text-indigo-300 ring-1 ring-indigo-500/20" : collapsed ? "bg-transparent text-slate-500" : "bg-slate-800/80"}`}>
                      <AgentIcon icon={agent.emoji} name={agent.name} className="h-4.5 w-4.5" />
                      {collapsed && busy && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-indigo-400 ring-2 ring-slate-950" />}
                    </span>
                    {!collapsed && <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-slate-200">{agent.name}</span>
                        {selected && (
                          <span className="inline-flex shrink-0 items-center" title="Selected recipient">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            <span className="sr-only">Selected recipient</span>
                          </span>
                        )}
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
                        <span aria-label={`Access: ${accessSummary}`} className="inline-flex shrink-0 items-center gap-1 opacity-70" role="img">
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
                    </span>}
                  </button>

                  {!collapsed && <button
                    type="button"
                    aria-label={`Edit ${agent.name}`}
                    onClick={() => onEditAgent(agent)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-transparent bg-slate-950/90 text-slate-500 opacity-0 shadow-sm transition-all hover:border-slate-700 hover:text-slate-200 focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                    title={`Edit ${agent.name}`}
                  >
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {!collapsed && <details className="group shrink-0 border-t border-slate-800/85 bg-white/50">
        <summary className="flex min-h-11 items-center gap-2 px-4 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200">
          <span>Permission key</span>
          <span aria-hidden="true" className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          </span>
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-500 transition-transform group-open:rotate-90" strokeWidth={1.8} />
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
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> None
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-400">Dot order: contacts, deals, activity, tasks, sales reps.</p>
        </div>
      </details>}
    </aside>
  );
}
