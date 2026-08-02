"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Agent, ChatMessage, EntityRef, LiveRun, Proposal, Recipient, RunNotice } from "@/lib/types";
import { api } from "@/lib/client";
import { parseMentions } from "@/lib/agent/mentions";
import { streamRun } from "@/lib/stream";
import Sidebar from "../components/Sidebar";
import Chat from "../components/Chat";
import DataPanel from "../components/DataPanel";
import AgentModal from "../components/AgentModal";

export default function Workspace() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recipient, setRecipient] = useState<Recipient>("auto");
  const [runs, setRuns] = useState<LiveRun[]>([]);
  const [notices, setNotices] = useState<RunNotice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [focusRef, setFocusRef] = useState<EntityRef | null>(null);
  const [modal, setModal] = useState<"closed" | "new" | Agent>("closed");
  const [toast, setToast] = useState<string | null>(null);

  // One AbortController per request; a request may run several agents in turn.
  const abortersRef = useRef(new Map<string, AbortController>());
  const runsRef = useRef<LiveRun[]>([]);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAgents = useCallback(async () => {
    const list = await api<Agent[]>("/api/agents");
    setAgents(list);
    setRecipient((cur) => (cur === "auto" || list.some((a) => a.id === cur) ? cur : "auto"));
  }, []);

  const loadMessages = useCallback(async () => {
    setMessages(await api<ChatMessage[]>("/api/messages"));
  }, []);

  const loadProposals = useCallback(async () => {
    setProposals(await api<Proposal[]>("/api/proposals"));
  }, []);

  useEffect(() => {
    loadAgents().catch((e) => showToast(e.message));
    loadMessages().catch((e) => showToast(e.message));
    loadProposals().catch((e) => showToast(e.message));
  }, [loadAgents, loadMessages, loadProposals, showToast]);

  /** Approve or reject one queued write, then reflect what it did. */
  const decideProposal = useCallback(
    async (id: number, decision: "approve" | "reject") => {
      try {
        const res = await api<{ note: ChatMessage }>(`/api/proposals/${id}`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        });
        setProposals((cur) => cur.filter((p) => p.id !== id));
        setMessages((cur) => [...cur, res.note]);
        setDataVersion((v) => v + 1);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Couldn't record that decision");
        // The proposal may have been decided elsewhere — resync either way.
        loadProposals().catch(() => {});
      }
    },
    [loadProposals, showToast]
  );

  /**
   * Drive one SSE request: agents announce themselves, their text and tool
   * steps fold into a live bubble, and finished messages join the transcript.
   * Returns false only on a real failure — a user-initiated stop counts as
   * success from the composer's point of view.
   */
  const startRun = useCallback(
    async (url: string, body: unknown, runKey: string, optimisticId?: number): Promise<boolean> => {
      const controller = new AbortController();
      abortersRef.current.set(runKey, controller);

      const patch = (agentId: number, fn: (run: LiveRun) => LiveRun) =>
        setRuns((cur) => cur.map((r) => (r.agentId === agentId ? fn(r) : r)));
      const dropRuns = () => setRuns((cur) => cur.filter((r) => r.runKey !== runKey));
      const note = (text: string) =>
        setNotices((cur) => [...cur, { id: `${runKey}#${cur.length}`, text }]);

      try {
        await streamRun(
          url,
          body,
          (event) => {
            switch (event.type) {
              case "user_message":
                setMessages((cur) => [...cur.filter((m) => m.id !== optimisticId), event.message]);
                break;
              case "routed":
                note(`→ routed to ${event.agentEmoji} ${event.agentName}`);
                break;
              case "handoff":
                note(`${event.fromName} handed off to ${event.toName}`);
                break;
              case "agent_start":
                setRuns((cur) => [
                  ...cur.filter((r) => r.agentId !== event.agentId),
                  {
                    runKey,
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
                if (event.ok && event.isWrite) setDataVersion((v) => v + 1);
                break;
              case "message":
                // Swap the live bubble for the persisted one in the same commit.
                setRuns((cur) => cur.filter((r) => r.agentId !== event.message.agent_id));
                // The row is written before its mutations are linked to it, so
                // the count rides along on the event rather than the message.
                setMessages((cur) => [
                  ...cur,
                  { ...event.message, undoable: event.undoable ?? event.message.undoable ?? 0 },
                ]);
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
      }
    },
    [showToast]
  );

  /**
   * Stop a run and keep what it produced. The server skips persisting once the
   * body is cancelled, so the client saves the partial — exactly one writer.
   */
  const stopRun = useCallback(
    async (agentId: number) => {
      const run = runsRef.current.find((r) => r.agentId === agentId);
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
            agent_id: agentId,
            content: text ? `${text}\n\n(Stopped by you.)` : "(Stopped by you before I finished.)",
            trace: run.steps
              .filter((s) => s.ok !== undefined)
              .map((s) => ({ tool: s.tool, input: s.input, result: s.result ?? "", ok: !!s.ok, ms: s.ms })),
            is_error: false,
          }),
        });
        setMessages((cur) => [...cur, saved]);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Couldn't save the stopped reply");
      }
      setDataVersion((v) => v + 1);
    },
    [showToast]
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
          return [...updated, res.note];
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
        role: "user",
        agent_id: null,
        content,
        trace: [],
        is_error: false,
        created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      };
      setMessages((cur) => [...cur, optimistic]);

      const ok = await startRun(
        "/api/chat/stream",
        { content, agentId: recipient },
        `chat-${optimistic.id}`,
        optimistic.id
      );
      if (!ok) setMessages((cur) => cur.filter((m) => m.id !== optimistic.id));
      return ok;
    },
    [agents, recipient, showToast, startRun]
  );

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
      await startRun(`/api/tasks/${taskId}/run`, undefined, `task-${taskId}`);
      setDataVersion((v) => v + 1);
    },
    [agents, showToast, startRun]
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        agents={agents}
        selectedAgentId={recipient === "auto" ? null : recipient}
        busyAgentIds={busyAgentIds}
        onSelect={setRecipient}
        onNewAgent={() => setModal("new")}
        onEditAgent={(a) => setModal(a)}
      />
      <main className="flex min-w-0 flex-1 flex-col border-x border-slate-800/70 bg-slate-950">
        <Chat
          agents={agents}
          messages={messages}
          recipient={recipient}
          onSelectRecipient={setRecipient}
          runs={runs}
          notices={notices}
          onSend={sendMessage}
          onStop={stopRun}
          onUndo={undoMessage}
          onFocusRecord={setFocusRef}
          proposals={proposals}
          onDecideProposal={decideProposal}
        />
      </main>
      <DataPanel
        agents={agents}
        version={dataVersion}
        busyAgentIds={busyAgentIds}
        focusRef={focusRef}
        onRunTask={runTask}
        onError={showToast}
      />

      {modal !== "closed" && (
        <AgentModal
          agent={modal === "new" ? null : modal}
          onClose={() => setModal("closed")}
          onSave={saveAgent}
          onDelete={removeAgent}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-rose-500/40 bg-rose-950/90 px-4 py-2 text-sm text-rose-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
