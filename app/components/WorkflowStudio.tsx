"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeKind, WorkflowRun, WorkflowVersion } from "@/lib/types";
import { api, fmtTime } from "@/lib/client";

type StudioTab = "preview" | "versions" | "runs";

const KIND_META: Record<WorkflowNodeKind, { icon: string; label: string; className: string }> = {
  trigger: { icon: "↯", label: "Trigger", className: "border-violet-400/60 bg-violet-500/10 text-violet-300" },
  condition: { icon: "◇", label: "Condition", className: "border-amber-400/60 bg-amber-500/10 text-amber-300" },
  action: { icon: "→", label: "Action", className: "border-sky-400/60 bg-sky-500/10 text-sky-300" },
  delay: { icon: "◷", label: "Delay", className: "border-slate-500/60 bg-slate-500/10 text-slate-400" },
  ai_agent: { icon: "✦", label: "AI agent", className: "border-indigo-400/70 bg-indigo-500/12 text-indigo-300" },
};

const PROMPTS = [
  {
    label: "Qualify new leads",
    text: "Create a workflow called Lead qualification. When a contact is created, use an AI agent to summarize the lead. If their status is qualified, create a follow-up task; otherwise log a nurture note.",
  },
  {
    label: "Watch renewals",
    text: "Create a workflow that runs every weekday at 9am, finds customer renewals due within 30 days, asks an AI agent to assess risk, and creates a task for high-risk accounts.",
  },
  {
    label: "Route to sales",
    text: "Create a workflow for a new qualified contact: assign the contact to a sales rep and create a follow-up task for that same rep.",
  },
] as const;

