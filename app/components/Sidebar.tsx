"use client";

import { useState } from "react";
import { Agent, ChatThread, ENTITIES, Recipient } from "@/lib/types";
import { fmtTime } from "@/lib/client";

const ACCESS_DOT: Record<string, string> = {
  none: "bg-slate-700",
  read: "bg-sky-500",
  write: "bg-emerald-500",
};

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
    <aside className="crm-sidebar flex w-64 shrink-0 flex-col bg-slate-950">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <div className="crm-mark flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-950">
          R
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-slate-100">RunCRM</div>
          <div className="text-[11px] text-slate-500">chat-first CRM · v0.1</div>
        </div>
      </div>

      <div className="px-3 pb-4">
        <button
          onClick={onOpenWorkflowStudio}
          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
            workspaceMode === "workflows"
              ? "border-indigo-500/45 bg-indigo-500/10 shadow-sm"
              : "border-slate-800 bg-white/55 hover:border-indigo-500/35 hover:bg-indigo-500/5"
          }`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/25 bg-indigo-500/10 text-sm text-indigo-400">⌁</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-200">Workflow Studio</span>
            <span className="mt-0.5 block text-[9px] text-slate-500">Build automations with AI</span>
          </span>
          <span className="text-xs text-slate-600">›</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Conversations</span>
        <button
          onClick={() => void submitThread()}
          disabled={savingThread}
          className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:border-indigo-500 hover:text-indigo-300"
          title="Start a new conversation"
        >
          {savingThread ? "Starting…" : "+ New"}
        </button>
      </div>

      <div className="max-h-[38%] space-y-1 overflow-y-auto px-3 pb-4">
        {threads.map((thread) => {
          const selected = thread.id === activeThreadId;
          return (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              aria-label={`Open ${thread.title} conversation`}
              className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                selected
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-transparent hover:border-slate-800 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{thread.account_name ? "🏢" : thread.id === 1 ? "⌂" : "💬"}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-300">{thread.title}</span>
                {thread.last_message_at && (
                  <span className="shrink-0 text-[9px] text-slate-600">{fmtTime(thread.last_message_at)}</span>
                )}
              </div>
              <div aria-hidden className="mt-0.5 truncate pl-6 text-[10px] text-slate-600">
                {thread.last_message ?? (thread.id === 1 ? "Workspace-wide conversation" : "No messages yet")}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/70 px-5 pb-2 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Agents</span>
        <button
          onClick={onNewAgent}
          className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:border-indigo-500 hover:text-indigo-300"
        >
          + New
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {agents.length === 0 && (
          <div className="mx-2 mt-2 rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
            No agents yet.
            <br />
            Create one to start chatting.
          </div>
        )}
        {agents.map((agent) => {
          const selected = agent.id === selectedAgentId;
          return (
            <div
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={`group cursor-pointer rounded-lg border px-3 py-2.5 transition ${
                selected
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-transparent hover:border-slate-800 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-base">
                  {agent.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-slate-200">{agent.name}</span>
                    {busyAgentIds.includes(agent.id) && (
                      <span
                        title="Working"
                        className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-indigo-400"
                      />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {agent.kind === "workflow" && (
                      <span className="rounded-full bg-indigo-500/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-indigo-400">builder</span>
                    )}
                    {ENTITIES.map((e) => (
                      <span
                        key={e}
                        title={`${e}: ${agent.capabilities[e]}`}
                        className={`h-1.5 w-1.5 rounded-full ${ACCESS_DOT[agent.capabilities[e]]}`}
                      />
                    ))}
                    <span className={`${agent.kind === "workflow" ? "" : "ml-1"} truncate text-[10px] text-slate-500`}>
                      {agent.model.replace("claude-", "")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEditAgent(agent);
                  }}
                  className="hidden rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-slate-200 group-hover:block"
                  title="Edit agent"
                >
                  ✎
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-800/70 px-5 py-3">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> write
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> read
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-700" /> none
          </span>
        </div>
        <div className="mt-1 text-[10px] text-slate-600">contacts · deals · activity · tasks</div>
      </div>
    </aside>
  );
}
