"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Plus } from "lucide-react";
import { Agent, Routine, RoutineRun, RoutineSchedule, WorkspaceSettings } from "@/lib/types";
import { api, fmtTime } from "@/lib/client";
import { AgentIcon } from "@/app/components/AgentIcon";

const WEEKDAYS = [
  [1, "M"], [2, "T"], [3, "W"], [4, "T"], [5, "F"], [6, "S"], [7, "S"],
] as const;

type FormState = {
  name: string;
  instructions: string;
  agentId: string;
  kind: RoutineSchedule["kind"];
  time: string;
  weekdays: number[];
  day: number;
  timezone: string;
};

function blankForm(agents: Agent[], timezone: string): FormState {
  return { name: "", instructions: "", agentId: agents[0]?.id.toString() ?? "", kind: "weekly", time: "09:00", weekdays: [1], day: 1, timezone };
}

function scheduleLabel(schedule: RoutineSchedule, timezone: string) {
  if (schedule.kind === "daily") return `Daily at ${schedule.time} · ${timezone}`;
  if (schedule.kind === "monthly") return `Monthly on day ${schedule.day} at ${schedule.time} · ${timezone}`;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return `${schedule.weekdays.map((day) => labels[day - 1]).join(", ")} at ${schedule.time} · ${timezone}`;
}

