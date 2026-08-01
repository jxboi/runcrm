"use client";

import { useCallback, useEffect, useState } from "react";
import { Agent, ChatMessage } from "@/lib/types";
import { api } from "@/lib/client";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import DataPanel from "./components/DataPanel";
import AgentModal from "./components/AgentModal";

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [busyAgentId, setBusyAgentId] = useState<number | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [modal, setModal] = useState<"closed" | "new" | Agent>("closed");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAgents = useCallback(async () => {
    const list = await api<Agent[]>("/api/agents");
    setAgents(list);
    setSelectedAgentId((cur) => (cur != null && list.some((a) => a.id === cur) ? cur : (list[0]?.id ?? null)));
  }, []);

  const loadMessages = useCallback(async () => {
    setMessages(await api<ChatMessage[]>("/api/messages"));
  }, []);

  useEffect(() => {
    loadAgents().catch((e) => showToast(e.message));
    loadMessages().catch((e) => showToast(e.message));
  }, [loadAgents, loadMessages, showToast]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (selectedAgentId == null) {
        showToast("Create or select an agent first");
        return;
      }
      const agent = agents.find((a) => a.id === selectedAgentId);
      setBusyAgentId(selectedAgentId);
      // Optimistic echo of the user message while the agent works.
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
      try {
        const res = await api<{ userMessage: ChatMessage; agentMessage: ChatMessage }>("/api/chat", {
          method: "POST",
          body: JSON.stringify({ content, agentId: selectedAgentId }),
        });
        setMessages((cur) => [...cur.filter((m) => m.id !== optimistic.id), res.userMessage, res.agentMessage]);
        setDataVersion((v) => v + 1);
      } catch (e) {
        setMessages((cur) => cur.filter((m) => m.id !== optimistic.id));
        showToast(e instanceof Error ? e.message : `Failed to reach ${agent?.name ?? "agent"}`);
      } finally {
        setBusyAgentId(null);
      }
    },
    [agents, selectedAgentId, showToast]
  );

  const runTask = useCallback(
    async (taskId: number, assigneeId: number | null) => {
      setBusyAgentId(assigneeId);
      try {
        const res = await api<{ userMessage: ChatMessage; agentMessage: ChatMessage }>(
          `/api/tasks/${taskId}/run`,
          { method: "POST" }
        );
        setMessages((cur) => [...cur, res.userMessage, res.agentMessage]);
        setDataVersion((v) => v + 1);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Task run failed");
        setDataVersion((v) => v + 1);
      } finally {
        setBusyAgentId(null);
      }
    },
    [showToast]
  );

  const saveAgent = useCallback(
    async (input: Partial<Agent>, id?: number) => {
      if (id != null) {
        await api<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(input) });
      } else {
        const created = await api<Agent>("/api/agents", { method: "POST", body: JSON.stringify(input) });
        setSelectedAgentId(created.id);
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

  const busyAgent = agents.find((a) => a.id === busyAgentId) ?? null;

  return (
    <div className="flex h-full">
      <Sidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelect={setSelectedAgentId}
        onNewAgent={() => setModal("new")}
        onEditAgent={(a) => setModal(a)}
      />
      <main className="flex min-w-0 flex-1 flex-col border-x border-slate-800/70 bg-slate-950">
        <Chat
          agents={agents}
          messages={messages}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          busyAgent={busyAgent}
          onSend={sendMessage}
        />
      </main>
      <DataPanel agents={agents} version={dataVersion} busy={busyAgentId != null} onRunTask={runTask} onError={showToast} />

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
