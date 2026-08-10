import { describe, expect, it } from "vitest";
import { fmtMessageDate, fmtMessageTime, isSameMessageDay } from "./client";

function sqliteUtc(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

describe("chat date labels", () => {
  it("keeps chat times in the shared 12-hour format", () => {
    expect(fmtMessageTime("2026-08-09 23:32:00")).toMatch(/^\d{1,2}:32 (AM|PM)$/);
  });

  it("uses Today and Yesterday when possible", () => {
    const now = new Date(2026, 7, 9, 14, 30);
    expect(fmtMessageDate(sqliteUtc(now), now)).toBe("Today");
    expect(fmtMessageDate(sqliteUtc(new Date(2026, 7, 8, 23, 45)), now)).toBe("Yesterday");
  });

  it("groups messages by the viewer's local calendar day", () => {
    expect(
      isSameMessageDay(
        sqliteUtc(new Date(2026, 7, 9, 0, 5)),
        sqliteUtc(new Date(2026, 7, 9, 23, 55))
      )
    ).toBe(true);
    expect(
      isSameMessageDay(
        sqliteUtc(new Date(2026, 7, 8, 23, 55)),
        sqliteUtc(new Date(2026, 7, 9, 0, 5))
      )
    ).toBe(false);
  });
});
