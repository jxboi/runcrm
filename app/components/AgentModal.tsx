"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AccessLevel, Agent, CAPABILITY_ENTITIES, Capabilities } from "@/lib/types";
import { AGENT_ICON_OPTIONS, AgentIcon, agentIconKey } from "@/app/components/AgentIcon";
import DropdownMenu from "@/app/components/DropdownMenu";

const MODELS: { id: string; label: string }[] = [
  { id: "claude-opus-5", label: "Claude Opus 5 — most capable" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — fast & capable (default)" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest" },
];

const ICON_OPTIONS = [
  ...AGENT_ICON_OPTIONS.map(({ key, label }) => ({ key, label })),
  { key: "workflow", label: "Workflow" },
  { key: "compass", label: "Coordinator" },
  { key: "trash", label: "Cleanup" },
  { key: "clock", label: "Renewals" },
  { key: "user", label: "Person" },
];

const LEVELS = [
  { value: "none", label: "None" },
  { value: "read", label: "Read" },
  { value: "write_ask", label: "Write" },
  { value: "write_full", label: "Full" },
] as const satisfies readonly { value: AccessLevel; label: string }[];
const ACCESS_LABELS = { contacts: "Contacts", deals: "Deals", activities: "Activities", tasks: "Tasks", sales_reps: "Sales Reps", workflows: "Workflow" } as const;

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
  const [iconKey, setIconKey] = useState(() => agentIconKey(agent?.emoji, agent?.name));
  const [model, setModel] = useState(agent?.model ?? "claude-sonnet-5");
  const [modelOpen, setModelOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [caps, setCaps] = useState<Capabilities>(() => {
    const initial = agent?.capabilities ?? { contacts: "read", deals: "read", activities: "read", tasks: "read", sales_reps: "read", workflows: "none" };
    return Object.fromEntries(
      CAPABILITY_ENTITIES.map((entity) => [
        entity,
        initial[entity] === "write" ? (agent?.autonomy === "ask" ? "write_ask" : "write_full") : initial[entity],
      ])
    ) as Capabilities;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!modelMenuRef.current?.contains(event.target as Node)) setModelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModelOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [modelOpen]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Give the agent a name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, emoji: iconKey, model, instructions, capabilities: caps }, agent?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-100">{agent ? "Edit agent" : "New agent"}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Instructions shape how it behaves; access rights control which tools it gets.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="agent-name" className="text-[11px] font-medium text-slate-400">Name</label>
            <div className="relative mt-1">
              <input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Assistant"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-14 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
              <div className="absolute right-2 top-1/2 z-10 w-9 -translate-y-1/2">
                <DropdownMenu
                  options={ICON_OPTIONS.map(({ key, label }) => ({ value: key, label }))}
                  value={iconKey}
                  onChange={setIconKey}
                  id="agent-icon"
                  ariaLabel="Agent icon"
                  className="w-full"
                  buttonClassName="h-9 justify-center rounded-lg border-transparent bg-slate-700 p-2 text-sm text-slate-300 hover:border-transparent focus:border-transparent"
                  menuClassName="grid w-64 grid-cols-3 gap-2 p-3"
                  showChevron={false}
                  renderValue={() => <AgentIcon icon={iconKey} name={name} className="h-4 w-4 text-slate-400" />}
                  renderOption={(option, selected) => (
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? "bg-slate-700" : ""}`}>
                      <AgentIcon icon={option.value} name={option.label} className="h-4 w-4 text-slate-400" />
                    </span>
                  )}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400">Model</label>
            <div ref={modelMenuRef} className="relative mt-1">
              <button
                type="button"
                id="agent-model"
                aria-label="Agent model"
                aria-haspopup="listbox"
                aria-expanded={modelOpen}
                onClick={() => setModelOpen((open) => !open)}
                className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 text-left text-sm text-slate-200 outline-none transition hover:border-slate-500 focus:border-slate-500"
              >
                <span className="min-w-0 truncate">{MODELS.find((option) => option.id === model)?.label ?? MODELS[0].label}</span>
                <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${modelOpen ? "rotate-180" : ""}`} strokeWidth={2} />
              </button>
              {modelOpen && (
                <div role="listbox" aria-label="Agent model options" className="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-1.5 text-slate-200 shadow-xl">
                  {MODELS.map((option) => {
                    const selected = model === option.id;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        key={option.id}
                        onClick={() => {
                          setModel(option.id);
                          setModelOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${selected ? "bg-slate-800 text-slate-100" : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"}`}
                      >
                        <span className="whitespace-nowrap">{option.label}</span>
                        {selected && <span aria-hidden="true" className="ml-3 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
              {CAPABILITY_ENTITIES.map((entity, idx) => (
                <div
                  key={entity}
                  className={`flex items-center justify-between px-3 py-2 ${idx > 0 ? "border-t border-slate-800" : ""}`}
                >
                  <span className="text-sm text-slate-300">{ACCESS_LABELS[entity]}</span>
                  <div className="flex overflow-hidden rounded-md border border-slate-700 divide-x divide-slate-700">
                    {LEVELS.map(({ value, label }) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setCaps((c) => ({ ...c, [entity]: value }))}
                        className={`whitespace-nowrap px-2.5 py-1 text-[11px] font-medium transition ${
                          caps[entity] === value
                            ? value === "write_full"
                              ? "bg-rose-600/30 text-rose-300"
                              : value === "write_ask"
                                ? "bg-emerald-600/30 text-emerald-300"
                              : value === "read"
                                ? "bg-sky-600/30 text-sky-300"
                                : "bg-slate-700 text-slate-300"
                            : "text-slate-500 hover:bg-slate-800"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-600">
              Read = List &amp; Look up · Write = Approval Required · Full = Apply Immediately
            </p>
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
