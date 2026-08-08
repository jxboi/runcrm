import { getAgent, getThread, insertMessage } from "./crm";
import { runChain } from "./agent/chain";
import { EmitFn } from "./agent/events";
import {
  finishRoutineRun,
  getRoutine,
  getRoutineRun,
  releaseRoutineLock,
  setRoutineRunTriggerMessage,
} from "./routines";
import { ChatThread } from "./types";

const discardEvents: EmitFn = () => {};

/** Execute a claimed routine run through the same chain used by chat and tasks. */
export async function executeRoutineRun(
  runId: number,
  options: { emit?: EmitFn; signal?: AbortSignal; thread?: ChatThread } = {}
) {
  const run = await getRoutineRun(runId);
  if (!run || run.status !== "running") throw new Error("Routine run is not available");
  if (run.routine_id == null) throw new Error("The routine for this run no longer exists");
  const emit = options.emit ?? discardEvents;

  try {
    const routine = await getRoutine(run.routine_id);
    if (!routine) throw new Error("Routine not found");
    if (routine.agent_id == null) throw new Error("The assigned agent no longer exists");
    const agent = await getAgent(routine.agent_id);
    if (!agent) throw new Error("The assigned agent no longer exists");
    const thread = options.thread ?? (await getThread(1));
    if (!thread) throw new Error("The Home thread is unavailable");

    const triggerMessage = await insertMessage({
      role: "user",
      thread_id: thread.id,
      content: `Routine #${routine.id} · ${routine.name}\nAssigned to ${agent.name}: ${routine.instructions}\nComplete this routine now with your tools, then report the outcome.`,
    });
    await setRoutineRunTriggerMessage(run.id, triggerMessage.id);
    emit({ type: "user_message", message: triggerMessage });

    const signal = options.signal ?? AbortSignal.timeout(300_000);
    const outcome = await runChain([agent], emit, signal, thread);
    if (signal.aborted) {
      await finishRoutineRun(run.id, "failed", outcome.text || null, "The run was stopped before it finished.", triggerMessage.id);
      return { status: "failed" as const, result: outcome.text, error: "The run was stopped before it finished." };
    }
    if (outcome.isError) {
      await finishRoutineRun(run.id, "failed", outcome.text, outcome.text, triggerMessage.id);
      return { status: "failed" as const, result: outcome.text, error: outcome.text };
    }
    await finishRoutineRun(run.id, "succeeded", outcome.text, null, triggerMessage.id);
    return { status: "succeeded" as const, result: outcome.text, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRoutineRun(run.id, "failed", null, message);
    return { status: "failed" as const, result: "", error: message };
  } finally {
    await releaseRoutineLock(run.routine_id, run.run_key);
  }
}
