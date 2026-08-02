import { all, first, run } from "./crm";
import { Entity, ENTITIES, ENTITY_SINGULAR, EntityRef } from "./types";

/**
 * The journal behind "nothing an agent does is ever more than one click from
 * undone": every agent write records the row before and after, so it can be
 * explained and reversed.
 *
 * Snapshots are always taken with `snapshotRow`, so before/after/current all
 * have the same shape and can be compared field-for-field.
 */

type Row = Record<string, unknown>;

/** Entity names double as table names; validated so they can be interpolated. */
function table(entity: string): Entity {
  const match = ENTITIES.find((e) => e === entity);
  if (!match) throw new Error(`Unknown entity "${entity}"`);
  return match;
}

/** The canonical stored shape of one record — no joined display columns. */
export function snapshotRow(entity: string, id: number): Promise<Row | null> {
  return first<Row>(`SELECT * FROM ${table(entity)} WHERE id = ?`, [id]);
}

/** A short human label for a record, for trace chips and undo summaries. */
export function labelFor(row: Row | null, id: number): string {
  const raw = row?.name ?? row?.title ?? row?.content;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return `#${id}`;
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

export interface JournalInput {
  agentId: number;
  tool: string;
  entity: Entity;
  entityId: number;
  before: Row | null;
  after: Row | null;
}

/** Record one write. Returns the mutation id so the caller can link it to a message. */
export async function journalMutation(input: JournalInput): Promise<number> {
  const result = await run(
    "INSERT INTO mutations (agent_id, tool, entity, entity_id, before, after) VALUES (?, ?, ?, ?, ?, ?)",
    [
      input.agentId,
      input.tool,
      input.entity,
      input.entityId,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
    ]
  );
  return Number(result.meta.last_row_id);
}

/** Attach a batch of mutations to the chat message that reported them. */
export async function linkMutationsToMessage(ids: number[], messageId: number): Promise<void> {
  if (ids.length === 0) return;
  await run(
    `UPDATE mutations SET message_id = ? WHERE id IN (${ids.map(() => "?").join(",")})`,
    [messageId, ...ids]
  );
}

interface MutationRow {
  id: number;
  entity: string;
  entity_id: number;
  tool: string;
  before: string | null;
  after: string | null;
}

/** True when a message still has changes that could be rolled back. */
export async function countUndoable(messageId: number): Promise<number> {
  const row = await first<{ n: number }>(
    "SELECT COUNT(*) AS n FROM mutations WHERE message_id = ? AND undone_at IS NULL",
    [messageId]
  );
  return Number(row?.n ?? 0);
}

export interface UndoResult {
  undone: string[];
  skipped: string[];
}

/**
 * Reverse every change a message made, newest first — which also means child
 * records (a deal's activity) are removed before what they point at.
 *
 * A record that changed after the agent touched it is left alone and reported,
 * so an undo never silently discards someone else's later edit.
 */
export async function undoMessage(messageId: number): Promise<UndoResult> {
  const rows = await all<MutationRow>(
    "SELECT id, entity, entity_id, tool, before, after FROM mutations WHERE message_id = ? AND undone_at IS NULL ORDER BY id DESC",
    [messageId]
  );

  const undone: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const entity = table(row.entity);
    const after = row.after ? (JSON.parse(row.after) as Row) : null;
    const before = row.before ? (JSON.parse(row.before) as Row) : null;
    const current = await snapshotRow(entity, row.entity_id);
    const label = `${ENTITY_SINGULAR[entity]} ${labelFor(current ?? after, row.entity_id)}`;

    if (!current) {
      // Already gone — nothing to reverse, but don't offer it again.
      await run("UPDATE mutations SET undone_at = datetime('now') WHERE id = ?", [row.id]);
      skipped.push(`${label} (already deleted)`);
      continue;
    }
    if (after && JSON.stringify(current) !== JSON.stringify(after)) {
      skipped.push(`${label} (changed since)`);
      continue;
    }

    if (before === null) {
      await run(`DELETE FROM ${entity} WHERE id = ?`, [row.entity_id]);
      undone.push(`deleted ${label}`);
    } else {
      const columns = Object.keys(before).filter((c) => c !== "id");
      await run(
        `UPDATE ${entity} SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
        [...columns.map((c) => before[c]), row.entity_id]
      );
      undone.push(`restored ${label}`);
    }
    await run("UPDATE mutations SET undone_at = datetime('now') WHERE id = ?", [row.id]);
  }

  return { undone, skipped };
}

/** The record a tool call touched, for the trace chip in the UI. */
export function refFor(entity: Entity, id: number, row: Row | null): EntityRef {
  return { entity, id, label: labelFor(row, id) };
}
