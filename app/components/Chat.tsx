"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Agent,
  ChatMessage,
  ChatThread,
  ENTITY_SINGULAR,
  EntityRef,
  LiveRun,
  LiveStep,
  Proposal,
  Recipient,
  RunNotice,
  TraceEntry,
} from "@/lib/types";
import { MENTION_PATTERN, nameKey } from "@/lib/agent/mentions";
import { fmtTime } from "@/lib/client";

export default function Chat({
  thread,
  agents,
  messages,
  recipient,
  onSelectRecipient,
  runs,
  notices,
  onSend,
  onStop,
  onUndo,
  onFocusRecord,
  proposals,
  onDecideProposal,
}: {
  thread: ChatThread;
  agents: Agent[];
  messages: ChatMessage[];
  recipient: Recipient;
  onSelectRecipient: (recipient: Recipient) => void;
  runs: LiveRun[];
  notices: RunNotice[];
  onSend: (content: string) => Promise<boolean>;
  onStop: (runKey: string, agentId: number) => void;
  onUndo: (messageId: number) => void;
  onFocusRecord: (ref: EntityRef) => void;
  proposals: Proposal[];
  onDecideProposal: (id: number, decision: "approve" | "reject") => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const liveText = runs.map((r) => r.text.length + r.steps.length).join(",");
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, runs.length, notices.length, liveText]);

  // The "@" the caret currently sits in, if any — drives the agent picker.
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const key = nameKey(mentionQuery);
    return agents.filter((a) => nameKey(a.name).startsWith(key)).slice(0, 6);
  }, [agents, mentionQuery]);

  const syncMentionQuery = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([\p{L}\p{N} _-]*)$/u);
    // A finished name followed by a space has nothing left to complete — without
    // this the picker pops straight back open after you accept a suggestion.
    const finished =
      match !== null && /\s$/.test(match[1]) && agents.some((a) => nameKey(a.name) === nameKey(match[1]));
    setMentionQuery(match && !finished ? match[1] : null);
    setHighlighted(0);
  };

  const acceptMention = (agent: Agent) => {
    const input = inputRef.current;
    if (!input) return;
    const caret = input.selectionStart ?? draft.length;
    const before = draft.slice(0, caret).replace(/@[\p{L}\p{N} _-]*$/u, `@${agent.name} `);
    const next = before + draft.slice(caret);
    setDraft(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(before.length, before.length);
    });
  };

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    setMentionQuery(null);
    const ok = await onSend(content);
    // Never lose what the user typed: put it back if the send didn't land and
    // they haven't already started typing something else.
    if (!ok) setDraft((cur) => cur || content);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptMention(suggestions[highlighted]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const selected = recipient === "auto" ? null : agents.find((a) => a.id === recipient);
  const placeholder =
    agents.length === 0
      ? "Create an agent first…"
      : selected
        ? `Message ${selected.name}…  (@ to address someone else)`
        : "Message the team…  (@ to pick someone, or let it route)";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/70 px-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{thread.account_name ? "🏢" : thread.id === 1 ? "⌂" : "💬"}</span>
            <h1 className="text-sm font-semibold text-slate-200">{thread.title}</h1>
          </div>
          <p className="text-[11px] text-slate-500">
            {thread.account_name
              ? `Account thread · agents use ${thread.account_name} as the default context.`
              : thread.id === 1
                ? "Workspace-wide conversation for cross-account work and daily updates."
                : "A focused conversation; its title is created from your first message."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {proposals.length > 0 && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
              {proposals.length} awaiting approval
            </span>
          )}
          {runs.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              {runs.length} running
            </span>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && runs.length === 0 && (
          <div className="mx-auto mt-16 max-w-sm rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
            <div className="text-2xl">💬</div>
            <div className="mt-2 text-sm font-medium text-slate-300">
              {thread.account_name ? `Start the ${thread.account_name} conversation` : "Start the conversation"}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {thread.account_name ? (
                <>Try: &ldquo;Summarize this account and tell me the next best action.&rdquo;</>
              ) : (
                <>
                  Try: &ldquo;Add a contact — Jane Doe at Globex, jane@globex.com&rdquo; or
                  &ldquo;@Data&nbsp;Analyst what&rsquo;s stuck?&rdquo;
                </>
              )}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            agents={agents}
            proposals={proposals.filter((p) => p.message_id === m.id)}
            onUndo={() => onUndo(m.id)}
            onFocusRecord={onFocusRecord}
            onDecideProposal={onDecideProposal}
          />
        ))}

        {notices.map((n) => (
          <div key={n.id} className="text-center text-[11px] text-slate-500">
            {n.text}
          </div>
        ))}

        {runs.map((run) => (
          <LiveBubble key={`${run.runKey}:${run.agentId}`} run={run} onStop={() => onStop(run.runKey, run.agentId)} />
        ))}
      </div>

      <div className="shrink-0 border-t border-slate-800/70 p-4">
        {agents.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-slate-500">To:</span>
            <button
              onClick={() => onSelectRecipient("auto")}
              title="Let RunCRM pick the right agent for each message"
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                recipient === "auto"
                  ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              ✨ Auto
            </button>
            {agents.map((a) => {
              const busy = runs.some((r) => r.agentId === a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => onSelectRecipient(a.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    a.id === recipient
                      ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}
                >
                  <span>{a.emoji}</span>
                  {a.name}
                  {busy && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="relative">
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 z-20 mb-1.5 w-64 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
              {suggestions.map((a, i) => (
                <button
                  key={a.id}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    acceptMention(a);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                    i === highlighted ? "bg-indigo-500/15 text-indigo-100" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="text-sm">{a.emoji}</span>
                  <span className="flex-1 truncate font-medium">{a.name}</span>
                  <span className="text-[10px] text-slate-500">{a.model.replace("claude-", "")}</span>
                </button>
              ))}
              <div className="border-t border-slate-800 px-3 py-1 text-[10px] text-slate-600">
                ↑↓ to choose · Enter to insert
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-2 focus-within:border-indigo-500/60">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                syncMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
              }}
              onKeyUp={(e) => syncMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
              onBlur={() => setMentionQuery(null)}
              onKeyDown={onKeyDown}
              rows={Math.min(5, Math.max(1, draft.split("\n").length))}
              placeholder={placeholder}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
              disabled={agents.length === 0}
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || agents.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
        <div className="mt-1.5 px-1 text-[10px] text-slate-600">
          Enter to send · Shift+Enter for a new line · @name to address an agent · you can keep typing while
          one works
        </div>
      </div>
    </>
  );
}

function AgentAvatar({ emoji }: { emoji: string }) {
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm">
      {emoji}
    </span>
  );
}

/** An agent turn still in flight: streamed text, tool steps, and a Stop button. */
function LiveBubble({ run, onStop }: { run: LiveRun; onStop: () => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar emoji={run.agentEmoji} />
      <div className="max-w-[78%] min-w-0">
        <div className="mb-1 flex items-baseline gap-2 pl-1">
          <span className="text-xs font-semibold text-slate-300">{run.agentName}</span>
          <span className="text-[10px] text-slate-600">working…</span>
          <button
            onClick={onStop}
            className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
          >
            ■ Stop
          </button>
        </div>

        {run.steps.length > 0 && (
          <div className="mb-1.5 space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
            {run.steps.map((step) => (
              <LiveStepRow key={step.index} step={step} />
            ))}
          </div>
        )}

        <div className="rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/70 px-4 py-2.5 text-sm leading-relaxed text-slate-200 shadow-sm">
          {run.text ? (
            <span className="whitespace-pre-wrap">{run.text}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              thinking
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1 w-1 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveStepRow({ step }: { step: LiveStep }) {
  const pending = step.ok === undefined;
  return (
    <div className="font-mono text-[10px] leading-relaxed">
      <span className={pending ? "text-slate-500" : step.ok ? "text-emerald-400" : "text-rose-400"}>
        {pending ? "◌" : step.ok ? "✓" : "✗"}
      </span>{" "}
      <span className="text-indigo-300">{step.tool}</span>
      <span className="text-slate-500">({JSON.stringify(step.input).slice(1, -1).slice(0, 120)})</span>
      {step.ms !== undefined && <span className="ml-1 text-slate-600">{formatMs(step.ms)}</span>}
    </div>
  );
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Render "@Name" as a chip when it matches a real agent, plain text otherwise. */
function withMentions(content: string, agents: Agent[]) {
  if (agents.length === 0) return content;
  const known = new Set(agents.map((a) => nameKey(a.name)));
  const byLength = [...agents].sort((a, b) => b.name.length - a.name.length);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of content.matchAll(new RegExp(MENTION_PATTERN.source, MENTION_PATTERN.flags))) {
    const agent = byLength.find((a) => nameKey(match[1]).startsWith(nameKey(a.name)));
    if (!agent || !known.has(nameKey(agent.name))) continue;

    const at = (match.index ?? 0) + match[0].indexOf("@");
    parts.push(content.slice(cursor, at));
    parts.push(
      <span key={`${at}-${agent.id}`} className="rounded bg-white/20 px-1 font-medium">
        @{agent.name}
      </span>
    );
    cursor = at + 1 + agent.name.length;
  }

  if (parts.length === 0) return content;
  parts.push(content.slice(cursor));
  return parts;
}

/** Chips that jump the record panel to what a tool call touched. */
function RefChips({ refs, onFocus }: { refs: EntityRef[]; onFocus: (ref: EntityRef) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {refs.map((ref) => (
        <button
          key={`${ref.entity}-${ref.id}`}
          onClick={() => onFocus(ref)}
          title={`Show this ${ENTITY_SINGULAR[ref.entity]} in the panel`}
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-sans text-[10px] text-emerald-300 transition hover:bg-emerald-500/20"
        >
          {ENTITY_SINGULAR[ref.entity]} #{ref.id} · {ref.label}
        </button>
      ))}
    </div>
  );
}

/** One tool call, expandable to show exactly what came back. */
function TraceRow({ entry, onFocusRecord }: { entry: TraceEntry; onFocusRecord: (ref: EntityRef) => void }) {
  const [open, setOpen] = useState(false);
  const pretty = (() => {
    try {
      return JSON.stringify(JSON.parse(entry.result), null, 1);
    } catch {
      return entry.result;
    }
  })();

  return (
    <div className="font-mono text-[10px] leading-relaxed">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left hover:opacity-80">
        <span className={entry.ok ? "text-emerald-400" : "text-rose-400"}>{entry.ok ? "✓" : "✗"}</span>{" "}
        <span className="text-indigo-300">{entry.tool}</span>
        <span className="text-slate-500">({JSON.stringify(entry.input).slice(1, -1).slice(0, 120)})</span>
        {entry.ms !== undefined && <span className="ml-1 text-slate-600">{formatMs(entry.ms)}</span>}
        <span className="ml-1 text-slate-600">{open ? "▾" : "▸"}</span>
      </button>

      {entry.refs && entry.refs.length > 0 && <RefChips refs={entry.refs} onFocus={onFocusRecord} />}

      {open && (
        <div className="mt-1 space-y-1 border-l border-slate-700 pl-2">
          <div className="text-slate-600">input</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-slate-400">
            {JSON.stringify(entry.input, null, 1)}
          </pre>
          <div className="text-slate-600">{entry.ok ? "result" : "error"}</div>
          <pre
            className={`overflow-x-auto whitespace-pre-wrap break-all ${
              entry.ok ? "text-slate-400" : "text-rose-300"
            }`}
          >
            {pretty || "(empty)"}
          </pre>
        </div>
      )}
    </div>
  );
}

/** Turn a queued tool call into something a human can decide on at a glance. */
function describeProposal(proposal: Proposal): string {
  const verb = proposal.tool.replace(/_/g, " ");
  const fields = Object.entries(proposal.input)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return fields.length > 0 ? `${verb} — ${fields.join(" · ")}` : verb;
}

function contactPreviewValue(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

/** A human-readable preview of the contact that will exist after approval. */
function ContactProposalPreview({ proposal }: { proposal: Proposal }) {
  const name = contactPreviewValue(proposal.input, "name") ?? "Unnamed contact";
  const email = contactPreviewValue(proposal.input, "email");
  const phone = contactPreviewValue(proposal.input, "phone");
  const company = contactPreviewValue(proposal.input, "company");
  const status = contactPreviewValue(proposal.input, "status") ?? "lead";
  const notes = contactPreviewValue(proposal.input, "notes");
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/70">
      <div className="flex items-center gap-3 border-b border-slate-800 px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-200 ring-1 ring-indigo-400/30">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
          <div className="mt-0.5 truncate text-[11px] text-slate-400">{company ?? "No company"}</div>
        </div>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium capitalize text-sky-300">
          {status}
        </span>
      </div>

      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 px-3 py-2.5 text-xs">
        <dt className="text-slate-500">Email</dt>
        <dd className="break-all text-slate-300">{email ?? "—"}</dd>
        <dt className="text-slate-500">Phone</dt>
        <dd className="break-all text-slate-300">{phone ?? "—"}</dd>
        {notes && (
          <>
            <dt className="text-slate-500">Notes</dt>
            <dd className="whitespace-pre-wrap break-words text-slate-300">{notes}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

/** A write held for approval: what it would do, and the two buttons that decide it. */
function ProposalCard({
  proposal,
  onDecide,
}: {
  proposal: Proposal;
  onDecide: (id: number, decision: "approve" | "reject") => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    try {
      await onDecide(proposal.id, decision);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
          ⏸ Waiting for you
        </div>
        {proposal.tool === "create_contact" && (
          <span className="text-[10px] text-amber-200/70">Not created yet</span>
        )}
      </div>
      {proposal.tool === "create_contact" ? (
        <ContactProposalPreview proposal={proposal} />
      ) : (
        <div className="mt-1 break-words text-xs leading-relaxed text-amber-100">
          {describeProposal(proposal)}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => void decide("approve")}
          disabled={busy}
          className="rounded-md bg-emerald-600/80 px-2.5 py-1 text-[11px] font-medium text-white transition enabled:hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : proposal.tool === "create_contact" ? "Approve & create" : "Approve"}
        </button>
        <button
          onClick={() => void decide("reject")}
          disabled={busy}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 transition enabled:hover:border-rose-500/50 enabled:hover:text-rose-300 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  agents,
  proposals,
  onUndo,
  onFocusRecord,
  onDecideProposal,
}: {
  message: ChatMessage;
  agents: Agent[];
  proposals: Proposal[];
  onUndo: () => void;
  onFocusRecord: (ref: EntityRef) => void;
  onDecideProposal: (id: number, decision: "approve" | "reject") => Promise<void>;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%]">
          <div className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
            {withMentions(message.content, agents)}
          </div>
          <div className="mt-1 pr-1 text-right text-[10px] text-slate-600">{fmtTime(message.created_at)}</div>
        </div>
      </div>
    );
  }

  // A handoff brief is a one-liner from one agent to another, not a real reply.
  const isHandoff = message.content.startsWith("→ @");

  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar emoji={message.agent_emoji ?? "🤖"} />
      <div className="max-w-[78%] min-w-0">
        <div className="mb-1 flex items-baseline gap-2 pl-1">
          <span className="text-xs font-semibold text-slate-300">{message.agent_name ?? "Agent"}</span>
          <span className="text-[10px] text-slate-600">{fmtTime(message.created_at)}</span>
        </div>
        <div
          className={`whitespace-pre-wrap rounded-2xl rounded-tl-sm border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            message.is_error
              ? "border-rose-500/40 bg-rose-950/40 text-rose-200"
              : isHandoff
                ? "border-dashed border-violet-500/40 bg-violet-950/20 text-violet-200"
                : "border-slate-800 bg-slate-900/70 text-slate-200"
          }`}
        >
          {message.content}
        </div>
        {proposals.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} onDecide={onDecideProposal} />
            ))}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-start gap-1.5 pl-1">
          {message.trace.length > 0 && (
            <details className="min-w-0 flex-1">
              <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-500 hover:text-slate-300">
                ⚙ {message.trace.length} tool call{message.trace.length > 1 ? "s" : ""} · receipts
              </summary>
              <div className="mt-1.5 space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                {message.trace.map((t, i) => (
                  <TraceRow key={i} entry={t} onFocusRecord={onFocusRecord} />
                ))}
              </div>
            </details>
          )}
          {(message.undoable ?? 0) > 0 && (
            <button
              onClick={onUndo}
              title="Reverse every change this message made"
              className="shrink-0 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-500 transition hover:border-amber-500/50 hover:text-amber-300"
            >
              ↩ Undo {message.undoable} change{message.undoable === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
