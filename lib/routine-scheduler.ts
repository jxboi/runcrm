import { Temporal } from "@js-temporal/polyfill";
import { executeRoutineRun } from "./routine-execution";
import { instantToDb, latestOccurrence, nextOccurrence } from "./routine-schedule";
import {
  claimRoutineRun,
  getWorkspaceSettings,
  listDueRoutines,
  recoverStaleRoutineRuns,
} from "./routines";

export async function runDueRoutines(scheduledTime = Date.now()) {
  const now = Temporal.Instant.fromEpochMilliseconds(scheduledTime);
  await recoverStaleRoutineRuns(now);
  const { timezone } = await getWorkspaceSettings();
  const due = await listDueRoutines(instantToDb(now), 5);

  const claimed = await Promise.all(due.map(async (routine) => {
    const scheduledFor = instantToDb(latestOccurrence(routine.schedule, timezone, now));
    const nextRunAt = instantToDb(nextOccurrence(routine.schedule, timezone, now));
    return claimRoutineRun(routine, "scheduled", { scheduledFor, nextRunAt });
  }));

  const runs = claimed.filter((run) => run != null);
  const results = await Promise.allSettled(runs.map((run) => executeRoutineRun(run.id)));
  return {
    due: due.length,
    claimed: runs.length,
    succeeded: results.filter((result) => result.status === "fulfilled" && result.value.status === "succeeded").length,
    failed: results.filter((result) => result.status === "rejected" || result.value.status === "failed").length,
  };
}
