"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Copy,
  Forward,
  LoaderCircle,
  Clock3,
  Lightbulb,
  MessageSquare,
  Pause,
  Pin,
  Reply,
  SmilePlus,
  Sparkles,
  Plus,
  Square,
  Star,
  Trash2,
  Undo2,
  UserPlus,
  Workflow,
  X,
} from "lucide-react";
import {
  Agent,
  ChatMessage,
  ChatThread,
  ENTITY_SINGULAR,
  EntityRef,
  LiveRun,
  LiveStep,
  MESSAGE_FEEDBACK,
  MESSAGE_REACTIONS,
  MessageFeedback,
  MessageReaction,
  MessageUpdate,
  Proposal,
  Recipient,
  RunNotice,
  TraceEntry,
} from "@/lib/types";
import { MENTION_PATTERN, nameKey } from "@/lib/agent/mentions";
import { fmtMessageDate, fmtMessageTime, isSameMessageDay } from "@/lib/client";
import { AgentIcon } from "@/app/components/AgentIcon";

type MessageMenuView = "actions" | "reactions" | "forward" | "feedback";
type MessageMenuState = {
  message: ChatMessage;
  x: number;
  y: number;
  view: MessageMenuView;
};

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
  threads,
  onUpdateMessage,
  onForwardMessage,
  onDeleteMessage,
  onNotify,
  onFocusRecord,
  proposals,
  onDecideProposal,
  workflowContext,
  onEnableWorkflow,
  onDisableWorkflow,
  draftSuggestion,
}: {
  thread: ChatThread;
  agents: Agent[];
  messages: ChatMessage[];
  recipient: Recipient;
  onSelectRecipient: (recipient: Recipient) => void;
  runs: LiveRun[];
  notices: RunNotice[];
  onSend: (content: string, replyToId?: number) => Promise<boolean>;
  onStop: (runKey: string, agentId: number) => void;
  onUndo: (messageId: number) => void;
  threads: ChatThread[];
  onUpdateMessage: (message: ChatMessage, update: MessageUpdate) => Promise<void>;
  onForwardMessage: (message: ChatMessage, threadId: number) => Promise<void>;
  onDeleteMessage: (message: ChatMessage) => Promise<void>;
  onNotify: (text: string) => void;
  onFocusRecord: (ref: EntityRef) => void;
  proposals: Proposal[];
  onDecideProposal: (id: number, decision: "approve" | "reject") => Promise<void>;
  workflowContext?: { name: string | null } | null;
  onEnableWorkflow: () => void;
  onDisableWorkflow: () => void;
  draftSuggestion?: { id: number; text: string } | null;
}) {
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [handledSuggestionId, setHandledSuggestionId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasPositionedAtLatestRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  if (draftSuggestion && draftSuggestion.id !== handledSuggestionId) {
    setHandledSuggestionId(draftSuggestion.id);
    setDraft(draftSuggestion.text);
    setMentionQuery(null);
  }

  useEffect(() => {
    if (!draftSuggestion || draftSuggestion.id !== handledSuggestionId) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(draftSuggestion.text.length, draftSuggestion.text.length);
    });
  }, [draftSuggestion, handledSuggestionId]);

  const liveText = runs.map((r) => r.text.length + r.steps.length).join(",");
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    if (!hasPositionedAtLatestRef.current && messages.length > 0) {
      scroller.scrollTop = scroller.scrollHeight;
      hasPositionedAtLatestRef.current = true;
      return;
    }

    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [messages.length, runs.length, notices.length, liveText]);

  useEffect(() => {
    if (!messageMenu) return;
    const close = () => setMessageMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [messageMenu]);

  useEffect(() => {
    if (!agentMenuOpen) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!agentMenuRef.current?.contains(target) && !target?.closest('[aria-controls="chat-agent-menu"]')) {
        setAgentMenuOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAgentMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [agentMenuOpen]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!addMenuRef.current?.contains(target) && !target?.closest('[aria-controls="chat-add-menu"]')) {
        setAddMenuOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [addMenuOpen]);

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
    const reply = replyingTo;
    setDraft("");
    setMentionQuery(null);
    const ok = await onSend(content, reply?.id);
    // Never lose what the user typed: put it back if the send didn't land and
    // they haven't already started typing something else.
    if (!ok) setDraft((cur) => cur || content);
    else setReplyingTo(null);
  };

  const openMessageMenu = (message: ChatMessage, x: number, y: number) => {
    if (message.id < 1) return;
    const width = 264;
    const estimatedHeight = 520;
    setMessageMenu({
      message,
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - estimatedHeight - 8)),
      view: "actions",
    });
  };

  const replyToMessage = (message: ChatMessage) => {
    setReplyingTo(message);
    setMessageMenu(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const askAboutMessage = (message: ChatMessage) => {
    setReplyingTo(message);
    setDraft("What should I know or do about this?");
    setMessageMenu(null);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(0, input.value.length);
    });
  };

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      onNotify("Message copied");
    } catch {
      onNotify("Couldn't copy that message");
    } finally {
      setMessageMenu(null);
    }
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
  const chooseRecipient = (nextRecipient: Recipient) => {
    onSelectRecipient(nextRecipient);
    setAgentMenuOpen(false);
  };
  const placeholder =
    agents.length === 0
      ? "Create an agent first…"
      : selected
        ? workflowContext
          ? `Describe ${workflowContext.name ? `a change to ${workflowContext.name}` : "the workflow you want"}…`
          : `Message ${selected.name}…  (@ to address someone else)`
        : "Message the team…  (@ to pick someone, or let it route)";
  const isEmpty = messages.length === 0 && runs.length === 0 && notices.length === 0;
  const emptySuggestions = workflowContext
    ? [
        {
          icon: <Lightbulb aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
          label: "Create a workflow from a goal",
          prompt: "Create a workflow that qualifies new leads and assigns the best next step.",
        },
        {
          icon: <BookOpen aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
          label: "Review and improve this workflow",
          prompt: "Review this workflow and suggest improvements for reliability and follow-through.",
        },
        {
          icon: <Clock3 aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
          label: "Automate recurring sales work",
          prompt: "Create a recurring workflow to review stale deals and prepare follow-up tasks.",
        },
      ]
    : thread.account_name
      ? [
          {
            icon: <Lightbulb aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
            label: `Summarize ${thread.account_name}`,
            prompt: `Summarize ${thread.account_name} and highlight anything that needs attention.`,
          },
          {
            icon: <BookOpen aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
            label: "Research and plan the next step",
            prompt: `Review everything we know about ${thread.account_name} and recommend the next best action.`,
          },
          {
            icon: <Clock3 aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
            label: "Prepare a timely follow-up",
            prompt: `Draft a concise follow-up for ${thread.account_name} based on the latest activity.`,
          },
        ]
      : [
          {
            icon: <UserPlus aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
            label: "Add a contact or update a deal",
            prompt: "Help me add a new contact to the CRM.",
          },
          {
            icon: <BookOpen aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
            label: "Research the pipeline and plan next steps",
            prompt: "Review the sales pipeline, identify what is stuck, and recommend the next best actions.",
          },
          {
            icon: <Clock3 aria-hidden="true" className="h-5 w-5" strokeWidth={1.65} />,
            label: "Automate follow-ups and recurring work",
            prompt: "Create a recurring routine to review stale deals and prepare follow-up tasks.",
          },
        ];

  const applySuggestion = (prompt: string) => {
    setDraft(prompt);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(prompt.length, prompt.length);
    });
  };

  return (
    <>
      <header className="crm-chat-header flex h-16 shrink-0 items-center border-b border-slate-800/70 px-6">
        <div className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-5 tracking-tight text-slate-100">
                {thread.title}
              </h1>
              {(workflowContext || thread.account_name || thread.id !== 1) && (
                <p className="crm-chat-subtitle mt-0.5 truncate text-xs leading-4 text-slate-400">
                  {workflowContext
                    ? workflowContext.name
                      ? `Editing “${workflowContext.name}” · every change becomes a version.`
                      : "Describe a workflow, then refine every step here."
                    : thread.account_name
                      ? `Account thread · agents use ${thread.account_name} as the default context.`
                      : "A focused conversation; its title is created from your first message."}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
        </div>
      </header>

      <div ref={scrollRef} className={isEmpty ? "hidden" : "flex-1 overflow-y-auto px-6 py-6"}>
        <div className="mx-auto w-full max-w-[960px] space-y-5">
          {messages.map((m, index) => {
            const showDate = index === 0 || !isSameMessageDay(messages[index - 1].created_at, m.created_at);
            return (
              <div key={m.id} className={showDate ? "space-y-4" : undefined}>
                {showDate && (
                  <div
                    role="separator"
                    aria-label={`Messages from ${fmtMessageDate(m.created_at)}`}
                    className="flex items-center gap-3 py-1"
                  >
                    <span className="h-px flex-1 bg-slate-800/70" />
                    <span className="px-3 py-1 text-[11px] font-medium text-slate-400">
                      {fmtMessageDate(m.created_at)}
                    </span>
                    <span className="h-px flex-1 bg-slate-800/70" />
                  </div>
                )}
                <MessageBubble
                  message={m}
                  agents={agents}
                  proposals={proposals.filter((p) => p.message_id === m.id)}
                  onUndo={() => onUndo(m.id)}
                  onOpenMenu={openMessageMenu}
                  onFocusRecord={onFocusRecord}
                  onDecideProposal={onDecideProposal}
                />
              </div>
            );
          })}

          {notices.map((n) => (
            <div key={n.id} className="text-center text-[11px] text-slate-400">
              {n.text}
            </div>
          ))}

          {runs.map((run) => (
            <LiveBubble key={`${run.runKey}:${run.agentId}`} run={run} onStop={() => onStop(run.runKey, run.agentId)} />
          ))}
        </div>
      </div>

      <div
        className={
          isEmpty
            ? "crm-composer flex min-h-0 flex-1 items-center overflow-y-auto px-6 py-6"
            : "crm-composer shrink-0 px-5 pb-4 pt-3"
        }
      >
        <div className={`mx-auto w-full ${isEmpty ? "max-w-[640px]" : "max-w-[960px]"}`}>
          {replyingTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-2">
              <Reply aria-hidden="true" className="h-4 w-4 shrink-0 text-indigo-300" strokeWidth={1.8} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                  Replying to {replyingTo.role === "user" ? "you" : replyingTo.agent_name ?? "Agent"}
                </div>
                <div className="truncate text-xs text-slate-400">{replyingTo.content}</div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancel reply"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="relative">
            {suggestions.length > 0 && (
              <div className="absolute left-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
                {suggestions.map((a, i) => (
                  <button
                    key={a.id}
                    onMouseEnter={() => setHighlighted(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      acceptMention(a);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                      i === highlighted ? "bg-indigo-500/15 text-slate-200" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <AgentIcon icon={a.emoji} name={a.name} className="h-4 w-4" />
                    <span className="flex-1 truncate font-medium">{a.name}</span>
                    <span className="text-[10px] text-slate-500">{a.model.replace("claude-", "")}</span>
                  </button>
                ))}
                <div className="border-t border-slate-800 px-3 py-1 text-[10px] text-slate-600">
                  ↑↓ to choose · Enter to insert
                </div>
              </div>
            )}

            {addMenuOpen && (
              <div
                ref={addMenuRef}
                id="chat-add-menu"
                role="menu"
                aria-label="Add to chat"
                className={`absolute left-0 z-20 w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-[0_14px_36px_rgba(17,18,22,0.14)] ${isEmpty ? "top-full mt-2" : "bottom-full mb-2"}`}
              >
                <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-slate-500">Add</div>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!!workflowContext}
                  onClick={() => {
                    setAddMenuOpen(false);
                    onEnableWorkflow();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-slate-900 disabled:cursor-default disabled:bg-indigo-950/70"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${workflowContext ? "bg-indigo-900 text-indigo-400" : "bg-slate-900 text-slate-400"}`}>
                    <Workflow aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-200">Workflow</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">Create and edit workflows in this chat</span>
                  </span>
                  {workflowContext && <span className="shrink-0 text-[11px] font-medium text-indigo-400">Added</span>}
                </button>
              </div>
            )}

            {agentMenuOpen && agents.length > 0 && (
              <div
                ref={agentMenuRef}
                id="chat-agent-menu"
                role="menu"
                aria-label="Choose an agent"
                className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1"
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={recipient === "auto"}
                  onClick={() => chooseRecipient("auto")}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                    recipient === "auto" ? "bg-indigo-500/15 text-slate-200" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-indigo-300" strokeWidth={1.8} />
                  <span className="flex-1 font-medium">Auto</span>
                </button>
                {agents.map((a) => {
                  const busy = runs.some((r) => r.agentId === a.id);
                  return (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={a.id === recipient}
                      key={a.id}
                      onClick={() => chooseRecipient(a.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                        a.id === recipient ? "bg-indigo-500/15 text-slate-200" : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <AgentIcon icon={a.emoji} name={a.name} className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">{a.model.replace("claude-", "")}</span>
                      {busy && <span aria-label="Working" className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid min-h-[80px] grid-cols-[auto_1fr_auto] grid-rows-[1fr_auto] gap-1 rounded-[20px] border border-slate-700/45 bg-slate-950 p-2 shadow-[0_12px_30px_rgba(17,18,22,0.1)] transition">
              <button
                type="button"
                aria-label="Add to chat"
                aria-expanded={addMenuOpen}
                aria-controls="chat-add-menu"
                onClick={() => {
                  setAgentMenuOpen(false);
                  setAddMenuOpen((open) => !open);
                }}
                title="Add to chat"
                className={`col-start-1 row-start-2 inline-flex h-9 w-9 shrink-0 self-center items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-900 hover:text-indigo-300 ${addMenuOpen ? "bg-indigo-950 text-indigo-400" : ""}`}
              >
                <Plus
                  aria-hidden="true"
                  className={`h-5 w-5 transition-transform duration-200 ${addMenuOpen ? "rotate-45" : "rotate-0"}`}
                  strokeWidth={1.8}
                />
              </button>
              {isEmpty && (
                <div className="col-start-2 row-start-2 flex min-w-0 self-center items-center gap-1.5 justify-self-start">
                  {workflowContext && <WorkflowPluginChip onRemove={onDisableWorkflow} />}
                  <button
                    type="button"
                    aria-label="Choose an agent"
                    aria-expanded={agentMenuOpen}
                    aria-controls="chat-agent-menu"
                    onClick={() => {
                      setAddMenuOpen(false);
                      setAgentMenuOpen((open) => !open);
                    }}
                    disabled={agents.length === 0}
                    className="flex h-9 min-w-0 max-w-48 items-center gap-1.5 rounded-lg px-1.5 py-0 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {selected && <AgentIcon icon={selected.emoji} name={selected.name} className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{selected?.name ?? "Auto"}</span>
                    <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  </button>
                </div>
              )}
              {!isEmpty && workflowContext && (
                <div className="col-start-2 row-start-2 self-center">
                  <WorkflowPluginChip onRemove={onDisableWorkflow} />
                </div>
              )}
              <textarea
                ref={inputRef}
                aria-label={placeholder}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  syncMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyUp={(e) => syncMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
                onBlur={() => setMentionQuery(null)}
                onKeyDown={onKeyDown}
                rows={isEmpty ? 1 : Math.min(5, Math.max(1, draft.split("\n").length))}
                placeholder={placeholder}
                className="col-span-3 col-start-1 row-start-1 max-h-40 w-full resize-none self-stretch bg-transparent px-1.5 py-1 text-sm leading-5 text-slate-200 placeholder:text-slate-500 focus:outline-none"
                disabled={agents.length === 0}
              />
              <button
                onClick={() => void send()}
                aria-label="Send message"
                disabled={!draft.trim() || agents.length === 0}
                className="col-start-3 row-start-2 inline-flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full bg-slate-100 text-slate-950 transition enabled:hover:bg-indigo-700 enabled:hover:text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                <ArrowUp aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </div>
          {isEmpty && (
            <div aria-label="Things you can ask RunCRM to do" className="mx-auto mt-4 max-w-[600px] space-y-0">
              {emptySuggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => applySuggestion(suggestion.prompt)}
                  disabled={agents.length === 0}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-slate-500 transition hover:bg-slate-900/70 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-slate-500 transition group-hover:text-indigo-300">
                    {suggestion.icon}
                  </span>
                  <span className="text-[13px] font-medium leading-5">{suggestion.label}</span>
                </button>
              ))}
            </div>
          )}
          {workflowContext && (
            <div className="mt-1.5 px-1 text-[11px] leading-4 text-slate-400">
              Describe changes naturally · every saved revision stays linked to this chat
            </div>
          )}
        </div>
      </div>

      {messageMenu && (
        <MessageContextMenu
          state={messageMenu}
          threads={threads}
          currentThreadId={thread.id}
          onChangeView={(view) => setMessageMenu((current) => (current ? { ...current, view } : null))}
          onReply={() => replyToMessage(messageMenu.message)}
          onCopy={() => void copyMessage(messageMenu.message)}
          onReact={(reaction) => {
            setMessageMenu(null);
            void onUpdateMessage(messageMenu.message, {
              reaction: messageMenu.message.reaction === reaction ? null : reaction,
            }).catch(() => {});
          }}
          onForward={(threadId) => {
            setMessageMenu(null);
            void onForwardMessage(messageMenu.message, threadId).catch((error) => {
              onNotify(error instanceof Error ? error.message : "Couldn't forward that message");
            });
          }}
          onTogglePin={() => {
            setMessageMenu(null);
            void onUpdateMessage(messageMenu.message, { pinned: !messageMenu.message.pinned }).catch(() => {});
          }}
          onAsk={() => askAboutMessage(messageMenu.message)}
          onToggleStar={() => {
            setMessageMenu(null);
            void onUpdateMessage(messageMenu.message, { starred: !messageMenu.message.starred }).catch(() => {});
          }}
          onFeedback={(feedback) => {
            setMessageMenu(null);
            void onUpdateMessage(messageMenu.message, { feedback }).then(() => onNotify("Feedback saved")).catch(() => {});
          }}
          onDelete={() => {
            setMessageMenu(null);
            void onDeleteMessage(messageMenu.message).catch((error) => {
              onNotify(error instanceof Error ? error.message : "Couldn't delete that message");
            });
          }}
        />
      )}
    </>
  );
}

function WorkflowPluginChip({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remove Workflow from this chat"
      onClick={onRemove}
      title="Remove Workflow from this chat"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-indigo-800 bg-indigo-950 px-2.5 text-xs font-medium text-indigo-300 transition hover:border-indigo-700 hover:bg-indigo-900"
    >
      <Workflow aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
      <span>Workflow</span>
      <X aria-hidden="true" className="h-3.5 w-3.5 text-indigo-400" strokeWidth={1.8} />
    </button>
  );
}

function AgentAvatar({ icon, name }: { icon?: string | null; name?: string | null }) {
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-slate-300 ring-1 ring-slate-800/80">
      <AgentIcon icon={icon} name={name} className="h-4 w-4" />
    </span>
  );
}

/** An agent turn still in flight: streamed text, tool steps, and a Stop button. */
function LiveBubble({ run, onStop }: { run: LiveRun; onStop: () => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar icon={run.agentEmoji} name={run.agentName} />
      <div className="crm-agent-turn max-w-[80%] min-w-0">
        <div className="mb-1 flex items-baseline gap-2 pl-1">
          <span className="text-xs font-semibold text-slate-200">{run.agentName}</span>
          <span className="text-[11px] text-slate-400">working…</span>
          <button
            onClick={onStop}
            className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
          >
            <span className="inline-flex items-center gap-1">
              <Square aria-hidden="true" className="h-2.5 w-2.5" fill="currentColor" />
              Stop
            </span>
          </button>
        </div>

        {run.steps.length > 0 && (
          <div className="mb-1.5 space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
            {run.steps.map((step) => (
              <LiveStepRow key={step.index} step={step} />
            ))}
          </div>
        )}

        <div className="rounded-2xl rounded-tl-sm border border-slate-800/75 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-200">
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
      <span className={`mr-1 inline-flex align-middle ${pending ? "text-slate-500" : step.ok ? "text-emerald-400" : "text-rose-400"}`}>
        {pending ? <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" /> : step.ok ? <Check aria-hidden="true" className="h-3 w-3" /> : <CircleX aria-hidden="true" className="h-3 w-3" />}
      </span>
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
      <span key={`${at}-${agent.id}`} className="inline-flex align-middle items-center gap-1 font-semibold text-indigo-600">
        <AgentIcon icon={agent.emoji} name={agent.name} className="h-3.5 w-3.5 shrink-0" />
        {agent.name}
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
        <span className={`mr-1 inline-flex align-middle ${entry.ok ? "text-emerald-400" : "text-rose-400"}`}>
          {entry.ok ? <Check aria-hidden="true" className="h-3 w-3" /> : <CircleX aria-hidden="true" className="h-3 w-3" />}
        </span>
        <span className="text-indigo-300">{entry.tool}</span>
        <span className="text-slate-500">({JSON.stringify(entry.input).slice(1, -1).slice(0, 120)})</span>
        {entry.ms !== undefined && <span className="ml-1 text-slate-600">{formatMs(entry.ms)}</span>}
        <ChevronRight aria-hidden="true" className={`ml-1 inline h-3 w-3 text-slate-600 transition-transform ${open ? "rotate-90" : ""}`} />
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
          <Pause aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
          Waiting for you
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
  onOpenMenu,
  onFocusRecord,
  onDecideProposal,
}: {
  message: ChatMessage;
  agents: Agent[];
  proposals: Proposal[];
  onUndo: () => void;
  onOpenMenu: (message: ChatMessage, x: number, y: number) => void;
  onFocusRecord: (ref: EntityRef) => void;
  onDecideProposal: (id: number, decision: "approve" | "reject") => Promise<void>;
}) {
  const openFromButton = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onOpenMenu(message, rect.left, rect.bottom + 4);
  };
  const openFromContext = (event: React.MouseEvent) => {
    event.preventDefault();
    onOpenMenu(message, event.clientX, event.clientY);
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end" onContextMenu={openFromContext}>
        <div className="crm-user-turn max-w-[66%]">
          <div className="group relative rounded-2xl rounded-tr-sm bg-slate-900 px-3 pb-6 pr-9 pt-2 text-sm leading-relaxed text-slate-200">
            <MessageMenuChevron onClick={openFromButton} inverse />
            {message.forwarded_from_id != null && (
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-indigo-100/70">
                Forwarded from {message.forwarded_from_role === "user" ? "you" : message.forwarded_from_agent_name ?? "Agent"}
              </div>
            )}
            {message.reply_to_content && <QuotedMessage message={message} inverse />}
            <div className="whitespace-pre-wrap">{withMentions(message.content, agents)}</div>
            <BubbleMeta message={message} inverse />
          </div>
        </div>
      </div>
    );
  }

  // A handoff brief is a one-liner from one agent to another, not a real reply.
  const isHandoff = message.content.startsWith("→ @");

  return (
    <div className="flex items-start" onContextMenu={openFromContext}>
      <div className="crm-agent-turn max-w-[80%] min-w-0">
        <div className="mb-1 flex items-center gap-2 pl-1">
          <AgentIcon icon={message.agent_emoji} name={message.agent_name} className="h-4 w-4 shrink-0 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-200">{message.agent_name ?? "Agent"}</span>
        </div>
        <div
          className={`group relative rounded-2xl rounded-tl-sm pb-3 pl-1 pr-10 pt-3 text-sm leading-relaxed ${
            message.is_error
              ? "border border-rose-500/40 bg-rose-950/40 text-rose-200"
              : isHandoff
                ? "border border-dashed border-violet-500/40 bg-violet-950/20 text-violet-200"
                : "bg-transparent text-slate-200"
          }`}
        >
          <MessageMenuChevron onClick={openFromButton} />
          {message.forwarded_from_id != null && (
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Forwarded from {message.forwarded_from_role === "user" ? "you" : message.forwarded_from_agent_name ?? "Agent"}
            </div>
          )}
          {message.reply_to_content && <QuotedMessage message={message} />}
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>
        {proposals.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} onDecide={onDecideProposal} />
            ))}
          </div>
        )}

        <div className="mt-1.5 flex items-baseline justify-between gap-4 pl-1 pr-3">
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            {message.trace.length > 0 && (
              <details className="group min-w-0">
                <summary className="inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-900/65 hover:text-slate-200">
                  <ChevronRight aria-hidden="true" className="h-3 w-3 transition-transform group-open:rotate-90" />
                  <span>{message.trace.length} tool call{message.trace.length > 1 ? "s" : ""} · receipts</span>
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
                className="min-h-6 shrink-0 rounded-md px-1 py-0.5 text-[11px] text-slate-400 transition hover:bg-amber-950/60 hover:text-amber-300"
              >
                <span className="inline-flex items-center gap-1">
                  <Undo2 aria-hidden="true" className="h-3 w-3" />
                  Undo {message.undoable} change{message.undoable === 1 ? "" : "s"}
                </span>
              </button>
            )}
          </div>
          <BubbleMeta message={message} inline />
        </div>
      </div>
    </div>
  );
}

function MessageMenuChevron({
  onClick,
  inverse = false,
}: {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  inverse?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="More message options"
      aria-haspopup="menu"
      onClick={onClick}
        className={`absolute right-1.5 top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 ${
        inverse
          ? "bg-transparent text-slate-500 hover:bg-slate-700/10 hover:text-slate-700"
          : "bg-slate-900/10 text-slate-500 backdrop-blur-sm hover:bg-slate-900/20 hover:text-slate-700"
      }`}
    >
        <ChevronDown aria-hidden="true" className="h-3 w-3" strokeWidth={2.2} />
    </button>
  );
}

function QuotedMessage({ message, inverse = false }: { message: ChatMessage; inverse?: boolean }) {
  const author = message.reply_to_role === "user" ? "You" : message.reply_to_agent_name ?? "Agent";
  return (
    <div className={`mb-2 overflow-hidden rounded-lg border-l-2 px-2.5 py-1.5 ${inverse ? "border-white/70 bg-white/10" : "border-indigo-400 bg-slate-900/55"}`}>
      <div className={`text-[10px] font-semibold ${inverse ? "text-indigo-100" : "text-indigo-300"}`}>{author}</div>
      <div className={`max-h-9 overflow-hidden text-xs leading-4 ${inverse ? "text-indigo-50/75" : "text-slate-400"}`}>
        {message.reply_to_content}
      </div>
    </div>
  );
}

function BubbleMeta({ message, inverse = false, inline = false }: { message: ChatMessage; inverse?: boolean; inline?: boolean }) {
  return (
    <span className={`${inline ? "inline-flex shrink-0" : "absolute bottom-2 right-3 flex"} items-center gap-1.5 leading-none`}>
      {message.reaction && <span className="text-sm" title="Reaction">{message.reaction}</span>}
      {message.pinned && <Pin aria-label="Pinned" className={`h-3 w-3 ${inverse ? "text-slate-500" : "text-slate-400"}`} fill="currentColor" />}
      {message.starred && <Star aria-label="Starred" className={`h-3 w-3 ${inverse ? "text-amber-200" : "text-amber-400"}`} fill="currentColor" />}
      <span className={`text-[10px] ${inverse ? "text-slate-500" : "text-slate-400"}`}>
        {fmtMessageTime(message.created_at)}
      </span>
    </span>
  );
}

function MessageContextMenu({
  state,
  threads,
  currentThreadId,
  onChangeView,
  onReply,
  onCopy,
  onReact,
  onForward,
  onTogglePin,
  onAsk,
  onToggleStar,
  onFeedback,
  onDelete,
}: {
  state: MessageMenuState;
  threads: ChatThread[];
  currentThreadId: number;
  onChangeView: (view: MessageMenuView) => void;
  onReply: () => void;
  onCopy: () => void;
  onReact: (reaction: MessageReaction) => void;
  onForward: (threadId: number) => void;
  onTogglePin: () => void;
  onAsk: () => void;
  onToggleStar: () => void;
  onFeedback: (feedback: MessageFeedback) => void;
  onDelete: () => void;
}) {
  const otherThreads = threads.filter((thread) => thread.id !== currentThreadId);
  const feedbackLabels: Record<MessageFeedback, string> = {
    helpful: "Helpful",
    needs_improvement: "Needs improvement",
    incorrect: "Incorrect",
    unsafe: "Unsafe or concerning",
  };

  return (
    <div
      role="menu"
      aria-label="Message options"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-[80] w-64 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-950 p-1.5 text-sm text-slate-200 shadow-2xl shadow-black/35"
      style={{ left: state.x, top: state.y }}
    >
      {state.view === "actions" && (
        <>
          <div className="mb-1 grid grid-cols-7 gap-0.5 border-b border-slate-800 px-1 pb-2 pt-1">
            {MESSAGE_REACTIONS.slice(0, 6).map((reaction) => (
              <button
                type="button"
                key={reaction}
                aria-label={`React with ${reaction}`}
                aria-pressed={state.message.reaction === reaction}
                onClick={() => onReact(reaction)}
                className={`flex h-8 items-center justify-center rounded-lg text-lg transition hover:bg-slate-800 ${state.message.reaction === reaction ? "bg-indigo-500/20" : ""}`}
              >
                {reaction}
              </button>
            ))}
            <button
              type="button"
              aria-label="More reactions"
              onClick={() => onChangeView("reactions")}
              className="flex h-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <Plus aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <MenuAction icon={Reply} label="Reply" onClick={onReply} autoFocus />
          <MenuAction icon={Copy} label="Copy" onClick={onCopy} />
          <MenuAction icon={SmilePlus} label="React" onClick={() => onChangeView("reactions")} />
          <MenuAction icon={Forward} label="Forward" onClick={() => onChangeView("forward")} />
          <MenuAction icon={Pin} label={state.message.pinned ? "Unpin" : "Pin"} onClick={onTogglePin} />
          <MenuAction icon={Sparkles} label="Ask" onClick={onAsk} />
          <MenuAction icon={Star} label={state.message.starred ? "Unstar" : "Star"} onClick={onToggleStar} />
          <div className="my-1 border-t border-slate-800" />
          <MenuAction icon={MessageSquare} label="Feedback" onClick={() => onChangeView("feedback")} />
          <MenuAction icon={Trash2} label="Delete" onClick={onDelete} danger />
        </>
      )}

      {state.view === "reactions" && (
        <>
          <MenuBack title="React" onBack={() => onChangeView("actions")} />
          <div className="grid grid-cols-5 gap-1 p-2">
            {MESSAGE_REACTIONS.map((reaction) => (
              <button
                type="button"
                key={reaction}
                aria-label={`React with ${reaction}`}
                aria-pressed={state.message.reaction === reaction}
                onClick={() => onReact(reaction)}
                className={`flex h-10 items-center justify-center rounded-xl text-xl transition hover:bg-slate-800 ${state.message.reaction === reaction ? "bg-indigo-500/20 ring-1 ring-indigo-400/40" : ""}`}
              >
                {reaction}
              </button>
            ))}
          </div>
        </>
      )}

      {state.view === "forward" && (
        <>
          <MenuBack title="Forward to" onBack={() => onChangeView("actions")} />
          <div className="max-h-64 overflow-y-auto py-1">
            {otherThreads.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-500">No other conversations yet</div>
            ) : (
              otherThreads.map((thread) => (
                <button
                  type="button"
                  key={thread.id}
                  onClick={() => onForward(thread.id)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-800"
                >
                  <Forward aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {state.view === "feedback" && (
        <>
          <MenuBack title="Feedback" onBack={() => onChangeView("actions")} />
          <div className="py-1">
            {MESSAGE_FEEDBACK.map((feedback) => (
              <button
                type="button"
                key={feedback}
                aria-pressed={state.message.feedback === feedback}
                onClick={() => onFeedback(feedback)}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-800 ${state.message.feedback === feedback ? "bg-indigo-500/15 text-indigo-200" : ""}`}
              >
                {feedbackLabels[feedback]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuBack({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-800 px-1 pb-1.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to message options"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      <span className="font-medium">{title}</span>
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
  autoFocus = false,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      autoFocus={autoFocus}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${danger ? "text-rose-300 hover:bg-rose-500/10" : "hover:bg-slate-800"}`}
    >
      <Icon aria-hidden={true} className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
