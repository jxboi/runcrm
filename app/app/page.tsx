"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Agent, ChatMessage, ChatThread, EntityRef, LiveRun, Proposal, Recipient, RunNotice } from "@/lib/types";
import { api } from "@/lib/client";
import { parseMentions } from "@/lib/agent/mentions";
import { streamRun } from "@/lib/stream";
import Sidebar from "../components/Sidebar";
import Chat from "../components/Chat";
import DataPanel from "../components/DataPanel";
import AgentModal from "../components/AgentModal";
import WorkflowStudio from "../components/WorkflowStudio";

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const rows = new Map<number, ChatMessage>();
  for (const message of current) rows.set(message.id, message);
  for (const message of incoming) rows.set(message.id, message);
  return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
}

export default function Workspace() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recipient, setRecipient] = useState<Recipient>("auto");
  const [runs, setRuns] = useState<LiveRun[]>([]);
  const [notices, setNotices] = useState<RunNotice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [focusRef, setFocusRef] = useState<EntityRef | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | Agent>("closed");
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"crm" | "workflows">("crm");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [draftSuggestion, setDraftSuggestion] = useState<{ id: number; text: string } | null>(null);

  // One AbortController per request; a request may run several agents in turn.
  const abortersRef = useRef(new Map<string, AbortController>());
  const runsRef = useRef<LiveRun[]>([]);
  const activeThreadRef = useRef(1);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  useEffect(() => {
    activeThreadRef.current = activeThreadId;
  }, [activeThreadId]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAgents = useCallback(async () => {
    const list = await api<Agent[]>("/api/agents");
    setAgents(list);
    setRecipient((cur) => (cur === "auto" || list.some((a) => a.id === cur) ? cur : "auto"));
  }, []);

  const loadThreads = useCallback(async () => {
    setThreads(await api<ChatThread[]>("/api/threads"));
  }, []);

  const loadMessages = useCallback(async (threadId = activeThreadRef.current) => {
    const rows = await api<ChatMessage[]>(`/api/messages?threadId=${threadId}`);
    if (activeThreadRef.current === threadId) setMessages(rows);
  }, []);

  const loadProposals = useCallback(async () => {
    setProposals(await api<Proposal[]>("/api/proposals"));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAgents().catch((e) => showToast(e.message));
      loadThreads().catch((e) => showToast(e.message));
      loadMessages(1).catch((e) => showToast(e.message));
      loadProposals().catch((e) => showToast(e.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAgents, loadMessages, loadProposals, loadThreads, showToast]);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      if (runsRef.current.length === 0) loadMessages().catch(() => {});
      loadThreads().catch(() => {});
      loadProposals().catch(() => {});
      setDataVersion((value) => value + 1);
    };
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadMessages, loadProposals, loadThreads]);

  const selectThread = useCallback((threadId: number) => {
    setWorkspaceMode("crm");
    if (threadId === activeThreadRef.current) return;
    activeThreadRef.current = threadId;
    setActiveThreadId(threadId);
    setMessages([]);
    loadMessages(threadId).catch((e) => showToast(e instanceof Error ? e.message : "Couldn't open that thread"));
  }, [loadMessages, showToast]);

  const openThread = useCallback(async (accountName?: string) => {
    try {
      const thread = await api<ChatThread>("/api/threads", {
        method: "POST",
        body: JSON.stringify(accountName ? { accountName } : {}),
      });
      await loadThreads();
      selectThread(thread.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Couldn't start that conversation");
    }
  }, [loadThreads, selectThread, showToast]);

  const createThread = useCallback(() => openThread(), [openThread]);

  /** Approve or reject one queued write, then reflect what it did. */
  const decideProposal = useCallback(
    async (id: number, decision: "approve" | "reject") => {
      try {
        const res = await api<{ note: ChatMessage }>(`/api/proposals/${id}`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        });
        setProposals((cur) => cur.filter((p) => p.id !== id));
        if (res.note.thread_id === activeThreadRef.current) {
          setMessages((cur) => mergeMessages(cur, [res.note]));
        }
        loadThreads().catch(() => {});
        setDataVersion((v) => v + 1);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Couldn't record that decision");
        // The proposal may have been decided elsewhere — resync either way.
        loadProposals().catch(() => {});
      }
    },
    [loadProposals, loadThreads, showToast]
  );

  /**
   * Drive one SSE request: agents announce themselves, their text and tool
   * steps fold into a live bubble, and finished messages join the transcript.
   * Returns false only on a real failure — a user-initiated stop counts as
   * success from the composer's point of view.
   */
  const startRun = useCallback(
    async (url: string, body: unknown, runKey: string, threadId: number, optimisticId?: number): Promise<boolean> => {
      const controller = new AbortController();
      abortersRef.current.set(runKey, controller);

      const patch = (agentId: number, fn: (run: LiveRun) => LiveRun) =>
        setRuns((cur) => cur.map((r) => (r.runKey === runKey && r.agentId === agentId ? fn(r) : r)));
      const dropRuns = () => setRuns((cur) => cur.filter((r) => r.runKey !== runKey));
      const note = (text: string) =>
        setNotices((cur) => [...cur, { id: `${runKey}#${cur.length}`, threadId, text }]);

      try {
        await streamRun(
          url,
          body,
          (event) => {
            switch (event.type) {
              case "user_message":
                if (activeThreadRef.current === event.message.thread_id) {
                  setMessages((cur) => mergeMessages(cur.filter((m) => m.id !== optimisticId), [event.message]));
                }
                loadThreads().catch(() => {});
                break;
              case "routed":
                note(`→ routed to ${event.agentEmoji} ${event.agentName}`);
                break;
              case "handoff":
                note(`${event.fromName} handed off to ${event.toName}`);
                break;
              case "agent_start":
                setRuns((cur) => [
                  ...cur.filter((r) => r.runKey !== runKey || r.agentId !== event.agentId),
                  {
                    runKey,
                    threadId,
                    agentId: event.agentId,
                    agentName: event.agentName,
                    agentEmoji: event.agentEmoji,
                    text: "",
                    steps: [],
                  },
                ]);
                break;
              case "text":
                patch(event.agentId, (r) => ({ ...r, text: r.text + event.delta }));
                break;
              case "tool_start":
                patch(event.agentId, (r) => ({
                  ...r,
                  steps: [...r.steps, { index: event.index, tool: event.tool, input: event.input }],
                }));
                break;
              case "tool_end":
                patch(event.agentId, (r) => ({
                  ...r,
                  steps: r.steps.map((s) =>
                    s.index === event.index ? { ...s, ok: event.ok, ms: event.ms, result: event.result } : s
                  ),
                }));
                if (event.ok && event.isWrite) {
                  setDataVersion((v) => v + 1);
                  if (["create_workflow", "revise_workflow", "restore_workflow_version", "set_workflow_status"].includes(event.tool)) {
                    try {
                      const workflowId = Number((JSON.parse(event.result) as { id?: unknown }).id);
                      if (Number.isInteger(workflowId) && workflowId > 0) {
                        setSelectedWorkflowId(workflowId);
                        setWorkspaceMode("workflows");
                      }
                    } catch {
                      // The studio still refreshes from dataVersion if an old server returned a non-JSON trace.
                    }
                  }
                }
                break;
              case "message":
                // Swap the live bubble for the persisted one in the same commit.
                setRuns((cur) => cur.filter((r) => r.runKey !== runKey || r.agentId !== event.message.agent_id));
                // The row is written before its mutations are linked to it, so
                // the count rides along on the event rather than the message.
                if (activeThreadRef.current === event.message.thread_id) {
                  setMessages((cur) => mergeMessages(cur, [
                    { ...event.message, undoable: event.undoable ?? event.message.undoable ?? 0 },
                  ]));
                }
                if (event.proposals?.length) {
                  setProposals((cur) => [...cur, ...event.proposals!]);
                }
                break;
              case "error":
                showToast(event.message);
                break;
            }
          },
          controller.signal
        );
        return true;
      } catch (e) {
        if (controller.signal.aborted) return true; // stopRun owns the cleanup
        dropRuns();
        showToast(e instanceof Error ? e.message : "The run failed");
        return false;
      } finally {
        abortersRef.current.delete(runKey);
        dropRuns();
        setNotices((cur) => cur.filter((n) => !n.id.startsWith(`${runKey}#`)));
        loadThreads().catch(() => {});
      }
    },
    [loadThreads, showToast]
  );

  /**
   * Stop a run and keep what it produced. The server skips persisting once the
   * body is cancelled, so the client saves the partial — exactly one writer.
   */
  const stopRun = useCallback(
    async (runKey: string, agentId: number) => {
      const run = runsRef.current.find((r) => r.runKey === runKey && r.agentId === agentId);
      if (!run) return;
      abortersRef.current.get(run.runKey)?.abort();
      abortersRef.current.delete(run.runKey);
      setRuns((cur) => cur.filter((r) => r.runKey !== run.runKey));

      const text = run.text.trim();
      try {
        const saved = await api<ChatMessage>("/api/messages", {
          method: "POST",
          body: JSON.stringify({
            role: "agent",
            thread_id: run.threadId,
            agent_id: agentId,
            content: text ? `${text}\n\n(Stopped by you.)` : "(Stopped by you before I finished.)",
            trace: run.steps
              .filter((s) => s.ok !== undefined)
              .map((s) => ({ tool: s.tool, input: s.input, result: s.result ?? "", ok: !!s.ok, ms: s.ms })),
            is_error: false,
          }),
        });
        if (saved.thread_id === activeThreadRef.current) setMessages((cur) => mergeMessages(cur, [saved]));
        loadThreads().catch(() => {});
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Couldn't save the stopped reply");
      }
      setDataVersion((v) => v + 1);
    },
    [loadThreads, showToast]
  );

  /** Roll back every change one agent message made, and say what was skipped. */
  const undoMessage = useCallback(
    async (messageId: number) => {
      try {
        const res = await api<{
          undone: string[];
          skipped: string[];
          note: ChatMessage;
          message: ChatMessage | null;
        }>("/api/mutations/undo", { method: "POST", body: JSON.stringify({ messageId }) });

        setMessages((cur) => {
          const updated = res.message
            ? cur.map((m) => (m.id === messageId ? res.message! : m))
            : cur;
          return mergeMessages(updated, [res.note]);
        });
        if (res.skipped.length > 0) showToast(`Left alone: ${res.skipped.join("; ")}`);
        setDataVersion((v) => v + 1);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Undo failed");
      }
    },
    [showToast]
  );

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (agents.length === 0) {
        showToast("Create an agent first");
        return false;
      }

      // With an explicit recipient and no @mention we know who will answer, so
      // we can stop a second turn interleaving with their current one.
      const mentioned = parseMentions(content, agents);
      if (mentioned.length === 0 && recipient !== "auto") {
        const busy = runsRef.current.find((r) => r.agentId === recipient);
        if (busy) {
          showToast(`${busy.agentName} is still working — stop that run or message someone else`);
          return false;
        }
      }

      // Optimistic echo of the user message until the server hands back the real row.
      const optimistic: ChatMessage = {
        id: -Date.now(),
        thread_id: activeThreadRef.current,
        role: "user",
        agent_id: null,
        content,
        trace: [],
        is_error: false,
        created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      };
      setMessages((cur) => [...cur, optimistic]);

      const threadId = activeThreadRef.current;

      const ok = await startRun(
        "/api/chat/stream",
        {
          content,
          agentId: recipient,
          threadId,
          context: workspaceMode === "workflows" ? { workflowId: selectedWorkflowId } : undefined,
        },
        `chat-${optimistic.id}`,
        threadId,
        optimistic.id
      );
      if (!ok) setMessages((cur) => cur.filter((m) => m.id !== optimistic.id));
      return ok;
    },
    [agents, recipient, selectedWorkflowId, showToast, startRun, workspaceMode]
  );

  const openWorkflowStudio = useCallback(() => {
    setWorkspaceMode("workflows");
    const architect = agents.find((agent) => agent.kind === "workflow");
    if (architect) setRecipient(architect.id);
  }, [agents]);

  const draftWorkflowPrompt = useCallback((text: string) => {
    const architect = agents.find((agent) => agent.kind === "workflow");
    if (architect) setRecipient(architect.id);
    setDraftSuggestion({ id: Date.now(), text });
  }, [agents]);

  const runTask = useCallback(
    async (taskId: number, assigneeId: number | null) => {
      const agent = agents.find((a) => a.id === assigneeId);
      if (!agent) {
        showToast("Assign this task to an agent before running it");
        return;
      }
      if (runsRef.current.some((r) => r.agentId === agent.id)) {
        showToast(`${agent.name} is already working on something`);
        return;
      }
      const threadId = activeThreadRef.current;
      await startRun(`/api/tasks/${taskId}/run`, { threadId }, `task-${taskId}`, threadId);
      setDataVersion((v) => v + 1);
    },
    [agents, showToast, startRun]
  );

  const runRoutine = useCallback(
    async (routineId: number, retryRunId?: number) => {
      const url = retryRunId == null ? `/api/routines/${routineId}/run` : `/api/routine-runs/${retryRunId}/retry`;
      const threadId = activeThreadRef.current;
      await startRun(url, { threadId }, `routine-${routineId}-${Date.now()}`, threadId);
      setDataVersion((value) => value + 1);
    },
    [startRun]
  );

  const saveAgent = useCallback(
    async (input: Partial<Agent>, id?: number) => {
      if (id != null) {
        await api<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(input) });
      } else {
        const created = await api<Agent>("/api/agents", { method: "POST", body: JSON.stringify(input) });
        setRecipient(created.id);
      }
      await loadAgents();
      setModal("closed");
    },
    [loadAgents]
  );

  const removeAgent = useCallback(
    async (id: number) => {
      await api(`/api/agents/${id}`, { method: "DELETE" });
      await loadAgents();
      await loadMessages();
      setModal("closed");
    },
    [loadAgents, loadMessages]
  );

  const busyAgentIds = runs.map((r) => r.agentId);
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? {
    id: 1,
    title: "Home",
    account_name: null,
    message_count: 0,
    last_message: null,
    last_message_at: null,
    created_at: "",
    updated_at: "",
  };
  const activeRuns = runs.filter((run) => run.threadId === activeThreadId);
  const activeNotices = notices.filter((notice) => notice.threadId === activeThreadId);
  const activeProposals = proposals.filter((proposal) => (proposal.thread_id ?? 1) === activeThreadId);

  return (
    <div className="crm-workspace h-dvh min-h-0">
      <div className="crm-frame flex h-full overflow-hidden">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={selectThread}
          onCreateThread={createThread}
          agents={agents}
          selectedAgentId={recipient === "auto" ? null : recipient}
          busyAgentIds={busyAgentIds}
          onSelect={setRecipient}
          onNewAgent={() => setModal("new")}
          onEditAgent={(a) => setModal(a)}
          workspaceMode={workspaceMode}
          onOpenWorkflowStudio={openWorkflowStudio}
        />
        <main className={`crm-canvas flex min-w-0 flex-col border-l border-slate-800/90 bg-slate-950 ${workspaceMode === "workflows" ? "w-[clamp(22.5rem,30vw,27.5rem)] shrink-0 border-r" : "flex-1 border-r"}`}>
          <Chat
            key={activeThread.id}
            thread={activeThread}
            agents={agents}
            messages={messages}
            recipient={recipient}
            onSelectRecipient={setRecipient}
            runs={activeRuns}
            notices={activeNotices}
            onSend={sendMessage}
            onStop={stopRun}
            onUndo={undoMessage}
            onFocusRecord={setFocusRef}
            proposals={activeProposals}
            onDecideProposal={decideProposal}
            workflowContext={workspaceMode === "workflows" ? { name: selectedWorkflowId ? `workflow #${selectedWorkflowId}` : null } : null}
            draftSuggestion={draftSuggestion}
          />
        </main>
        {workspaceMode === "workflows" ? (
          <WorkflowStudio
            version={dataVersion}
            selectedWorkflowId={selectedWorkflowId}
            architectName={agents.find((agent) => agent.kind === "workflow")?.name ?? "Workflow Architect"}
            onSelectWorkflow={setSelectedWorkflowId}
            onDraftPrompt={draftWorkflowPrompt}
            onSendPrompt={sendMessage}
            onClose={() => setWorkspaceMode("crm")}
            onError={showToast}
          />
        ) : (
          <DataPanel
            agents={agents}
            version={dataVersion}
            busyAgentIds={busyAgentIds}
            focusRef={focusRef}
            onRunTask={runTask}
            onRunRoutine={runRoutine}
            onOpenAccountThread={openThread}
            onError={showToast}
          />
        )}
      </div>

      {modal !== "closed" && (
        <AgentModal
          agent={modal === "new" ? null : modal}
          onClose={() => setModal("closed")}
          onSave={saveAgent}
          onDelete={removeAgent}
        />
      )}

      {toast && (
        <div role="alert" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-rose-500/40 bg-rose-950/90 px-4 py-2 text-sm text-rose-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
