import { MILESTONES, type Asset, type DemoState, type Estate, type EstateDerived, type StageIndex, type Task, type WaitingOn } from "./types";
import { addDays, daysBetween, isoDay, longDay, monthShort, monthYear, shortDay } from "./format";

/**
 * Everything the screens show that is computed rather than stored.
 * Pure functions of the estate record and the current time, shared by the
 * demo build (browser) and the live build (server), and unit-tested.
 */

/** Stage = the first milestone not yet reached. With all seven reached, the estate sits at stage 7 (index 6), complete. */
export function stageOf(milestones: Estate["milestones"]): StageIndex {
  const i = MILESTONES.findIndex((k) => !milestones[k]);
  return (i === -1 ? 6 : i) as StageIndex;
}

export function isComplete(e: Pick<Estate, "milestones">): boolean {
  return MILESTONES.every((k) => Boolean(e.milestones[k]));
}

const openTasks = (e: Estate) => e.tasks.filter((t) => !t.done);
const isOverdue = (t: Task, today: string) => !t.done && t.dueOn !== null && daysBetween(today, t.dueOn) < 0;

const CATEGORY_TO_WAITING: Record<string, WaitingOn> = { bank: "bank", hmrc: "hmrc", registry: "registry", other: "bank" };

/** The open third-party task that matters most: overdue first, then the earliest due, then the oldest. */
function leadThirdParty(e: Estate, today: string): Task | undefined {
  const third = openTasks(e).filter((t) => t.owner.kind === "third");
  return third.sort((a, b) => {
    const ao = isOverdue(a, today) ? 0 : 1;
    const bo = isOverdue(b, today) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const ad = a.dueOn ?? "9999-12-31";
    const bd = b.dueOn ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  })[0];
}

function oldestFamilyTask(e: Estate): Task | undefined {
  return openTasks(e)
    .filter((t) => t.owner.kind === "family")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0];
}

function elapsed(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  return `${Math.floor(days / 7)} weeks`;
}

/** Who the estate is waiting on, from its open tasks: third parties first, then the family. */
export function waitingOf(e: Estate, now: Date = new Date()): WaitingOn {
  const today = isoDay(now);
  const lead = leadThirdParty(e, today);
  if (lead && lead.owner.kind === "third") return CATEGORY_TO_WAITING[lead.owner.category];
  if (oldestFamilyTask(e)) return "family";
  return "none";
}

/** One-line headline for cards: "Waiting on Barclays · 21 days, overdue". */
export function blockerOf(e: Estate, now: Date = new Date()): string {
  const today = isoDay(now);
  const lead = leadThirdParty(e, today);
  if (lead && lead.owner.kind === "third") {
    const who = lead.owner.label;
    if (isOverdue(lead, today)) return `Waiting on ${who} · ${elapsed(daysBetween(lead.createdAt, today))}, overdue`;
    if (lead.dueOn && lead.owner.category === "hmrc") {
      const left = daysBetween(today, lead.dueOn);
      return `Waiting on ${who} · reply due ${left === 0 ? "today" : `in ${left} day${left === 1 ? "" : "s"}`}`;
    }
    return `Waiting on ${who} · ${elapsed(daysBetween(lead.createdAt, today))}`;
  }
  const fam = oldestFamilyTask(e);
  if (fam && fam.owner.kind === "family") {
    const partyId = fam.owner.partyId;
    const p = e.parties.find((x) => x.id === partyId);
    const first = p?.name.split(" ")[0] ?? "the family";
    const what = fam.title.charAt(0).toLowerCase() + fam.title.slice(1);
    return `Waiting on ${first} · ${what}`;
  }
  return isComplete(e) ? "Complete" : "On track";
}

/** Needs attention: something overdue, an HMRC deadline within 14 days, or the family stuck for over four weeks. */
export function attentionOf(e: Estate, now: Date = new Date()): boolean {
  const today = isoDay(now);
  const open = openTasks(e);
  if (open.some((t) => isOverdue(t, today))) return true;
  if (open.some((t) => t.owner.kind === "third" && t.owner.category === "hmrc" && t.dueOn && daysBetween(today, t.dueOn) <= 14)) return true;
  const fam = oldestFamilyTask(e);
  if (fam && daysBetween(fam.createdAt, today) > 28) return true;
  return false;
}

