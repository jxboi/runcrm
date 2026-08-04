import { Temporal } from "@js-temporal/polyfill";
import { all, first, getAgent, run } from "./crm";
import { ensureDb } from "./db";
import { instantToDb, nextOccurrence, normalizeSchedule, validateTimezone } from "./routine-schedule";
import { Routine, RoutineRun, RoutineRunTrigger, WorkspaceSettings } from "./types";

type RoutineRow = Omit<Routine, "schedule" | "enabled"> & { schedule: string; enabled: number };

function rowToRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    agent_emoji: row.agent_emoji,
    schedule: normalizeSchedule(JSON.parse(row.schedule)),
    enabled: Boolean(row.enabled),
    archived_at: row.archived_at,
    next_run_at: row.next_run_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  const settings = await first<WorkspaceSettings>("SELECT timezone, updated_at FROM workspace_settings WHERE id = 1");
  return settings ?? { timezone: "UTC", updated_at: instantToDb(Temporal.Now.instant()) };
}

export async function updateWorkspaceSettings(timezoneInput: string): Promise<WorkspaceSettings> {
  const timezone = validateTimezone(timezoneInput);
  const now = Temporal.Now.instant();
  await run("INSERT INTO workspace_settings (id, timezone, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET timezone = excluded.timezone, updated_at = datetime('now')", [timezone]);
  const routines = await listRoutines();
  await Promise.all(routines.filter((routine) => routine.enabled && routine.agent_id != null).map((routine) =>
    run("UPDATE routines SET next_run_at = ?, updated_at = datetime('now') WHERE id = ?", [instantToDb(nextOccurrence(routine.schedule, timezone, now)), routine.id])
  ));
  return getWorkspaceSettings();
}

const ROUTINE_SELECT = "SELECT r.*, a.name AS agent_name, a.emoji AS agent_emoji FROM routines r LEFT JOIN agents a ON a.id = r.agent_id";

export async function listRoutines(options: { includeArchived?: boolean } = {}): Promise<Routine[]> {
  const where = options.includeArchived ? "" : "WHERE r.archived_at IS NULL";
  return (await all<RoutineRow>(`${ROUTINE_SELECT} ${where} ORDER BY r.id DESC`)).map(rowToRoutine);
}

export async function getRoutine(id: number): Promise<Routine | null> {
  const row = await first<RoutineRow>(`${ROUTINE_SELECT} WHERE r.id = ?`, [id]);
  return row ? rowToRoutine(row) : null;
}

export async function listDueRoutines(now: string, limit = 5): Promise<Routine[]> {
  return (await all<RoutineRow>(`${ROUTINE_SELECT} WHERE r.archived_at IS NULL AND r.enabled = 1 AND r.agent_id IS NOT NULL AND r.next_run_at IS NOT NULL AND r.next_run_at <= ? ORDER BY r.next_run_at, r.id LIMIT ${Math.min(Math.max(limit, 1), 20)}`, [now])).map(rowToRoutine);
}

export async function createRoutine(input: {
  name?: string; instructions?: string; agent_id?: number; schedule?: unknown; enabled?: boolean;
}): Promise<Routine> {
  const name = input.name?.trim();
  const instructions = input.instructions?.trim();
  if (!name) throw new Error("Routine name is required");
  if (!instructions) throw new Error("Routine instructions are required");
  const agentId = Number(input.agent_id);
  if (!Number.isInteger(agentId) || !(await getAgent(agentId))) throw new Error("Choose an existing agent");
  const schedule = normalizeSchedule(input.schedule);
  const enabled = input.enabled !== false;
  const { timezone } = await getWorkspaceSettings();
  const nextRun = enabled ? instantToDb(nextOccurrence(schedule, timezone, Temporal.Now.instant())) : null;
  const result = await run("INSERT INTO routines (name, instructions, agent_id, schedule, enabled, next_run_at) VALUES (?, ?, ?, ?, ?, ?)", [
    name, instructions, agentId, JSON.stringify(schedule), enabled ? 1 : 0, nextRun,
  ]);
  return (await getRoutine(Number(result.meta.last_row_id)))!;
}

export async function updateRoutine(id: number, input: {
  name?: string; instructions?: string; agent_id?: number; schedule?: unknown; enabled?: boolean;
}): Promise<Routine | null> {
  const existing = await getRoutine(id);
  if (!existing || existing.archived_at) return null;
  const name = input.name === undefined ? existing.name : input.name.trim();
  const instructions = input.instructions === undefined ? existing.instructions : input.instructions.trim();
  if (!name) throw new Error("Routine name is required");
  if (!instructions) throw new Error("Routine instructions are required");
  const agentId = input.agent_id === undefined ? existing.agent_id : Number(input.agent_id);
  if (agentId == null || !Number.isInteger(agentId) || !(await getAgent(agentId))) throw new Error("Choose an existing agent");
  const schedule = input.schedule === undefined ? existing.schedule : normalizeSchedule(input.schedule);
  const enabled = input.enabled ?? existing.enabled;
  const { timezone } = await getWorkspaceSettings();
  const nextRun = enabled ? instantToDb(nextOccurrence(schedule, timezone, Temporal.Now.instant())) : null;
  await run("UPDATE routines SET name = ?, instructions = ?, agent_id = ?, schedule = ?, enabled = ?, next_run_at = ?, updated_at = datetime('now') WHERE id = ?", [
    name, instructions, agentId, JSON.stringify(schedule), enabled ? 1 : 0, nextRun, id,
  ]);
  return getRoutine(id);
}

