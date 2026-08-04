import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { latestOccurrence, nextOccurrence, normalizeSchedule, validateTimezone } from "./routine-schedule";

describe("routine recurrence", () => {
  it("schedules daily work strictly after the reference time", () => {
    const schedule = { kind: "daily", time: "09:00" } as const;
    expect(nextOccurrence(schedule, "UTC", Temporal.Instant.from("2026-08-02T08:59:00Z")).toString()).toBe("2026-08-02T09:00:00Z");
    expect(nextOccurrence(schedule, "UTC", Temporal.Instant.from("2026-08-02T09:00:00Z")).toString()).toBe("2026-08-03T09:00:00Z");
  });

  it("supports several selected weekdays", () => {
    const schedule = { kind: "weekly", weekdays: [1, 5], time: "10:30" } as const;
    expect(nextOccurrence(schedule, "UTC", Temporal.Instant.from("2026-08-03T11:00:00Z")).toString()).toBe("2026-08-07T10:30:00Z");
  });

  it("crosses month and year boundaries", () => {
    const schedule = { kind: "monthly", day: 5, time: "09:15" } as const;
    expect(nextOccurrence(schedule, "UTC", Temporal.Instant.from("2026-12-05T09:15:00Z")).toString()).toBe("2027-01-05T09:15:00Z");
  });

  it("uses compatible daylight-saving disambiguation", () => {
    const schedule = { kind: "daily", time: "02:30" } as const;
    expect(nextOccurrence(schedule, "America/New_York", Temporal.Instant.from("2026-03-08T05:00:00Z")).toString()).toBe("2026-03-08T07:30:00Z");
  });

  it("finds only the latest occurrence after scheduler downtime", () => {
    const schedule = { kind: "daily", time: "09:00" } as const;
    expect(latestOccurrence(schedule, "UTC", Temporal.Instant.from("2026-08-05T12:00:00Z")).toString()).toBe("2026-08-05T09:00:00Z");
  });

  it("validates schedules and IANA timezones", () => {
    expect(normalizeSchedule({ kind: "monthly", day: 28, time: "23:59" })).toEqual({ kind: "monthly", day: 28, time: "23:59" });
    expect(() => normalizeSchedule({ kind: "monthly", day: 29, time: "09:00" })).toThrow("1 through 28");
    expect(() => normalizeSchedule({ kind: "weekly", weekdays: [], time: "09:00" })).toThrow("at least one weekday");
    expect(() => validateTimezone("Mars/Olympus_Mons")).toThrow("Invalid timezone");
  });
});