export default function WorkflowStudio({
  version,
  selectedWorkflowId,
  architectName,
  onSelectWorkflow,
  onDraftPrompt,
  onSendPrompt,
  onClose,
  onError,
}: {
  version: number;
  selectedWorkflowId: number | null;
  architectName: string;
  onSelectWorkflow: (id: number | null) => void;
  onDraftPrompt: (prompt: string) => void;
  onSendPrompt: (prompt: string) => Promise<boolean>;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [tab, setTab] = useState<StudioTab>("preview");
  const [previewedVersion, setPreviewedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);
  const [sendingAction, setSendingAction] = useState(false);

  const selected = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const selectedVersionKey = selected ? `${selected.id}:${selected.current_version}` : null;
  if (selectedVersionKey && selectedVersionKey !== previewedVersion) {
    setPreviewedVersion(selectedVersionKey);
    setTab("preview");
  }

  const reload = useCallback(async () => {
    try {
      const rows = await api<Workflow[]>("/api/workflows");
      setWorkflows(rows);
      if (selectedWorkflowId != null && !rows.some((workflow) => workflow.id === selectedWorkflowId)) {
        onSelectWorkflow(rows[0]?.id ?? null);
      } else if (selectedWorkflowId == null && rows.length > 0) {
        onSelectWorkflow(rows[0].id);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not load workflows");
    } finally {
      setLoading(false);
    }
  }, [onError, onSelectWorkflow, selectedWorkflowId]);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
  }, [reload, version]);

  useEffect(() => {
    if (!selectedWorkflowId) return;
    let cancelled = false;
    Promise.all([
      api<WorkflowVersion[]>(`/api/workflows/${selectedWorkflowId}/versions`),
      api<WorkflowRun[]>(`/api/workflows/${selectedWorkflowId}/runs`),
    ]).then(([versionRows, runRows]) => {
      if (cancelled) return;
      setVersions(versionRows);
      setRuns(runRows);
    }).catch((error) => onError(error instanceof Error ? error.message : "Could not load workflow history"));
    return () => { cancelled = true; };
  }, [onError, selectedWorkflowId, version]);

  const runTest = async () => {
    if (!selected || testing) return;
    setTesting(true);
    try {
      const result = await api<WorkflowRun>(`/api/workflows/${selected.id}/test`, { method: "POST", body: "{}" });
      setRuns((current) => [result, ...current]);
      setTab("runs");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Workflow test failed");
    } finally {
      setTesting(false);
    }
  };

  const runLive = async () => {
    if (!selected || running) return;
    const sendsEmail = selected.definition.nodes.some((node) => node.operation === "email.send");
    if (!window.confirm(sendsEmail
      ? `Run “${selected.name}” now? This can send real email.`
      : `Run “${selected.name}” now? This will execute its live actions.`)) return;
    setRunning(true);
    try {
      const result = await api<WorkflowRun>(`/api/workflows/${selected.id}/runs`, { method: "POST", body: "{}" });
      setRuns((current) => [result, ...current]);
      setTab("runs");
      if (result.status === "failed") onError(result.error ?? "Workflow run failed");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Workflow run failed");
    } finally {
      setRunning(false);
    }
  };

  const askArchitect = async (instruction: string) => {
    if (sendingAction) return;
    setSendingAction(true);
    try {
      await onSendPrompt(`@${architectName} ${instruction}`);
    } finally {
      setSendingAction(false);
    }
  };

  const errors = selected?.validation.filter((issue) => issue.level === "error") ?? [];
  const warnings = selected?.validation.filter((issue) => issue.level === "warning") ?? [];

  return (
    <section className="workflow-studio flex min-w-0 flex-1 flex-col bg-slate-950">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800/80 bg-slate-950/95 px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-400">Workflow studio</span>
            {selected && <span className="text-[10px] text-slate-600">/</span>}
            {selected && <span className="truncate text-xs font-semibold text-slate-200">{selected.name}</span>}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            {selected ? `Version ${selected.current_version} · ${selected.definition.nodes.length} nodes` : "Build and refine automations through chat"}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {selected && (
            <>
              <StatusBadge status={selected.status} />
              <button
                onClick={() => void runTest()}
                disabled={testing || errors.length > 0}
                title={errors.length ? "Fix validation errors before testing" : "Run a dry test with sample data"}
                className="rounded-lg border border-slate-700 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-300 shadow-sm transition hover:border-indigo-500/50 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {testing ? "Testing…" : "▷ Test"}
              </button>
              <button
                onClick={() => void runLive()}
                disabled={running || selected.status !== "active" || errors.length > 0}
                title={selected.status !== "active" ? "Activate the workflow before running it live" : "Execute live actions now"}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? "Running…" : "▶ Run now"}
              </button>
              <button
                onClick={() => void askArchitect(`${selected.status === "active" ? "Pause" : "Activate"} workflow #${selected.id} “${selected.name}”.`)}
                disabled={sendingAction || (selected.status !== "active" && errors.length > 0)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected.status === "active"
                    ? "border border-slate-700 text-slate-400 hover:text-slate-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                {selected.status === "active" ? "Pause" : "Activate"}
              </button>
            </>
          )}
          <button onClick={onClose} aria-label="Close Workflow Studio" className="ml-1 rounded-lg px-2 py-1 text-base text-slate-500 transition hover:bg-slate-900 hover:text-slate-200">×</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-52 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/35 xl:flex">
          <div className="flex items-center justify-between px-3 pb-2 pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Workflows</span>
            <button
              onClick={() => {
                setTab("preview");
                onDraftPrompt(`@${architectName} Create a workflow that `);
              }}
              className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300 hover:bg-indigo-500/20"
            >
              + New
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {loading && <div className="px-2 py-5 text-center text-[11px] text-slate-600">Loading…</div>}
            {!loading && workflows.length === 0 && <div className="px-2 py-5 text-center text-[11px] leading-relaxed text-slate-600">Your AI-built workflows will appear here.</div>}
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => { onSelectWorkflow(workflow.id); setTab("preview"); }}
                className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                  workflow.id === selectedWorkflowId
                    ? "border-indigo-500/40 bg-indigo-500/10"
                    : "border-transparent hover:border-slate-800 hover:bg-slate-900/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${workflow.status === "active" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-300">{workflow.name}</span>
                  <span className="text-[9px] text-slate-600">v{workflow.current_version}</span>
                </div>
                <div className="mt-1 line-clamp-2 pl-3.5 text-[9px] leading-relaxed text-slate-600">{workflow.description}</div>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-800/70 p-3 text-[9px] leading-relaxed text-slate-600">
            Every chat edit creates a version. Activating requires a valid graph.
          </div>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="flex h-11 shrink-0 items-center border-b border-slate-800/70 px-4">
                <div role="tablist" aria-label="Workflow views" className="flex h-full gap-5">
                  {(["preview", "versions", "runs"] as StudioTab[]).map((item) => (
                    <button
                      key={item}
                      role="tab"
                      aria-selected={tab === item}
                      onClick={() => setTab(item)}
                      className={`-mb-px border-b-2 text-[11px] font-medium capitalize ${tab === item ? "border-indigo-500 text-slate-200" : "border-transparent text-slate-500 hover:text-slate-300"}`}
                    >
                      {item}{item === "versions" ? ` ${versions.length}` : item === "runs" && runs.length ? ` ${runs.length}` : ""}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-3 text-[10px]">
                  {errors.length === 0 ? (
                    <span className="text-emerald-400">✓ Valid</span>
                  ) : (
                    <span className="text-rose-400">{errors.length} error{errors.length === 1 ? "" : "s"}</span>
                  )}
                  {warnings.length > 0 && <span className="text-amber-400">{warnings.length} setup note{warnings.length === 1 ? "" : "s"}</span>}
                </div>
              </div>

              {tab === "preview" && (
                <WorkflowPreview
                  workflow={selected}
                  onChangeNode={(node) => onDraftPrompt(`@${architectName} In workflow #${selected.id}, change the “${node.title}” step so that `)}
                />
              )}
              {tab === "versions" && (
                <VersionHistory
                  workflow={selected}
                  versions={versions}
                  sending={sendingAction}
                  onRestore={(versionNumber) => void askArchitect(`Restore workflow #${selected.id} to the definition from version ${versionNumber}.`)}
                />
              )}
              {tab === "runs" && <RunHistory runs={runs} onTest={() => void runTest()} onRun={() => void runLive()} testing={testing} running={running} active={selected.status === "active"} />}
            </>
          ) : (
            <EmptyWorkflowState architectName={architectName} onDraftPrompt={onDraftPrompt} />
          )}
        </main>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: Workflow["status"] }) {
  const cls = status === "active"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : status === "paused"
      ? "border-slate-600 bg-slate-500/10 text-slate-400"
      : "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${cls}`}>{status}</span>;
}