export function deriveEstate(e: Omit<Estate, keyof EstateDerived> & Partial<EstateDerived>, now: Date = new Date()): Estate {
  const base = e as Estate;
  return {
    ...base,
    stage: stageOf(base.milestones),
    daysOpen: Math.max(0, daysBetween(base.openedAt, isoDay(now))),
    waitingOn: waitingOf(base, now),
    blocker: blockerOf(base, now),
    attention: attentionOf(base, now),
  };
}

/** Recompute derived fields on every estate (after load and after each action). */
export function deriveState(s: DemoState, now: Date = new Date()): DemoState {
  return { ...s, estates: s.estates.map((e) => deriveEstate(e, now)) };
}

// ── Holdings ────────────────────────────────────────────────────────────────

export interface AssetStatus {
  firm: string;
  client: string;
  tone: "teal" | "plum" | "amber" | "coral";
}

/** Status wording for the firm ledger and the family's portal, from the holding's state and dates. */
export function assetStatus(a: Asset, e: Estate, solicitorFirstName: string): AssetStatus {
  const checking = e.extractions.some((x) => x.status === "review" && x.assetId === a.id);
  if (a.liability) {
    return a.state === "confirmed"
      ? { firm: "Confirmed", client: "Paid from the estate later", tone: "teal" }
      : { firm: "To confirm", client: `${solicitorFirstName} will confirm`, tone: "amber" };
  }
  switch (a.state) {
    case "confirmed":
      return { firm: "Confirmed", client: "Confirmed", tone: "teal" };
    case "awaiting":
      return { firm: "Awaiting", client: `Waiting on ${a.institution || "them"}`, tone: "plum" };
    case "not_notified":
      return { firm: "Not notified", client: `${solicitorFirstName} will contact ${a.institution || "them"}`, tone: "coral" };
    case "estimate":
      if (checking) return { firm: "To check", client: `${solicitorFirstName} is checking`, tone: "amber" };
      if (a.nextAction === "valuation" && a.nextActionOn) return { firm: `Valuation ${shortDay(a.nextActionOn)}`, client: `Valuation on ${shortDay(a.nextActionOn)}`, tone: "amber" };
      if (a.addedBy === "family") return { firm: "Added by family", client: `${solicitorFirstName} will confirm`, tone: "amber" };
      return { firm: "Estimate", client: "Estimate for now", tone: "amber" };
  }
}

// ── Journey timing ──────────────────────────────────────────────────────────

/** Typical weeks per stage for a full administration (min, max). Refined from real averages in M5. */
export const STAGE_WEEKS: readonly [number, number][] = [
  [1, 3],
  [4, 8],
  [6, 8],
  [4, 8],
  [8, 16],
  [6, 10],
  [4, 8],
];

export const TYPICAL_MONTHS: [number, number] = [9, 12];

function monthWindow(from: string, to: string): string {
  const a = monthShort(from);
  const b = monthShort(to);
  return a === b ? a : `${a} to ${b}`;
}

/** Per-stage line for the client journey: "Done 2 June" / "Usually 6 to 8 weeks" / "Expected Oct to Nov". */
export function stageTiming(e: Estate, i: number, now: Date = new Date()): string {
  const key = MILESTONES[i];
  const reached = e.milestones[key];
  if (reached) return i === 6 ? "Complete" : `Done ${longDay(reached, now)}`;
  const [lo, hi] = STAGE_WEEKS[i];
  if (i === e.stage) return `Usually ${lo} to ${hi} weeks`;
  // Future stages: add typical durations from today.
  let min = 0;
  let max = 0;
  for (let j = e.stage; j < i; j++) {
    min += STAGE_WEEKS[j][0];
    max += STAGE_WEEKS[j][1];
  }
  const today = isoDay(now);
  return `Expected ${monthWindow(addDays(today, min * 7), addDays(today, (max + hi) * 7))}`;
}

/** Honest-timeline figures for the portal: start, expected end, months in, progress. */
export function journeyTimeline(e: Estate, now: Date = new Date()) {
  const start = isoDay(e.openedAt);
  const today = isoDay(now);
  const monthsIn = Math.max(0, Math.round(daysBetween(start, today) / 30.4));
  const [lo, hi] = TYPICAL_MONTHS;
  const end = addDays(start, Math.round(hi * 30.4));
  const pct = Math.min(95, Math.max(5, Math.round((daysBetween(start, today) / (((lo + hi) / 2) * 30.4)) * 100)));
  return { startLabel: monthYear(start), endLabel: monthYear(end), monthsIn, typical: `${lo} to ${hi} months`, pct };
}
