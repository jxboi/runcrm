"use client";

import { useEffect, useRef, useState } from "react";
import { Agent, ChatMessage } from "@/lib/types";
import { fmtTime } from "@/lib/client";

export default function Chat({
  agents,
  messages,
  selectedAgentId,
  onSelectAgent,
  busyAgent,
  onSend,
}: {
  agents: Agent[];
  messages: ChatMessage[];
  selectedAgentId: number | null;
  onSelectAgent: (id: number) => void;
  busyAgent: Agent | null;
  onSend: (content: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busyAgent]);

  const send = () => {
    const content = draft.trim();
    if (!content || busyAgent) return;
    setDraft("");
    onSend(content);
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/70 px-5">
        <div>
          <h1 className="text-sm font-semibold text-slate-200">Workspace chat</h1>
          <p className="text-[11px] text-slate-500">
            Ask an agent to look things up or change CRM data — actions show up in the panel on the right.
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-sm rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
            <div className="text-2xl">💬</div>
            <div className="mt-2 text-sm font-medium text-slate-300">Start the conversation</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Try: &ldquo;Add a contact — Jane Doe at Globex, jane@globex.com&rdquo; or &ldquo;Summarize the
              pipeline&rdquo;.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {busyAgent && (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm">
              {busyAgent.emoji}
            </span>
            <div className="rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/70 px-4 py-2.5">
              <span className="text-xs text-slate-400">{busyAgent.name} is working</span>
              <span className="ml-1 inline-flex gap-0.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1 w-1 animate-bounce rounded-full bg-indigo-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-800/70 p-4">
        {agents.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-slate-500">To:</span>
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => onSelectAgent(a.id)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  a.id === selectedAgentId
                    ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                <span>{a.emoji}</span>
                {a.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-2 focus-within:border-indigo-500/60">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split("\n").length))}
            placeholder={
              agents.length === 0
                ? "Create an agent first…"
                : `Message ${agents.find((a) => a.id === selectedAgentId)?.name ?? "an agent"}…`
            }
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
            disabled={agents.length === 0}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || !!busyAgent || agents.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <div className="mt-1.5 px-1 text-[10px] text-slate-600">Enter to send · Shift+Enter for a new line</div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%]">
          <div className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
            {message.content}
          </div>
          <div className="mt-1 pr-1 text-right text-[10px] text-slate-600">{fmtTime(message.created_at)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm">
        {message.agent_emoji ?? "🤖"}
      </span>
      <div className="max-w-[78%] min-w-0">
        <div className="mb-1 flex items-baseline gap-2 pl-1">
          <span className="text-xs font-semibold text-slate-300">{message.agent_name ?? "Agent"}</span>
          <span className="text-[10px] text-slate-600">{fmtTime(message.created_at)}</span>
        </div>
        <div
          className={`whitespace-pre-wrap rounded-2xl rounded-tl-sm border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            message.is_error
              ? "border-rose-500/40 bg-rose-950/40 text-rose-200"
              : "border-slate-800 bg-slate-900/70 text-slate-200"
          }`}
        >
          {message.content}
        </div>
        {message.trace.length > 0 && (
          <details className="mt-1.5 pl-1">
            <summary className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-500 hover:text-slate-300">
              ⚙ {message.trace.length} tool call{message.trace.length > 1 ? "s" : ""}
            </summary>
            <div className="mt-1.5 space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              {message.trace.map((t, i) => (
                <div key={i} className="font-mono text-[10px] leading-relaxed">
                  <span className={t.ok ? "text-emerald-400" : "text-rose-400"}>{t.ok ? "✓" : "✗"}</span>{" "}
                  <span className="text-indigo-300">{t.tool}</span>
                  <span className="text-slate-500">({JSON.stringify(t.input).slice(1, -1).slice(0, 120)})</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