function EmptyWorkflowState({ architectName, onDraftPrompt }: { architectName: string; onDraftPrompt: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-2xl text-indigo-400 shadow-lg shadow-indigo-950/30">✦</div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-100">Describe it. See it. Refine it.</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
          Tell {architectName} what should start the workflow, what decisions it makes, and what happens next. Every correction stays in chat and becomes a recoverable version.
        </p>
        <div className="mt-7 grid gap-2 text-left sm:grid-cols-3">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              onClick={() => onDraftPrompt(`@${architectName} ${prompt.text}`)}
              className="group rounded-xl border border-slate-800 bg-slate-900/50 p-3 transition hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-indigo-500/5"
            >
              <div className="text-xs font-semibold text-slate-300 group-hover:text-indigo-300">{prompt.label}</div>
              <div className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-slate-600">{prompt.text}</div>
            </button>
          ))}
        </div>
        <button
          onClick={() => onDraftPrompt(`@${architectName} Create a workflow that `)}
          className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-500"
        >
          Start in chat
        </button>
      </div>
    </div>
  );
}

type Point = { x: number; y: number };

function graphLayout(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const trigger = nodes.find((node) => node.kind === "trigger") ?? nodes[0];
  const depth = new Map<string, number>();
  if (trigger) depth.set(trigger.id, 0);
  for (let pass = 0; pass < nodes.length; pass++) {
    for (const edge of edges) {
      const from = depth.get(edge.source);
      if (from !== undefined) depth.set(edge.target, Math.max(depth.get(edge.target) ?? 0, from + 1));
    }
  }
  nodes.forEach((node) => { if (!depth.has(node.id)) depth.set(node.id, 0); });
  const layers = new Map<number, WorkflowNode[]>();
  for (const node of nodes) layers.set(depth.get(node.id) ?? 0, [...(layers.get(depth.get(node.id) ?? 0) ?? []), node]);
  const widest = Math.max(1, ...[...layers.values()].map((layer) => layer.length));
  const width = Math.max(820, widest * 270 + 140);
  const height = Math.max(520, (Math.max(0, ...depth.values()) + 1) * 150 + 120);
  const points = new Map<string, Point>();
  for (const [level, layer] of layers) {
    const gap = Math.min(290, (width - 120) / Math.max(layer.length, 1));
    const start = width / 2 - ((layer.length - 1) * gap) / 2;
    layer.forEach((node, index) => points.set(node.id, { x: start + index * gap, y: 50 + level * 150 }));
  }
  return { points, width, height };
}

