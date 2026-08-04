import { Temporal } from "@js-temporal/polyfill";
import { RoutineSchedule } from "./types";

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateTimezone(timezone: string): string {
  const value = timezone.trim();
  if (!value) throw new Error("Workspace timezone is required");
  try {
    Temporal.Now.instant().toZonedDateTimeISO(value);
  } catch {
    throw new Error(`Invalid timezone "${value}"`);
  }
  return value;
}

export function normalizeSchedule(input: unknown): RoutineSchedule {
  if (!input || typeof input !== "object") throw new Error("Routine schedule is required");
  const value = input as Record<string, unknown>;
  const time = typeof value.time === "string" ? value.time : "";
  if (!TIME_RE.test(time)) throw new Error("Routine time must use HH:mm in 24-hour time");

  if (value.kind === "daily") return { kind: "daily", time };
  if (value.kind === "weekly") {
    if (!Array.isArray(value.weekdays)) throw new Error("Choose at least one weekday");
    const weekdays = [...new Set(value.weekdays.map(Number))].sort((a, b) => a - b);
    if (weekdays.length === 0) throw new Error("Choose at least one weekday");
    if (weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
      throw new Error("Weekdays must be numbers from 1 (Monday) through 7 (Sunday)");
    }
    return { kind: "weekly", weekdays, time };
  }
  if (value.kind === "monthly") {
    const day = Number(value.day);
    if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error("Monthly routines must use a day from 1 through 28");
    return { kind: "monthly", day, time };
  }
  throw new Error("Routine cadence must be daily, weekly, or monthly");
}

function atLocalTime(date: Temporal.PlainDate, time: string, timezone: string): Temporal.Instant {
  const parsed = Temporal.PlainTime.from(time);
  return Temporal.ZonedDateTime.from(
    {
      timeZone: timezone,
      year: date.year,
      month: date.month,
      day: date.day,
      hour: parsed.hour,
      minute: parsed.minute,
    },
    { disambiguation: "compatible" }
  ).toInstant();
}

/** First scheduled occurrence strictly after the supplied instant. */
export function nextOccurrence(schedule: RoutineSchedule, timezone: string, after: Temporal.Instant): Temporal.Instant {
  validateTimezone(timezone);
  const local = after.toZonedDateTimeISO(timezone);

  if (schedule.kind === "daily") {
    const today = atLocalTime(local.toPlainDate(), schedule.time, timezone);
    return Temporal.Instant.compare(today, after) > 0
      ? today
      : atLocalTime(local.toPlainDate().add({ days: 1 }), schedule.time, timezone);
  }

  if (schedule.kind === "weekly") {
    for (let offset = 0; offset <= 7; offset++) {
      const date = local.toPlainDate().add({ days: offset });
      if (!schedule.weekdays.includes(date.dayOfWeek)) continue;
      const candidate = atLocalTime(date, schedule.time, timezone);
      if (Temporal.Instant.compare(candidate, after) > 0) return candidate;
    }
    throw new Error("Could not calculate the next weekly occurrence");
  }

  let month = Temporal.PlainYearMonth.from({ year: local.year, month: local.month });
  for (let offset = 0; offset <= 1; offset++) {
    const date = month.toPlainDate({ day: schedule.day });
    const candidate = atLocalTime(date, schedule.time, timezone);
    if (Temporal.Instant.compare(candidate, after) > 0) return candidate;
    month = month.add({ months: 1 });
  }
  throw new Error("Could not calculate the next monthly occurrence");
}

/** Most recent scheduled occurrence at or before the supplied instant. */
export function latestOccurrence(schedule: RoutineSchedule, timezone: string, at: Temporal.Instant): Temporal.Instant {
  let cursor = at.subtract({ hours: 24 * 40 });
  let latest: Temporal.Instant | null = null;
  for (let i = 0; i < 50; i++) {
    const candidate = nextOccurrence(schedule, timezone, cursor);
    if (Temporal.Instant.compare(candidate, at) > 0) break;
    latest = candidate;
    cursor = candidate;
  }
  if (!latest) throw new Error("Could not calculate the latest routine occurrence");
  return latest;
}

export function instantFromDb(value: string): Temporal.Instant {
  return Temporal.Instant.from(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function instantToDb(value: Temporal.Instant): string {
  return value.toString({ smallestUnit: "second" }).replace("T", " ").replace("Z", "");
}