export default function RoutinesTab({
  agents,
  busyAgentIds,
  version,
  onRun,
  onCount,
  onError,
}: {
  agents: Agent[];
  busyAgentIds: number[];
  version: number;
  onRun: (routineId: number, retryRunId?: number) => Promise<void>;
  onCount?: (count: number) => void;
  onError: (message: string) => void;
}) {
  const browserTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [runs, setRuns] = useState<RoutineRun[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings>({ timezone: "UTC", updated_at: "" });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningRoutineId, setRunningRoutineId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(agents, browserTimezone));

  const reload = useCallback(async () => {
    try {
      const [routineRows, runRows, workspace] = await Promise.all([
        api<Routine[]>("/api/routines"),
        api<RoutineRun[]>("/api/routine-runs"),
        api<WorkspaceSettings>("/api/workspace-settings"),
      ]);
      setRoutines(routineRows);
      onCount?.(routineRows.filter((routine) => routine.enabled).length);
      setRuns(runRows);
      setSettings(workspace);
      setForm((current) => ({
        ...current,
        agentId: current.agentId || agents[0]?.id.toString() || "",
        timezone: current.timezone === browserTimezone && workspace.timezone !== "UTC" ? workspace.timezone : current.timezone,
      }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to load routines");
    }
  }, [agents, browserTimezone, onCount, onError]);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
  }, [reload, version]);

  const openNew = () => {
    setEditingId(null);
    setForm(blankForm(agents, settings.timezone === "UTC" ? browserTimezone : settings.timezone));
    setShowForm(true);
  };

  const openEdit = (routine: Routine) => {
    const schedule = routine.schedule;
    setEditingId(routine.id);
    setForm({
      name: routine.name,
      instructions: routine.instructions,
      agentId: routine.agent_id?.toString() ?? "",
      kind: schedule.kind,
      time: schedule.time,
      weekdays: schedule.kind === "weekly" ? schedule.weekdays : [1],
      day: schedule.kind === "monthly" ? schedule.day : 1,
      timezone: settings.timezone,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (form.timezone !== settings.timezone) {
        await api<WorkspaceSettings>("/api/workspace-settings", { method: "PATCH", body: JSON.stringify({ timezone: form.timezone }) });
      }
      const schedule: RoutineSchedule = form.kind === "daily"
        ? { kind: "daily", time: form.time }
        : form.kind === "weekly"
          ? { kind: "weekly", weekdays: form.weekdays, time: form.time }
          : { kind: "monthly", day: form.day, time: form.time };
      const body = JSON.stringify({ name: form.name, instructions: form.instructions, agent_id: Number(form.agentId), schedule });
      await api(editingId == null ? "/api/routines" : `/api/routines/${editingId}`, {
        method: editingId == null ? "POST" : "PATCH",
        body,
      });
      setShowForm(false);
      await reload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Couldn't save routine");
    } finally {
      setSaving(false);
    }
  };

  const updateEnabled = async (routine: Routine) => {
    try {
      await api(`/api/routines/${routine.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !routine.enabled }) });
      await reload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Couldn't update routine");
    }
  };

  const archive = async (routine: Routine) => {
    if (!window.confirm(`Archive “${routine.name}”? Its run history will be kept.`)) return;
    try {
      await api(`/api/routines/${routine.id}`, { method: "DELETE" });
      await reload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Couldn't archive routine");
    }
  };

  const run = async (routineId: number, retryRunId?: number) => {
    setRunningRoutineId(routineId);
    try {
      await onRun(routineId, retryRunId);
    } finally {
      setRunningRoutineId(null);
      await reload();
    }
  };

  return (
    <div className="space-y-2">
      <button onClick={showForm ? () => setShowForm(false) : openNew} className="w-full rounded-lg border border-dashed border-slate-700 py-1.5 text-xs text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-300">
        {showForm ? "Cancel" : <span className="inline-flex items-center gap-1"><Plus aria-hidden="true" className="h-3 w-3" />Add routine</span>}
      </button>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <input placeholder="Routine name *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none" />
          <textarea placeholder="What should the agent do? *" rows={3} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none" />
          <select value={form.agentId} onChange={(event) => setForm({ ...form, agentId: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none">
            <option value="">Choose an agent</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as RoutineSchedule["kind"] })} className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none">
              <option value="daily">Daily</option><option value="weekly">Selected days</option><option value="monthly">Monthly</option>
            </select>
            <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:outline-none" />
          </div>
          {form.kind === "weekly" && (
            <div className="flex justify-between gap-1">
              {WEEKDAYS.map(([day, label]) => <button key={day} type="button" onClick={() => setForm({ ...form, weekdays: form.weekdays.includes(day) ? form.weekdays.filter((value) => value !== day) : [...form.weekdays, day].sort() })} className={`h-7 w-7 rounded-md border text-[10px] ${form.weekdays.includes(day) ? "border-indigo-500 bg-indigo-500/20 text-indigo-200" : "border-slate-700 text-slate-500"}`}>{label}</button>)}
            </div>
          )}
          {form.kind === "monthly" && <label className="flex items-center gap-2 text-[11px] text-slate-500">Day of month <input type="number" min={1} max={28} value={form.day} onChange={(event) => setForm({ ...form, day: Number(event.target.value) })} className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200" /></label>}
          <label className="block text-[10px] text-slate-500">Workspace timezone<input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none" /></label>
          <button onClick={save} disabled={saving || !form.name.trim() || !form.instructions.trim() || !form.agentId || (form.kind === "weekly" && form.weekdays.length === 0)} className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white enabled:hover:bg-indigo-500 disabled:opacity-40">{saving ? "Saving…" : editingId == null ? "Create routine" : "Save changes"}</button>
        </div>
      )}

      {routines.length === 0 && !showForm && <div className="mt-8 text-center text-xs text-slate-600">No routines yet.</div>}
      {routines.map((routine) => {
        const routineRuns = runs.filter((item) => item.routine_id === routine.id);
        const isRunning = runningRoutineId === routine.id || routineRuns.some((item) => item.status === "running");
        const agentBusy = routine.agent_id != null && busyAgentIds.includes(routine.agent_id);
        return (
          <div key={routine.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="truncate text-[13px] font-medium text-slate-200">{routine.name}</div><div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500"><AgentIcon icon={routine.agent_emoji} name={routine.agent_name} className="h-3 w-3" />{routine.agent_name ?? "Agent removed"}</div></div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${routine.enabled ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-slate-700 text-slate-500"}`}>{routine.enabled ? "active" : "paused"}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">{scheduleLabel(routine.schedule, settings.timezone)}</div>
            <div className="mt-1 text-[10px] text-slate-600">{routine.next_run_at ? `Next: ${fmtTime(routine.next_run_at)}` : "No upcoming run"}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => run(routine.id)} disabled={isRunning || agentBusy || routine.agent_id == null} className="rounded-md border border-indigo-500/50 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-300 enabled:hover:bg-indigo-500/25 disabled:opacity-40"><span className="inline-flex items-center gap-1"><Play aria-hidden="true" className="h-3 w-3" />{isRunning ? "Running…" : "Run now"}</span></button>
              <button onClick={() => updateEnabled(routine)} disabled={routine.agent_id == null} className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40">{routine.enabled ? "Pause" : "Resume"}</button>
              <button onClick={() => openEdit(routine)} className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">Edit</button>
              <button onClick={() => archive(routine)} className="rounded-md border border-slate-800 px-2 py-1 text-[10px] text-slate-600 hover:text-rose-300">Archive</button>
            </div>
            {routineRuns.length > 0 && <details className="mt-2"><summary className="text-[10px] text-slate-500 hover:text-slate-300">Run history ({routineRuns.length})</summary><div className="mt-1 space-y-1">{routineRuns.slice(0, 10).map((item) => <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950 p-2"><div className="flex items-center justify-between gap-2"><span className={`text-[10px] ${item.status === "succeeded" ? "text-emerald-400" : item.status === "failed" ? "text-rose-400" : "text-amber-400"}`}>{item.status} · {item.trigger}</span><span className="text-[9px] text-slate-600">{fmtTime(item.started_at)}</span></div>{item.error && <div className="mt-1 text-[10px] leading-relaxed text-rose-300/80">{item.error}</div>}{item.result && !item.error && <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[10px] leading-relaxed text-slate-500">{item.result}</div>}{item.status === "failed" && <button onClick={() => run(routine.id, item.id)} disabled={isRunning || agentBusy} className="mt-1 text-[10px] text-indigo-300 disabled:opacity-40">Run again</button>}</div>)}</div></details>}
          </div>
        );
      })}
    </div>
  );
}
