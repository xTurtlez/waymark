import { INTESTACY_SUPPORTED_FROM, SOURCES, statutoryLegacy } from "./tables";
import type { Disposition, Flag, IntestacyBranch, IntestacyFamily, ISODate, Line, Pence, Recipient } from "./types";
import { formatPounds } from "./util";

/**
 * Intestacy in England & Wales (Administration of Estates Act 1925, as
 * amended by the Inheritance and Trustees' Powers Act 2014). Deaths from
 * 1 October 2014.
 *
 * Order: spouse/civil partner (with issue: personal chattels, the statutory
 * legacy and half the rest; otherwise everything) → issue → parents → brothers
 * and sisters of the whole blood → of the half blood → grandparents → uncles
 * and aunts of the whole blood → of the half blood → the Crown. Classes marked
 * "branches" take on the statutory trusts: a person who died before the
 * deceased is represented by their own issue (per stirpes).
 */

export interface IntestacyShare {
  name: string;
  relationship: string;
  amountPence: Pence;
  /** "absolute" for the spouse and parents/grandparents; "statutory_trusts" for branch classes (vests at 18 or marriage). */
  basis: "absolute" | "statutory_trusts" | "bona_vacantia";
}

export interface IntestacyOutcome {
  shares: IntestacyShare[];
  lines: Line[];
  flags: Flag[];
}

const counts = (b: IntestacyBranch): boolean => b.alive || (b.descendants ?? []).some(counts);

/** Split `amount` equally between branches; a dead person's share goes down to their issue. Remainders go to the last share. */
function splitBranches(amount: Pence, branches: IntestacyBranch[], relationship: string, out: IntestacyShare[]): void {
  const live = branches.filter(counts);
  let given = 0;
  live.forEach((b, i) => {
    const share = i === live.length - 1 ? amount - given : Math.floor(amount / live.length);
    given += share;
    if (b.alive) out.push({ name: b.name, relationship, amountPence: share, basis: "statutory_trusts" });
    else splitBranches(share, b.descendants!, `${relationship} (through ${b.name})`, out); // counted, so it has issue
  });
}

function splitEqually(amount: Pence, names: string[], relationship: string, out: IntestacyShare[]): void {
  let given = 0;
  names.forEach((name, i) => {
    const share = i === names.length - 1 ? amount - given : Math.floor(amount / names.length);
    given += share;
    out.push({ name, relationship, amountPence: share, basis: "absolute" });
  });
}

/** Who takes when there is no spouse (or what's left after the spouse), and how. */
function nextOfKin(family: IntestacyFamily): { relationship: string; branches?: IntestacyBranch[]; names?: string[] } | null {
  if (family.issue.some(counts)) return { relationship: "Issue", branches: family.issue };
  if (family.parents.length) return { relationship: "Parent", names: family.parents };
  if (family.siblingsWhole.some(counts)) return { relationship: "Brother or sister", branches: family.siblingsWhole };
  if (family.siblingsHalf.some(counts)) return { relationship: "Half-brother or half-sister", branches: family.siblingsHalf };
  if (family.grandparents.length) return { relationship: "Grandparent", names: family.grandparents };
  if (family.auntsUnclesWhole.some(counts)) return { relationship: "Uncle or aunt", branches: family.auntsUnclesWhole };
  if (family.auntsUnclesHalf.some(counts)) return { relationship: "Half-uncle or half-aunt", branches: family.auntsUnclesHalf };
  return null;
}

const KIN_GROUP: Record<string, string> = {
  Issue: "Children and other descendants",
  Parent: "Parents",
  "Brother or sister": "Brothers and sisters",
  "Half-brother or half-sister": "Half-brothers and half-sisters",
  Grandparent: "Grandparents",
  "Uncle or aunt": "Uncles and aunts",
  "Half-uncle or half-aunt": "Half-uncles and half-aunts",
};

export function hasIssue(family: IntestacyFamily): boolean {
  return family.issue.some(counts);
}