export async function archiveRoutine(id: number): Promise<boolean> {
  return (await run("UPDATE routines SET enabled = 0, archived_at = datetime('now'), next_run_at = NULL, lock_token = NULL, locked_at = NULL, updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL", [id])).meta.changes > 0;
}

export async function listRoutineRuns(routineId?: number, limit = 50): Promise<RoutineRun[]> {
  const where = routineId == null ? "" : "WHERE rr.routine_id = ?";
  const params = routineId == null ? [] : [routineId];
  return all<RoutineRun>(`SELECT rr.*, r.name AS routine_name FROM routine_runs rr LEFT JOIN routines r ON r.id = rr.routine_id ${where} ORDER BY rr.id DESC LIMIT ${Math.min(Math.max(limit, 1), 200)}`, params);
}

export async function getRoutineRun(id: number): Promise<(RoutineRun & { run_key: string }) | null> {
  return first<RoutineRun & { run_key: string }>("SELECT * FROM routine_runs WHERE id = ?", [id]);
}

export async function claimRoutineRun(
  routine: Routine,
  trigger: RoutineRunTrigger,
  options: { scheduledFor?: string | null; retriedFromRunId?: number | null; nextRunAt?: string | null } = {}
): Promise<RoutineRun | null> {
  if (routine.archived_at) throw new Error("Archived routines cannot run");
  if (routine.agent_id == null) throw new Error("This routine is paused because its agent no longer exists");
  const runKey = trigger === "scheduled" && options.scheduledFor
    ? `scheduled:${routine.id}:${options.scheduledFor}`
    : `${trigger}:${routine.id}:${crypto.randomUUID()}`;
  const now = instantToDb(Temporal.Now.instant());
  const extra = trigger === "scheduled" ? "AND enabled = 1 AND next_run_at <= ?" : "";
  const db = await ensureDb();
  try {
    const [, inserted] = await db.batch([
      db.prepare(`UPDATE routines SET lock_token = ?, locked_at = ?${trigger === "scheduled" ? ", next_run_at = ?" : ""} WHERE id = ? AND archived_at IS NULL AND agent_id IS NOT NULL AND lock_token IS NULL ${extra}`).bind(...(trigger === "scheduled"
        ? [runKey, now, options.nextRunAt, routine.id, routine.next_run_at]
        : [runKey, now, routine.id]) as D1Value[]),
      db.prepare("INSERT INTO routine_runs (routine_id, run_key, trigger, scheduled_for, status, retried_from_run_id) SELECT id, ?, ?, ?, 'running', ? FROM routines WHERE id = ? AND lock_token = ?").bind(
        runKey, trigger, options.scheduledFor ?? null, options.retriedFromRunId ?? null, routine.id, runKey,
      ),
    ]);
    if (inserted.meta.changes === 0) return null;
    return (await getRoutineRun(Number(inserted.meta.last_row_id)))!;
  } catch (error) {
    if (trigger === "scheduled") {
      await run("UPDATE routines SET next_run_at = ? WHERE id = ? AND next_run_at <= ?", [options.nextRunAt, routine.id, routine.next_run_at]);
      return null;
    }
    throw error;
  }
}

export async function finishRoutineRun(runId: number, status: "succeeded" | "failed", result: string | null, error: string | null, triggerMessageId?: number) {
  await run("UPDATE routine_runs SET status = ?, result = ?, error = ?, trigger_message_id = COALESCE(?, trigger_message_id), completed_at = datetime('now') WHERE id = ? AND status = 'running'", [status, result, error, triggerMessageId ?? null, runId]);
}

export async function setRoutineRunTriggerMessage(runId: number, messageId: number) {
  await run("UPDATE routine_runs SET trigger_message_id = ? WHERE id = ?", [messageId, runId]);
}

export async function releaseRoutineLock(routineId: number, runKey: string) {
  await run("UPDATE routines SET lock_token = NULL, locked_at = NULL WHERE id = ? AND lock_token = ?", [routineId, runKey]);
}

export async function recoverStaleRoutineRuns(now = Temporal.Now.instant()) {
  const cutoff = instantToDb(now.subtract({ minutes: 10 }));
  await run("UPDATE routine_runs SET status = 'failed', error = 'The run exceeded the execution window. Run it again when ready.', completed_at = datetime('now') WHERE status = 'running' AND run_key IN (SELECT lock_token FROM routines WHERE locked_at IS NOT NULL AND locked_at < ?)", [cutoff]);
  await run("UPDATE routines SET lock_token = NULL, locked_at = NULL WHERE locked_at IS NOT NULL AND locked_at < ?", [cutoff]);
}
