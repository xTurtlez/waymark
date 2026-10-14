import { describe, expect, it } from "vitest";
import { addDays, dayHeading, dayLabel, daysBetween, dueInfo, isoDay, stampLabel, timeLabel, whenLabel } from "@/lib/format";

// Wednesday 14 October 2026, 21:30 UK time (BST, UTC+1).
const NOW = new Date("2026-10-14T20:30:00Z");

describe("UK calendar days", () => {
  it("uses the UK day, not the server's UTC day", () => {
    // 23:30 UK on 25 June is still 25 June in the UK but 22:30 UTC.
    expect(isoDay(new Date("2026-06-25T22:30:00Z"))).toBe("2026-06-25");
    // 00:30 UK on 26 June (BST) is 23:30 UTC on 25 June.
    expect(isoDay(new Date("2026-06-25T23:30:00Z"))).toBe("2026-06-26");
    // In winter (GMT) UK and UTC agree.
    expect(isoDay(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });

  it("adds and counts days across the clock change", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-10-14", "2026-10-07")).toBe(-7);
  });

  it("formats times in UK time", () => {
    expect(timeLabel("2026-10-10T06:02:00Z")).toBe("07:02");
    expect(stampLabel("2026-10-10T06:02:00Z")).toBe("10 Oct 07:02");
  });
});

describe("relative labels", () => {
  it("names nearby days", () => {
    expect(dayLabel("2026-10-14", NOW)).toBe("Today");
    expect(dayLabel("2026-10-13", NOW)).toBe("Yesterday");
    expect(dayLabel("2026-10-15", NOW)).toBe("Tomorrow");
    expect(dayLabel("2026-10-16", NOW)).toBe("Fri");
    expect(dayLabel("2026-10-21", NOW)).toBe("21 Oct");
    expect(dayLabel("2026-10-06", NOW)).toBe("6 Oct");
  });

  it("marks only open past-due tasks as overdue", () => {
    expect(dueInfo("2026-10-07", false, NOW)).toEqual({ label: "Overdue", overdue: true });
    expect(dueInfo("2026-10-07", true, NOW)).toEqual({ label: "7 Oct", overdue: false });
    expect(dueInfo("2026-10-14", false, NOW)).toEqual({ label: "Today", overdue: false });
    expect(dueInfo(null, false, NOW)).toEqual({ label: "", overdue: false });
  });

  it("labels message days and update days", () => {
    expect(dayHeading("2026-10-14T08:00:00Z", NOW)).toBe("Today");
    expect(dayHeading("2026-10-12T08:00:00Z", NOW)).toBe("Monday");
    expect(dayHeading("2026-09-30T08:00:00Z", NOW)).toBe("30 September");
    expect(whenLabel("2026-10-13T18:00:00Z", NOW)).toBe("Yesterday");
    expect(whenLabel("2025-12-24T10:00:00Z", NOW)).toBe("24 December 2025");
  });
});
