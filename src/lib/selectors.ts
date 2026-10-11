import { STAGES } from "./stages";
import type { DemoState, Estate, Party, StaffMember, Task, WaitingOn } from "./types";
import { money } from "./format";

/** Nil-rate band and residence nil-rate band (2026/27). Stored in pence. */
export const NRB_PENCE = 325_000_00;
export const RNRB_PENCE = 175_000_00;

export function staffById(state: DemoState, id: string): StaffMember | undefined {
  return state.staff.find((s) => s.id === id);
}

export function partyById(estate: Estate, id: string): Party | undefined {
  return estate.parties.find((p) => p.id === id);
}

export function clientParty(estate: Estate): Party {
  return partyById(estate, estate.clientPartyId) ?? estate.parties[0];
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}

export function feeEarner(state: DemoState, estate: Estate): StaffMember {
  return staffById(state, estate.feeEarnerId) ?? state.staff[0];
}

export function openFamilyTasks(estate: Estate): Task[] {
  return estate.tasks.filter((t) => !t.done && t.owner.kind === "family");
}

export function isThirdParty(w: WaitingOn): boolean {
  return w === "bank" || w === "hmrc" || w === "registry";
}

export function stageLabel(estate: Estate): string {
  return `${estate.stage + 1}. ${STAGES[estate.stage].long}`;
}

/** Who/what an actor id refers to, for audit trails. */
export function actor(state: DemoState, estate: Estate | undefined, id: string) {
  if (id === "ai") return { initials: "AI", name: "Assistant", color: "#5B2E57" };
  const s = staffById(state, id);
  if (s) return { initials: s.initials, name: s.name, color: s.color };
  const p = estate ? partyById(estate, id) : undefined;
  if (p) return { initials: p.initials, name: p.name, color: p.color };
  return { initials: "?", name: "Someone", color: "#7A6D63" };
}

export function totals(estate: Estate) {
  let owned = 0;
  let owed = 0;
  for (const a of estate.assets) {
    if (a.valuePence === null) continue;
    if (a.liability) owed += a.valuePence;
    else owned += a.valuePence;
  }
  return { owned, owed };
}

export function ihtPosition(estate: Estate) {
  const { owned, owed } = totals(estate);
  const debts = owed + estate.funeralEstimatePence;
  const net = owned - debts;
  const hasHome = estate.assets.some((a) => a.kind === "property" && !a.liability);
  const allowance = NRB_PENCE + (hasHome ? RNRB_PENCE : 0);
  const headroom = allowance - net;
  const pct = Math.max(0, Math.min(100, Math.round((net / allowance) * 100)));
  const taxDue = headroom < 0 ? Math.round(-headroom * 0.4) : 0;
  return { gross: owned, debts, net, allowance, headroom, pct, taxDue, hasHome };
}

export function pendingDrafts(state: DemoState) {
  return state.estates.flatMap((e) =>
    e.drafts.filter((d) => d.status === "review").map((d) => ({ estate: e, draft: d })),
  );
}

export function openTaskCount(state: DemoState): number {
  return state.estates.reduce((n, e) => n + e.tasks.filter((t) => !t.done && t.owner.kind !== "family").length, 0);
}

export function waitingCounts(state: DemoState) {
  const E = state.estates;
  return {
    family: E.filter((e) => e.waitingOn === "family" || openFamilyTasks(e).length > 0).length,
    bank: E.filter((e) => e.waitingOn === "bank").length,
    registry: E.filter((e) => e.waitingOn === "registry").length,
    hmrc: E.filter((e) => e.waitingOn === "hmrc").length,
  };
}

/** Plain summary of an estate, used by the assistant panel. */
export function estateSummary(state: DemoState, estate: Estate): { label: string; text: string }[] {
  const iht = ihtPosition(estate);
  const client = clientParty(estate);
  const fam = openFamilyTasks(estate);
  const blocked = estate.tasks.filter((t) => !t.done && (t.overdue || t.owner.kind === "third"));
  const nextFirm = estate.tasks.filter((t) => !t.done && t.owner.kind === "firm").slice(0, 3);
  const house = estate.assets.find((a) => a.kind === "property");
  const out: { label: string; text: string }[] = [];
  out.push({
    label: "",
    text:
      `Stage ${estate.stage + 1} of 7. ` +
      (iht.gross > 0
        ? `Gross estate about ${money(Math.round(iht.gross / 100_000) * 100_000).replace(",000", "k")}` +
          (house ? `, mostly ${house.name.split(",")[0]} (${house.firmStatus.charAt(0).toLowerCase() + house.firmStatus.slice(1)}). ` : ". ") +
          (iht.taxDue > 0 ? `IHT of roughly ${money(iht.taxDue)} likely.` : iht.hasHome ? "No IHT expected if RNRB applies." : "No IHT expected.")
        : "No assets recorded yet."),
  });
  if (blocked.length) out.push({ label: "Blocked", text: blocked.map((t) => t.title).join(". ") + "." });
  if (fam.length) out.push({ label: `With ${firstName(client.name)}`, text: fam.map((t) => t.title).join(", ") + "." });
  if (nextFirm.length) out.push({ label: "Next", text: nextFirm.map((t) => t.title.charAt(0).toLowerCase() + t.title.slice(1)).join(", then ") + "." });
  return out;
}