export function distributeIntestacy(i: { dateOfDeath: ISODate; family: IntestacyFamily; netEstatePence: Pence; personalChattelsPence: Pence }): IntestacyOutcome {
  const shares: IntestacyShare[] = [];
  const lines: Line[] = [];
  const flags: Flag[] = [];
  if (i.dateOfDeath < INTESTACY_SUPPORTED_FROM) {
    flags.push({ code: "intestacy_pre_2014", level: "out_of_scope", message: "Intestacy before 1 October 2014 follows earlier rules, which aren't calculated here.", source: SOURCES.intestacy });
    return { shares, lines, flags };
  }
  const net = Math.max(0, i.netEstatePence);
  const { family } = i;
  let rest = net;

  if (family.spouseName) {
    if (!hasIssue(family)) {
      shares.push({ name: family.spouseName, relationship: "Spouse or civil partner", amountPence: net, basis: "absolute" });
      lines.push({ id: "intestacy:spouse", section: "estate", label: `${family.spouseName} takes the whole estate`, amountPence: net, op: "info", detail: "There are no children or other descendants.", source: SOURCES.intestacy });
      return { shares, lines, flags };
    }
    const legacy = statutoryLegacy(i.dateOfDeath).value;
    const chattels = Math.min(net, Math.max(0, i.personalChattelsPence));
    const afterChattels = net - chattels;
    const legacyPaid = Math.min(legacy, afterChattels);
    const remainder = afterChattels - legacyPaid;
    const halfSpouse = Math.floor(remainder / 2);
    const spouseTotal = chattels + legacyPaid + halfSpouse;
    shares.push({ name: family.spouseName, relationship: "Spouse or civil partner", amountPence: spouseTotal, basis: "absolute" });
    lines.push({
      id: "intestacy:spouse",
      section: "estate",
      label: `${family.spouseName}: personal chattels, statutory legacy and half the rest`,
      amountPence: spouseTotal,
      op: "info",
      detail: `Chattels ${formatPounds(chattels)}, statutory legacy ${formatPounds(legacyPaid)} (of ${formatPounds(legacy)}), half of ${formatPounds(remainder)}.`,
      source: SOURCES.intestacy,
    });
    rest = remainder - halfSpouse;
    if (rest === 0) return { shares, lines, flags };
  }

  const kin = nextOfKin(family);
  if (!kin) {
    shares.push({ name: "The Crown (bona vacantia)", relationship: "No entitled relatives", amountPence: rest, basis: "bona_vacantia" });
    flags.push({ code: "bona_vacantia", level: "confirm", message: "No relatives entitled under the intestacy rules were recorded, so the estate passes to the Crown. Confirm the family tree." });
  } else if (kin.branches) {
    splitBranches(rest, kin.branches, kin.relationship, shares);
  } else {
    splitEqually(rest, kin.names!, kin.relationship, shares);
  }
  for (const s of shares.slice(family.spouseName ? 1 : 0)) {
    lines.push({ id: `intestacy:${s.name}`, section: "estate", label: `${s.name} (${s.relationship})`, amountPence: s.amountPence, op: "info", detail: s.basis === "statutory_trusts" ? "On the statutory trusts: held until 18 or earlier marriage." : undefined, source: SOURCES.intestacy });
  }
  if (shares.some((s) => s.basis === "statutory_trusts")) {
    flags.push({ code: "statutory_trusts", level: "info", message: "Shares on the statutory trusts are held for anyone under 18 until they reach 18 or marry." });
  }
  return { shares, lines, flags };
}

/**
 * The intestacy rules expressed as dispositions, for the IHT calculation.
 * Tax falls only on the non-exempt part, so the residue is split before tax.
 */
export function intestacyAsDispositions(family: IntestacyFamily, dateOfDeath: ISODate, chattelAssetIds: string[]): { recipients: Recipient[]; dispositions: Disposition[]; flags: Flag[] } {
  const recipients: Recipient[] = [];
  const dispositions: Disposition[] = [];
  const flags: Flag[] = [];
  if (dateOfDeath < INTESTACY_SUPPORTED_FROM) {
    flags.push({ code: "intestacy_pre_2014", level: "out_of_scope", message: "Intestacy before 1 October 2014 follows earlier rules, which aren't calculated here.", source: SOURCES.intestacy });
  }
  const kin = nextOfKin(family);
  const kinRecipient: Recipient = kin
    ? { id: "intestacy:kin", name: KIN_GROUP[kin.relationship], category: kin.relationship === "Issue" ? "lineal_descendant" : "other" }
    : { id: "intestacy:crown", name: "The Crown (bona vacantia)", category: "other" };

  if (family.spouseName) {
    const spouse: Recipient = { id: "intestacy:spouse", name: family.spouseName, category: "spouse" };
    recipients.push(spouse);
    if (hasIssue(family)) {
      recipients.push(kinRecipient);
      chattelAssetIds.forEach((assetId, n) => dispositions.push({ kind: "specific", id: `intestacy:chattels:${n}`, assetId, recipientId: spouse.id }));
      dispositions.push({ kind: "pecuniary", id: "intestacy:legacy", amountPence: statutoryLegacy(dateOfDeath).value, recipientId: spouse.id });
      dispositions.push({ kind: "residue", id: "intestacy:residue:spouse", recipientId: spouse.id, shareBp: 5_000 });
      dispositions.push({ kind: "residue", id: "intestacy:residue:issue", recipientId: kinRecipient.id, shareBp: 5_000 });
    } else {
      dispositions.push({ kind: "residue", id: "intestacy:residue:spouse", recipientId: spouse.id, shareBp: 10_000 });
    }
  } else {
    recipients.push(kinRecipient);
    dispositions.push({ kind: "residue", id: "intestacy:residue", recipientId: kinRecipient.id, shareBp: 10_000 });
    if (!kin) flags.push({ code: "bona_vacantia", level: "confirm", message: "No relatives entitled under the intestacy rules were recorded, so the estate passes to the Crown. Confirm the family tree." });
  }
  return { recipients, dispositions, flags };
}