function WorkflowPreview({ workflow, onChangeNode }: { workflow: Workflow; onChangeNode: (node: WorkflowNode) => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(workflow.definition.nodes[0]?.id ?? null);
  const [zoom, setZoom] = useState(0.9);
  const viewportRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => graphLayout(workflow.definition.nodes, workflow.definition.edges), [workflow.definition]);
  const selectedNode = workflow.definition.nodes.find((node) => node.id === selectedNodeId) ?? null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [layout.width, workflow.current_version, zoom]);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle,rgba(156,160,170,0.28)_0.8px,transparent_0.9px)] bg-[size:18px_18px]">
        <div className="sticky left-3 top-3 z-20 flex w-fit items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 p-1 shadow-sm backdrop-blur">
          <button onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} aria-label="Zoom out" className="h-6 w-6 rounded text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-200">−</button>
          <span className="w-9 text-center text-[9px] tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => Math.min(1.3, value + 0.1))} aria-label="Zoom in" className="h-6 w-6 rounded text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-200">+</button>
          <button onClick={() => setZoom(0.9)} className="rounded px-1.5 py-1 text-[9px] text-slate-500 hover:bg-slate-900 hover:text-slate-200">Fit</button>
        </div>

        <div style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: "top center" }} className="relative mx-auto">
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
              <marker id="workflow-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L6,3.5 z" fill="#a6abb4" /></marker>
            </defs>
            {workflow.definition.edges.map((edge) => {
              const source = layout.points.get(edge.source);
              const target = layout.points.get(edge.target);
              if (!source || !target) return null;
              const startY = source.y + 88;
              const endY = target.y;
              const control = Math.max(40, (endY - startY) / 2);
              const positive = ["yes", "true", "if"].includes(edge.label.toLowerCase());
              return (
                <g key={edge.id}>
                  <path d={`M ${source.x} ${startY} C ${source.x} ${startY + control}, ${target.x} ${endY - control}, ${target.x} ${endY}`} fill="none" stroke={positive ? "#31a078" : "#a6abb4"} strokeWidth="1.5" markerEnd="url(#workflow-arrow)" />
                  {edge.label !== "then" && (
                    <g transform={`translate(${(source.x + target.x) / 2}, ${(startY + endY) / 2})`}>
                      <rect x="-20" y="-10" width="40" height="20" rx="6" fill="#fbfbfc" stroke={positive ? "#31a078" : "#d2d5dc"} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize="9" fill={positive ? "#218564" : "#7e8490"}>{edge.label}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {workflow.definition.nodes.map((node) => {
            const point = layout.points.get(node.id)!;
            const meta = KIND_META[node.kind];
            const selected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                style={{ left: point.x - 105, top: point.y, width: 210, height: 88 }}
                className={`absolute rounded-2xl border bg-slate-950 p-3 text-left shadow-[0_8px_24px_rgba(30,32,38,0.08)] transition hover:-translate-y-0.5 ${selected ? "border-indigo-500 ring-4 ring-indigo-500/10" : "border-slate-700 hover:border-slate-600"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold ${meta.className}`}>{meta.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">{meta.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-slate-200">{node.title}</span>
                  </span>
                </div>
                <span className="mt-2 block truncate text-[9px] text-slate-600">{node.description || node.operation}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedNode && (
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-l border-slate-800/80 bg-slate-900/30 p-4 2xl:block">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${KIND_META[selectedNode.kind].className}`}>
            {KIND_META[selectedNode.kind].icon} {KIND_META[selectedNode.kind].label}
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-200">{selectedNode.title}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{selectedNode.description}</p>
          <div className="mt-4 border-t border-slate-800 pt-3">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Operation</div>
            <code className="mt-1 block rounded-md bg-slate-900 px-2 py-1.5 text-[10px] text-indigo-300">{selectedNode.operation}</code>
          </div>
          <div className="mt-3">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Configuration</div>
            {Object.keys(selectedNode.config).length ? (
              <div className="mt-1 space-y-1">
                {Object.entries(selectedNode.config).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5">
                    <div className="text-[9px] text-slate-600">{key}</div>
                    <div className="mt-0.5 break-words text-[10px] text-slate-300">{typeof value === "string" ? value : JSON.stringify(value)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="mt-1 text-[10px] italic text-slate-600">No configuration</div>}
          </div>
          <button onClick={() => onChangeNode(selectedNode)} className="mt-4 w-full rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[10px] font-medium text-indigo-300 hover:bg-indigo-500/20">Change this step in chat</button>
        </aside>
      )}
    </div>
  );
}

function VersionHistory({ workflow, versions, sending, onRestore }: { workflow: Workflow; versions: WorkflowVersion[]; sending: boolean; onRestore: (version: number) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-sm font-semibold text-slate-200">Version history</h2>
        <p className="mt-1 text-[11px] text-slate-500">Every chat edit is immutable. Restoring creates a new version, so no history is lost.</p>
        <div className="mt-5 space-y-2">
          {versions.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
              <div className="flex items-start gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold ${item.version === workflow.current_version ? "bg-indigo-500/15 text-indigo-300" : "bg-slate-800 text-slate-500"}`}>v{item.version}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-300">{item.change_summary}</div>
                  <div className="mt-1 text-[9px] text-slate-600">{item.agent_name ?? "System"} · {fmtTime(item.created_at)} · {item.definition.nodes.length} nodes</div>
                </div>
                {item.version !== workflow.current_version && (
                  <button disabled={sending} onClick={() => onRestore(item.version)} className="rounded-md border border-slate-700 px-2 py-1 text-[9px] text-slate-500 hover:border-indigo-500/40 hover:text-indigo-300 disabled:opacity-40">Restore via chat</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RunHistory({ runs, onTest, onRun, testing, running, active }: { runs: WorkflowRun[]; onTest: () => void; onRun: () => void; testing: boolean; running: boolean; active: boolean }) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-sm font-semibold text-slate-200">Workflow runs</h2><p className="mt-1 text-[11px] text-slate-500">Tests are safe previews. Live runs execute configured email steps.</p></div>
          <div className="flex shrink-0 gap-2">
            <button onClick={onTest} disabled={testing} className="rounded-lg border border-slate-700 px-3 py-1.5 text-[10px] font-medium text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-40">{testing ? "Testing…" : "Test"}</button>
            <button onClick={onRun} disabled={running || !active} title={!active ? "Activate the workflow first" : "Execute live actions"} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40">{running ? "Running…" : "Run now"}</button>
          </div>
        </div>
        {runs.length === 0 ? (
          <div className="mt-16 text-center text-xs text-slate-600">No runs yet. Test the path safely or activate the workflow and run it live.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {runs.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                <div className="flex items-center justify-between"><span className={`text-[10px] font-semibold ${item.status === "succeeded" ? "text-emerald-400" : item.status === "failed" ? "text-rose-400" : "text-amber-400"}`}>{item.status === "succeeded" ? `✓ ${item.trigger === "test" ? "Test passed" : "Live run completed"}` : item.status === "failed" ? `× ${item.trigger === "test" ? "Test failed" : "Live run failed"}` : "Running"}</span><span className="text-[9px] text-slate-600">{item.trigger === "test" ? "Test" : "Live"} · v{item.version} · {fmtTime(item.started_at)}</span></div>
                <div className="mt-3 space-y-1.5">
                  {item.trace.map((step, index) => (
                    <div key={`${step.node_id}-${index}`} className={`flex gap-2 rounded-lg border px-2.5 py-2 ${step.status === "skipped" ? "border-slate-800/60 opacity-55" : "border-slate-800 bg-slate-950/70"}`}>
                      <span className={`mt-0.5 ${step.status === "succeeded" ? "text-emerald-400" : step.status === "failed" ? "text-rose-400" : "text-slate-600"}`}>{step.status === "succeeded" ? "✓" : step.status === "failed" ? "×" : "–"}</span>
                      <div><div className="text-[10px] font-medium text-slate-300">{step.node_title}</div><div className="mt-0.5 text-[9px] leading-relaxed text-slate-600">{step.detail}</div></div>
                    </div>
                  ))}
                </div>
                {item.error && <div className="mt-2 text-[10px] text-rose-400">{item.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
