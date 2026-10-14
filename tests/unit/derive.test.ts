import { describe, expect, it } from "vitest";
import { assetStatus, attentionOf, blockerOf, deriveEstate, journeyTimeline, stageOf, stageTiming, waitingOf } from "@/lib/derive";
import { buildSeed } from "@/lib/seed";
import type { Estate, Task } from "@/lib/types";

const NOW = new Date("2026-10-14T09:00:00Z");
const seed = buildSeed(NOW);
const ellis = () => structuredClone(seed.estates.find((e) => e.id === "ellis")!);
const byId = (id: string) => seed.estates.find((e) => e.id === id)!;

const task = (over: Partial<Task>): Task => ({ id: "t", title: "Do something", owner: { kind: "firm", staffId: "s" }, dueOn: null, done: false, createdAt: "2026-10-01T09:00:00Z", ...over });
const blank = (over: Partial<Estate> = {}): Estate =>
  deriveEstate({ ...ellis(), tasks: [], milestones: {}, ...over } as Estate, NOW);

describe("stage", () => {
  it("is the first milestone not yet reached", () => {
    expect(stageOf({})).toBe(0);
    expect(stageOf({ registered: "2026-06-01" })).toBe(1);
    expect(stageOf({ registered: "2026-06-01", gathered: "2026-07-18" })).toBe(2);
    // A gap means the earlier stage is still open.
    expect(stageOf({ registered: "2026-06-01", valued: "2026-08-01" })).toBe(1);
    expect(stageOf({ registered: "a", gathered: "a", valued: "a", iht: "a", grant: "a", collected: "a", distributed: "a" })).toBe(6);
  });
});

describe("waiting on, blocker and attention", () => {
  it("prefers an overdue third party over the family", () => {
    const e = blank({
      tasks: [
        task({ id: "f", owner: { kind: "family", partyId: "p_sarah" }, title: "Find the will", createdAt: "2026-09-01T09:00:00Z" }),
        task({ id: "b", owner: { kind: "third", label: "Barclays", category: "bank" }, dueOn: "2026-10-07", createdAt: "2026-09-23T09:00:00Z" }),
      ],
    });
    expect(waitingOf(e, NOW)).toBe("bank");
    expect(blockerOf(e, NOW)).toBe("Waiting on Barclays · 3 weeks, overdue");
    expect(attentionOf(e, NOW)).toBe(true);
  });

  it("counts down to an HMRC deadline and flags it inside 14 days", () => {
    const e = blank({ tasks: [task({ owner: { kind: "third", label: "HMRC", category: "hmrc" }, dueOn: "2026-10-26", createdAt: "2026-09-26T09:00:00Z" })] });
    expect(waitingOf(e, NOW)).toBe("hmrc");
    expect(blockerOf(e, NOW)).toBe("Waiting on HMRC · reply due in 12 days");
    expect(attentionOf(e, NOW)).toBe(true);
    const later = blank({ tasks: [task({ owner: { kind: "third", label: "HMRC", category: "hmrc" }, dueOn: "2026-11-30" })] });
    expect(attentionOf(later, NOW)).toBe(false);
  });

  it("falls back to the family, then to on track", () => {
    const fam = blank({ tasks: [task({ owner: { kind: "family", partyId: "p_sarah" }, title: "Find the original will", createdAt: "2026-10-10T09:00:00Z" })] });
    expect(waitingOf(fam, NOW)).toBe("family");
    expect(blockerOf(fam, NOW)).toBe("Waiting on Sarah · find the original will");
    expect(attentionOf(fam, NOW)).toBe(false);
    const stuck = blank({ tasks: [task({ owner: { kind: "family", partyId: "p_sarah" }, createdAt: "2026-09-10T09:00:00Z" })] });
    expect(attentionOf(stuck, NOW)).toBe(true);
    const none = blank({ tasks: [task({})] });
    expect(waitingOf(none, NOW)).toBe("none");
    expect(blockerOf(none, NOW)).toBe("On track");
  });

  it("ignores finished tasks", () => {
    const e = blank({ tasks: [task({ owner: { kind: "third", label: "Barclays", category: "bank" }, dueOn: "2026-10-01", done: true, doneAt: "2026-10-02T09:00:00Z" })] });
    expect(waitingOf(e, NOW)).toBe("none");
    expect(attentionOf(e, NOW)).toBe(false);
  });
});

describe("the seeded caseload matches the design", () => {
  it("flags the same four estates as the v1 dashboard", () => {
    expect(seed.estates.filter((e) => e.attention).map((e) => e.id).sort()).toEqual(["asante", "ellis", "mehta", "whitfield"]);
  });
  it("derives stages, days open and blockers from dates", () => {
    const e = byId("ellis");
    expect(e.stage).toBe(2);
    expect(e.daysOpen).toBe(96);
    expect(e.waitingOn).toBe("bank");
    expect(e.blocker).toBe("Waiting on Barclays · 3 weeks, overdue");
    expect(byId("okafor").blocker).toBe("Waiting on Probate Registry · 6 weeks");
    expect(byId("reid").waitingOn).toBe("family");
    expect(byId("morgan").waitingOn).toBe("none");
  });
});

describe("holding status wording", () => {
  const e = byId("ellis");
  const get = (id: string) => assetStatus(e.assets.find((a) => a.id === id)!, e, "Priya");
  it("explains each state to the firm and the family", () => {
    expect(get("a_house")).toEqual({ firm: "Valuation 19 Oct", client: "Valuation on 19 Oct", tone: "amber" });
    expect(get("a_barclays")).toMatchObject({ firm: "Awaiting", client: "Waiting on Barclays" });
    expect(get("a_nationwide")).toMatchObject({ firm: "To check", client: "Priya is checking" });
    expect(get("a_pension")).toMatchObject({ firm: "Not notified", client: "Priya will contact Aviva" });
    expect(get("a_card")).toMatchObject({ firm: "Confirmed", client: "Paid from the estate later" });
  });
});

describe("journey timing", () => {
  const e = byId("ellis");
  it("shows done dates, the current stage and expected windows", () => {
    expect(stageTiming(e, 0, NOW)).toMatch(/^Done \d+ \w+$/);
    expect(stageTiming(e, 2, NOW)).toBe("Usually 6 to 8 weeks");
    expect(stageTiming(e, 3, NOW)).toMatch(/^Expected \w{3}( to \w{3})?$/);
  });
  it("computes the honest timeline from when the estate was opened", () => {
    const t = journeyTimeline(e, NOW);
    expect(t.monthsIn).toBe(3);
    expect(t.typical).toBe("9 to 12 months");
    expect(t.startLabel).toBe("Jul 2026");
    expect(t.pct).toBeGreaterThan(20);
    expect(t.pct).toBeLessThan(40);
  });
});
