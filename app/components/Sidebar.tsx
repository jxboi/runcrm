"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, ChevronDown, Ellipsis, Home, MessageSquare, Pencil, Pin, Plus } from "lucide-react";
import { Agent, ChatThread, Recipient, ThreadFilter, ThreadUpdate } from "@/lib/types";
import { AgentIcon } from "@/app/components/AgentIcon";

const INITIAL_THREAD_COUNT = 5;
const THREAD_COUNT_INCREMENT = 10;
const THREAD_HOVER_CARD_WIDTH = 320;
const THREAD_HOVER_CARD_HEIGHT = 220;

type ThreadHover = { threadId: number; x: number; y: number };

function parseThreadDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(normalized);
}

function formatThreadActivity(value: string | null) {
  if (!value) return "No conversations yet";
  const date = parseThreadDate(value);
  if (Number.isNaN(date.getTime())) return value;

  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function formatThreadAge(value: string | null) {
  return formatThreadActivity(value).replace(/ ago$/, "");
}

function ThreadHoverCard({ thread, x, y }: { thread: ChatThread; x: number; y: number }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[90] w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-700/80 bg-white/95 p-4 text-slate-200 shadow-[0_18px_44px_rgba(17,18,22,0.18)] backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold text-slate-200">{thread.title}</p>
        <span className="shrink-0 text-[11px] font-medium text-slate-500">
          {formatThreadAge(thread.last_message_at)}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Last conversation</p>
          <p className="mt-1 text-[12px] font-medium text-slate-300">{formatThreadActivity(thread.last_message_at)}</p>
          <p className="mt-1 max-h-10 overflow-hidden text-[12px] leading-5 text-slate-400">
            {thread.last_message ?? "No messages yet"}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Agents in conversation</p>
          {thread.agent_names.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {thread.agent_names.map((name) => (
                <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300">
                  <AgentIcon icon={null} name={name} className="h-3 w-3 shrink-0" />
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-slate-400">No agents yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadIcon({ kind, className = "h-4 w-4" }: { kind: "home" | "account" | "chat"; className?: string }) {
  const Icon = kind === "home" ? Home : kind === "account" ? Building2 : MessageSquare;
  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} />;
}

export function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.7" />
      {collapsed ? (
        <path d="M9 7v10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      ) : (
        <path d="M9 3.75v16.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      )}
    </svg>
  );
}

function SectionAction({
  disabled,
  onClick,
  title,
  collapsed = false,
}: {
  disabled?: boolean;
  onClick: () => void;
  title: string;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-busy={disabled || undefined}
      className={`inline-flex shrink-0 items-center justify-center border border-transparent bg-transparent text-slate-400 transition-colors disabled:cursor-wait disabled:opacity-50 ${collapsed ? "h-10 w-10 rounded-xl p-0 hover:bg-slate-100 hover:text-slate-900" : "h-7 w-7 rounded-lg p-0 hover:bg-slate-900 hover:text-indigo-300"}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
    </button>
  );
}

export default function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onUpdateThread,
  onContinueThread,
  threadFilter,
  onThreadFilterChange,
  agents,
  selectedAgentId,
  busyAgentIds,
  onSelect,
  onNewAgent,
  onEditAgent,
  collapsed,
  onCollapsedChange,
}: {
  threads: ChatThread[];
  activeThreadId: number;
  onSelectThread: (id: number) => void;
  onCreateThread: () => Promise<void>;
  onUpdateThread: (id: number, update: ThreadUpdate) => Promise<void>;
  onContinueThread: (id: number) => Promise<void>;
  threadFilter: ThreadFilter;
  onThreadFilterChange: (filter: ThreadFilter) => void;
  agents: Agent[];
  selectedAgentId: number | null;
  busyAgentIds: number[];
  onSelect: (id: Recipient) => void;
  onNewAgent: () => void;
  onEditAgent: (agent: Agent) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const [savingThread, setSavingThread] = useState(false);
  const [updatingThreadId, setUpdatingThreadId] = useState<number | null>(null);
  const [conversationsOpen, setConversationsOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleThreadCount, setVisibleThreadCount] = useState(INITIAL_THREAD_COUNT);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [continuingThreadId, setContinuingThreadId] = useState<number | null>(null);
  const [threadMenu, setThreadMenu] = useState<{ threadId: number; x: number; y: number } | null>(null);
  const [threadHover, setThreadHover] = useState<ThreadHover | null>(null);
  const threadMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threadMenu) return;
    const frame = window.requestAnimationFrame(() => {
      threadMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    });
    const dismiss = (event: PointerEvent) => {
      if (!threadMenuRef.current?.contains(event.target as Node)) setThreadMenu(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThreadMenu(null);
    };
    const dismissOnViewportChange = () => setThreadMenu(null);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissOnEscape);
    window.addEventListener("resize", dismissOnViewportChange);
    window.addEventListener("scroll", dismissOnViewportChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissOnEscape);
      window.removeEventListener("resize", dismissOnViewportChange);
      window.removeEventListener("scroll", dismissOnViewportChange, true);
    };
  }, [threadMenu]);

  useEffect(() => {
    if (!filterOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!filterMenuRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [filterOpen]);

  const submitThread = async () => {
    if (savingThread) return;
    setSavingThread(true);
    try {
      await onCreateThread();
    } finally {
      setSavingThread(false);
    }
  };

  const updateThread = async (id: number, update: ThreadUpdate) => {
    if (updatingThreadId !== null) return;
    setUpdatingThreadId(id);
    try {
      await onUpdateThread(id, update);
    } finally {
      setUpdatingThreadId(null);
    }
  };

  const continueThread = async (id: number) => {
    if (continuingThreadId !== null) return;
    setContinuingThreadId(id);
    try {
      await onContinueThread(id);
    } finally {
      setContinuingThreadId(null);
    }
  };

  const openThreadMenu = (event: React.MouseEvent, thread: ChatThread) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 224;
    const menuHeight = 224;
    setThreadMenu({
      threadId: thread.id,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const showThreadHover = (thread: ChatThread, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const gap = 12;
    const maxLeft = window.innerWidth - THREAD_HOVER_CARD_WIDTH - gap;
    const rightPosition = rect.right + gap;
    const left = rightPosition <= maxLeft ? rightPosition : Math.max(gap, rect.left - THREAD_HOVER_CARD_WIDTH - gap);
    const top = Math.max(gap, Math.min(rect.top, window.innerHeight - THREAD_HOVER_CARD_HEIGHT - gap));
    setThreadHover({ threadId: thread.id, x: left, y: top });
  };

  const handleThreadMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!threadMenuRef.current || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...threadMenuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const confirmArchive = (thread: ChatThread) => {
    if (!window.confirm(`Archive “${thread.title}”? It will be removed from your conversation list.`)) return;
    void updateThread(thread.id, { archived: true });
  };

  const renameThread = (thread: ChatThread) => {
    setThreadMenu(null);
    const title = window.prompt("Rename conversation", thread.title);
    if (title === null || title.trim() === thread.title) return;
    void updateThread(thread.id, { title });
  };

  const selectThreadFilter = (filter: ThreadFilter) => {
    setFilterOpen(false);
    setVisibleThreadCount(INITIAL_THREAD_COUNT);
    onThreadFilterChange(filter);
  };

  const menuThread = threadMenu ? threads.find((thread) => thread.id === threadMenu.threadId) : null;
  const hoveredThread = threadHover ? threads.find((thread) => thread.id === threadHover.threadId) : null;
  const menuItemClass = "flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] font-medium text-slate-200 transition-colors hover:bg-slate-800 focus:bg-slate-800 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-500";

  return (
    <aside
      aria-label="Workspace sidebar"
      data-collapsed={collapsed || undefined}
      className={`crm-sidebar flex shrink-0 flex-col overflow-x-hidden bg-slate-950 transition-[width] duration-200 motion-reduce:transition-none ${collapsed ? "w-20" : "w-[clamp(12.5rem,18vw,16rem)]"}`}
    >
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? "justify-center px-3" : "gap-3 px-4"}`}>
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
          onClick={() => onCollapsedChange(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`crm-sidebar-toggle flex shrink-0 items-center justify-center text-slate-500 transition-colors hover:text-slate-400 ${collapsed ? "h-11 w-11 rounded-xl bg-white" : "ml-auto h-8 w-8 rounded-lg bg-transparent"}`}
        >
          <SidebarToggleIcon collapsed={collapsed} />
        </button>
      </div>

      <div className="crm-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5">
        <section aria-labelledby="sidebar-conversations-heading">
          <div className={`group/recent-header flex items-center ${collapsed ? "justify-center pb-3" : "justify-between gap-3 px-1 pb-2 pt-2"}`}>
            {collapsed ? (
              <h2 id="sidebar-conversations-heading" className="sr-only">Recents</h2>
            ) : (
              <button
                type="button"
                aria-expanded={conversationsOpen}
                aria-controls="sidebar-conversations-list"
                onClick={() => setConversationsOpen((open) => !open)}
                className="group flex min-w-0 items-center gap-1.5 text-left text-[11px] font-semibold tracking-[0.12em] text-slate-400 transition-colors hover:text-slate-200"
              >
                <span id="sidebar-conversations-heading">Recents</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${conversationsOpen ? "rotate-0" : "-rotate-90"}`}
                  strokeWidth={2}
                />
              </button>
            )}
            <div className="flex items-center gap-0.5">
              {!collapsed && (
                <div ref={filterMenuRef} className="relative">
                  <button
                    type="button"
                    aria-label="Filter recent conversations"
                    aria-expanded={filterOpen}
                    aria-haspopup="menu"
                    onClick={() => setFilterOpen((open) => !open)}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-slate-400 opacity-0 transition-all duration-150 group-focus-within/recent-header:opacity-100 group-hover/recent-header:opacity-100 hover:border-slate-700 hover:bg-slate-900 hover:text-indigo-300 focus-visible:opacity-100 ${filterOpen ? "opacity-100 text-indigo-400" : ""}`}
                    title="Filter recent conversations"
                  >
                    <Ellipsis aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                  {filterOpen && (
                    <div role="menu" aria-label="Conversation filters" className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-xl">
                      {(["all", "active", "archived"] as const).map((filter) => (
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={threadFilter === filter}
                          key={filter}
                          onClick={() => selectThreadFilter(filter)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors ${threadFilter === filter ? "bg-indigo-500/10 font-semibold text-indigo-300" : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"}`}
                        >
                          <span>{filter[0].toUpperCase() + filter.slice(1)}</span>
                          {threadFilter === filter && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <SectionAction
                collapsed={collapsed}
                disabled={savingThread}
                onClick={() => void submitThread()}
                title="Start a new conversation"
              />
            </div>
          </div>

          <div
            id="sidebar-conversations-list"
            aria-hidden={!conversationsOpen && !collapsed}
            inert={!conversationsOpen && !collapsed}
            data-open={conversationsOpen || collapsed}
            className="crm-sidebar-section-transition"
          >
            <nav aria-label="Recents" className="space-y-1">
              {threads.slice(0, visibleThreadCount).map((thread) => {
                const selected = thread.id === activeThreadId;
                const kind = thread.account_name ? "account" : thread.id === 1 ? "home" : "chat";
                const updating = updatingThreadId === thread.id;

                return (
                  <div
                    className="group relative"
                    key={thread.id}
                    onContextMenu={(event) => openThreadMenu(event, thread)}
                    onMouseEnter={(event) => showThreadHover(thread, event.currentTarget)}
                    onMouseLeave={() => setThreadHover(null)}
                    onFocus={(event) => showThreadHover(thread, event.currentTarget)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setThreadHover(null);
                    }}
                    style={{ viewTransitionName: `conversation-${thread.id}` }}
                  >
                    <button
                      type="button"
                      aria-current={selected ? "page" : undefined}
                      aria-label={`Open ${thread.title} conversation${thread.unread ? ", unread" : ""}`}
                      onClick={() => onSelectThread(thread.id)}
                      title={collapsed ? thread.title : undefined}
                      className={`relative flex w-full items-center overflow-hidden rounded-xl border text-left transition-colors ${collapsed ? "h-11 justify-center p-0" : "h-9 min-w-0 pl-3 pr-10"} ${
                        selected
                          ? "border-transparent bg-indigo-500/[0.10]"
                          : collapsed ? "border-transparent hover:bg-slate-100" : "border-transparent hover:border-slate-700/70 hover:bg-slate-800/55"
                      }`}
                    >
                      {collapsed ? (
                        <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? "text-indigo-600" : "text-slate-500"}`}>
                          <ThreadIcon kind={kind} />
                          {thread.unread && <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-slate-950" />}
                        </span>
                      ) : (
                        <span className={`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap text-[13px] text-slate-200 ${selected || thread.unread ? "font-semibold" : "font-medium"}`}>
                          <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                          {thread.unread && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
                        </span>
                      )}
                    </button>

                    {!collapsed && (
                      <span className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label={`${thread.pinned ? "Unpin" : "Pin"} ${thread.title}`}
                          aria-pressed={thread.pinned}
                          disabled={updatingThreadId !== null}
                          onClick={() => void updateThread(thread.id, { pinned: !thread.pinned })}
                          title={thread.pinned ? "Unpin conversation" : "Pin conversation"}
                          className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ease-out motion-reduce:transition-none hover:bg-slate-700/70 hover:text-slate-200 disabled:cursor-wait disabled:opacity-50 ${thread.pinned ? "scale-100 text-slate-600 opacity-100" : "scale-90 text-slate-500 opacity-0 group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100"}`}
                        >
                          <Pin aria-hidden="true" className="h-3.5 w-3.5" fill={thread.pinned ? "currentColor" : "none"} strokeWidth={1.8} />
                        </button>
                      </span>
                    )}
                    {updating && <span className="sr-only" role="status">Updating {thread.title}</span>}
                  </div>
                );
              })}
              {!collapsed && visibleThreadCount < threads.length && (
                <button
                  type="button"
                  onClick={() => setVisibleThreadCount((count) => count + THREAD_COUNT_INCREMENT)}
                  className="flex h-8 w-full items-center rounded-lg px-3 text-left text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-800/55 hover:text-slate-200"
                >
                  Show more
                </button>
              )}
            </nav>
          </div>
        </section>

        <div aria-hidden="true" className={`${collapsed ? "mx-2 my-5 bg-slate-200" : "mx-1 my-4 bg-slate-800/85"} h-px`} />

        <section aria-labelledby="sidebar-agents-heading">
          <div className={`flex items-center ${collapsed ? "justify-center pb-3" : "justify-between gap-3 px-1 pb-1"}`}>
            {collapsed ? (
              <h2 id="sidebar-agents-heading" className="sr-only">Agents</h2>
            ) : (
              <button
                type="button"
                aria-expanded={agentsOpen}
                aria-controls="sidebar-agents-list"
                onClick={() => setAgentsOpen((open) => !open)}
                className="group flex min-w-0 items-center gap-1.5 text-left text-[11px] font-semibold tracking-[0.12em] text-slate-400 transition-colors hover:text-slate-200"
              >
                <span id="sidebar-agents-heading">Agents</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${agentsOpen ? "rotate-0" : "-rotate-90"}`}
                  strokeWidth={2}
                />
              </button>
            )}
            <SectionAction collapsed={collapsed} onClick={onNewAgent} title="Create a new agent" />
          </div>

          <div
            id="sidebar-agents-list"
            aria-hidden={!agentsOpen && !collapsed}
            inert={!agentsOpen && !collapsed}
            data-open={agentsOpen || collapsed}
            className="crm-sidebar-section-transition"
          >
            <div className="space-y-0.5" role="list">
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

              return (
                <div className="group relative" key={agent.id} role="listitem">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(agent.id)}
                    title={collapsed ? agent.name : undefined}
                    className={`relative flex w-full items-center overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/45 ${collapsed ? "h-11 justify-center p-0" : "gap-2 py-1.5 pl-2.5 pr-10"} ${
                      selected
                        ? collapsed ? "border-indigo-200/80 bg-indigo-500/[0.10]" : "border-transparent bg-transparent"
                        : collapsed ? "border-transparent hover:bg-slate-100" : "border-transparent hover:border-slate-700/70 hover:bg-slate-800/55"
                    }`}
                  >
                    <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${selected ? collapsed ? "bg-transparent text-indigo-600" : "bg-indigo-950 text-indigo-300" : collapsed ? "bg-transparent text-slate-500" : "bg-slate-800/80"}`}>
                      <AgentIcon icon={agent.emoji} name={agent.name} className="h-4 w-4" />
                      {collapsed && busy && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-indigo-400 ring-2 ring-slate-950" />}
                    </span>
                    {!collapsed && <span className="relative min-w-0 flex-1 self-stretch">
                      <span className="flex h-full min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-slate-200">{agent.name}</span>
                        {busy && (
                          <span className="inline-flex shrink-0 items-center" title="Working">
                            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                            <span className="sr-only">Working</span>
                          </span>
                        )}
                      </span>
                    </span>}
                  </button>

                  {!collapsed && <button
                    type="button"
                    aria-label={`Edit ${agent.name}`}
                    onClick={() => onEditAgent(agent)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-transparent bg-transparent text-slate-500 opacity-0 transition-all hover:text-slate-200 focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                    title={`Edit ${agent.name}`}
                  >
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>}
                </div>
              );
            })}
            </div>
          </div>
        </section>
      </div>

      {threadMenu && menuThread && createPortal(
        <div
          ref={threadMenuRef}
          role="menu"
          aria-label={`${menuThread.title} chat actions`}
          onKeyDown={handleThreadMenuKeyDown}
          className="fixed z-[100] w-56 rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-[0_14px_36px_rgba(17,18,22,0.18)]"
          style={{ left: threadMenu.x, top: threadMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            disabled={updatingThreadId !== null}
            onClick={() => {
              setThreadMenu(null);
              void updateThread(menuThread.id, { pinned: !menuThread.pinned });
            }}
            className={menuItemClass}
          >
            {menuThread.pinned ? "Unpin chat" : "Pin chat"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={updatingThreadId !== null}
            onClick={() => renameThread(menuThread)}
            className={menuItemClass}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={updatingThreadId !== null}
            onClick={() => {
              setThreadMenu(null);
              void updateThread(menuThread.id, { read: menuThread.unread });
            }}
            className={menuItemClass}
          >
            {menuThread.unread ? "Mark as read" : "Mark as unread"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={updatingThreadId !== null || menuThread.id === 1}
            title={menuThread.id === 1 ? "The Home chat cannot be archived" : undefined}
            onClick={() => {
              setThreadMenu(null);
              if (menuThread.archived_at) void updateThread(menuThread.id, { archived: false });
              else confirmArchive(menuThread);
            }}
            className={menuItemClass}
          >
            {menuThread.archived_at ? "Restore chat" : "Archive chat"}
          </button>
          <div aria-hidden="true" className="mx-2 my-1 h-px bg-slate-800" />
          <button
            type="button"
            role="menuitem"
            disabled={continuingThreadId !== null}
            onClick={() => {
              setThreadMenu(null);
              void continueThread(menuThread.id);
            }}
            className={menuItemClass}
          >
            Continue in new chat
          </button>
        </div>,
        document.body
      )}

      {threadHover && hoveredThread && createPortal(
        <ThreadHoverCard thread={hoveredThread} x={threadHover.x} y={threadHover.y} />,
        document.body
      )}

    </aside>
  );
}
