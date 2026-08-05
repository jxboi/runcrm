"use client";

import { useState } from "react";
import { AccessLevel, Agent, Autonomy, Capabilities, ENTITIES } from "@/lib/types";

const EMOJI_PICKS = ["🤖", "💼", "📊", "🧠", "⚡", "🔍", "📣", "🛠️", "🧾", "🌱"];

const MODELS: { id: string; label: string }[] = [
  { id: "claude-opus-5", label: "Claude Opus 5 — most capable (default)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — fast & capable" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest" },
];

const LEVELS: AccessLevel[] = ["none", "read", "write"];

export default function AgentModal({
  agent,
  onClose,
  onSave,
  onDelete,
}: {
  agent: Agent | null;
  onClose: () => void;
  onSave: (input: Partial<Agent>, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState(agent?.name ?? "");
  const [emoji, setEmoji] = useState(agent?.emoji ?? "🤖");
  const [model, setModel] = useState(agent?.model ?? "claude-opus-5");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [caps, setCaps] = useState<Capabilities>(
    agent?.capabilities ?? { contacts: "read", deals: "read", activities: "read", tasks: "read" }
  );
  const [autonomy, setAutonomy] = useState<Autonomy>(agent?.autonomy ?? "auto");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("Give the agent a name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, emoji, model, instructions, capabilities: caps, autonomy }, agent?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-100">{agent ? "Edit agent" : "New agent"}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Instructions shape how it behaves; access rights control which CRM tools it gets.
        </p>

        <div className="mt-5 space-y-4">
          <div className="flex gap-3">
            <div className="w-20">
              <label className="text-[11px] font-medium text-slate-400">Emoji</label>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-center text-lg focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-400">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Assistant"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {EMOJI_PICKS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`rounded-md px-1.5 py-0.5 text-base transition hover:bg-slate-800 ${
                  emoji === e ? "bg-slate-800 ring-1 ring-indigo-500" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="What should this agent do, and how should it behave?"
              className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-relaxed text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Access rights</label>
            <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-700">
              {ENTITIES.map((entity, idx) => (
                <div
                  key={entity}
                  className={`flex items-center justify-between px-3 py-2 ${idx > 0 ? "border-t border-slate-800" : ""}`}
                >
                  <span className="text-sm capitalize text-slate-300">{entity}</span>
                  <div className="flex overflow-hidden rounded-md border border-slate-700">
                    {LEVELS.map((level) => (
                      <button
                        key={level}
                        onClick={() => setCaps((c) => ({ ...c, [entity]: level }))}
                        className={`px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                          caps[entity] === level
                            ? level === "write"
                              ? "bg-emerald-600/30 text-emerald-300"
                              : level === "read"
                                ? "bg-sky-600/30 text-sky-300"
                                : "bg-slate-700 text-slate-300"
                            : "text-slate-500 hover:bg-slate-800"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-600">
              read = list &amp; look up · write = also create, update, and log
            </p>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Writes</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "auto",
                    title: "Go ahead",
                    blurb: "Writes apply immediately, except new contacts. Still undoable.",
                  },
                  { value: "ask", title: "Ask me first", blurb: "Writes wait for your approval in chat." },
                ] as { value: Autonomy; title: string; blurb: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAutonomy(option.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    autonomy === option.value
                      ? "border-indigo-500/60 bg-indigo-500/10"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <div
                    className={`text-xs font-medium ${
                      autonomy === option.value ? "text-indigo-200" : "text-slate-300"
                    }`}
                  >
                    {option.title}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{option.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">{error}</div>}

          <div className="flex items-center justify-between pt-1">
            {agent ? (
              <button
                onClick={() => {
                  if (confirm(`Delete ${agent.name}? Its chat messages will remain.`)) onDelete(agent.id);
                }}
                className="rounded-lg px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-950/50"
              >
                Delete agent
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : agent ? "Save changes" : "Create agent"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
