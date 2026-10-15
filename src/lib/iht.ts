import { calculateIht, distributeIntestacy, type IntestacyOutcome } from "@/rules";
import type { AssetKind as RuleAssetKind, Disposition, EstateAsset, IhtInput, IhtResult, Liability, Recipient } from "@/rules/types";
import type { Asset, Estate, Party, TaxCategory, TaxProfile } from "./types";

/**
 * Turns an estate record into rules-engine input, and reports anything the
 * engine needs that hasn't been recorded yet. Shared by the live and demo
 * builds; never stores anything.
 */

export interface IhtGap {
  /** Blocking gaps stop the calculation; others are shown alongside it. */
  blocking: boolean;
  message: string;
}

export interface IhtView {
  input: IhtInput | null;
  result: IhtResult | null;
  gaps: IhtGap[];
  /** Assumptions made where the record was silent (e.g. tax category from relationship). */
  assumptions: string[];
  intestacy: IntestacyOutcome | null;
}

export const DEFAULT_TAX_PROFILE: TaxProfile = {
  longTermUkResident: true,
  spouseExemptionLimited: false,
  transferredNrbBp: 0,
  transferredRnrbBp: 0,
  residueBenham: false,
  mergeCharityComponents: false,
  confirmations: {},
  gifts: [],
  priorTransfers: [],
};

const SPOUSE = /\b(wife|husband|spouse|civil partner|widow(er)?)\b/i;
const DESCENDANT = /\b(son|daughter|child|children|grand(son|daughter|child)|step-?(son|daughter|child)|adopted|foster)\b/i;

/** Tax category for a party: recorded, or worked out from the relationship. */
export function taxCategoryOf(p: Party): { category: TaxCategory; assumed: boolean } {
  if (p.taxCategory) return { category: p.taxCategory, assumed: false };
  const rel = p.relationship ?? "";
  if (SPOUSE.test(rel)) return { category: "spouse", assumed: true };
  if (DESCENDANT.test(rel)) return { category: "lineal_descendant", assumed: true };
  return { category: "other", assumed: true };
}

export const TAX_CATEGORY_LABEL: Record<TaxCategory, string> = {
  spouse: "Spouse or civil partner",
  charity: "Charity",
  lineal_descendant: "Direct descendant",
  other: "Other",
};

const KIND: Record<Asset["kind"], RuleAssetKind> = {
  property: "property",
  bank: "bank",
  savings: "savings",
  bonds: "bonds",
  pension: "pension",
  investment: "listed_shares",
  credit: "other",
  utility: "other",
  other: "other",
};

/** Personal chattels (household and personal goods) are recorded as "other" holdings with a describing name. */
export function isChattels(a: Asset): boolean {
  return !a.liability && a.kind === "other" && /chattel|household|personal (goods|effects|possessions)|furniture|jewel/i.test(a.name);
}

export function ihtInputFor(estate: Estate): { input: IhtInput | null; gaps: IhtGap[]; assumptions: string[] } {
  const gaps: IhtGap[] = [];
  const assumptions: string[] = [];
  const profile = estate.tax ?? DEFAULT_TAX_PROFILE;

  if (!estate.deceased.dateOfDeath) gaps.push({ blocking: true, message: "Add the date of death: every rate and allowance depends on it." });

  // Recipients: family parties (staff are never beneficiaries).
  const recipients: Recipient[] = [];
  for (const p of estate.parties.filter((x) => !x.staffId)) {
    const { category, assumed } = taxCategoryOf(p);
    recipients.push({ id: p.id, name: p.name, category });
    if (assumed && category !== "other") assumptions.push(`${p.name} is treated as ${category === "spouse" ? "the spouse" : "a direct descendant"} (${p.relationship}).`);
  }

  // Assets and liabilities.
  const assets: EstateAsset[] = [];
  const liabilities: Liability[] = [];
  const unknown: string[] = [];
  for (const a of estate.assets) {
    const label = a.clientName && a.institution ? `${a.name} (${a.institution})` : a.name;
    if (a.valuePence === null) unknown.push(a.clientName ?? a.name);
    const value = a.valuePence ?? 0;
    const t = a.tax ?? {};
    if (a.liability) {
      liabilities.push({
        id: a.id,
        label,
        amountPence: value,
        kind: t.securedOnAssetId ? "mortgage" : "debt",
        securedOnAssetId: t.securedOnAssetId,
        deductible: t.deductible,
      });
      continue;
    }
    assets.push({
      id: a.id,
      label,
      kind: isChattels(a) ? "chattels" : KIND[a.kind],
      valuePence: value,
      ownership: t.ownership,
      survivorRecipientId: t.survivorPartyId,
      qualifyingResidence: t.qualifyingResidence,
      relief: t.relief,
      pension: a.kind === "pension" ? (t.pension ?? "unused_fund") : t.pension,
      pensionRecipientId: t.pensionRecipientPartyId,
      foreign: t.foreign,
    });
  }
  if (unknown.length) gaps.push({ blocking: false, message: `Not valued yet (counted as nil): ${unknown.join(", ")}.` });
  if (estate.funeralEstimatePence > 0) liabilities.push({ id: "funeral", label: "Funeral costs (estimate)", amountPence: estate.funeralEstimatePence, kind: "funeral" });
  if (!assets.length) gaps.push({ blocking: false, message: "No assets recorded yet." });

  // Succession: the will, or the intestacy rules.
  let succession: IhtInput["succession"] | null = null;
  if (estate.will) {
    const dispositions: Disposition[] = [];
    for (const g of estate.will.gifts) {
      if (g.kind === "specific") {
        if (!g.assetId) {
          gaps.push({ blocking: false, message: `Specific gift "${g.description}" isn't linked to a holding, so it's left in residue.` });
          continue;
        }
        dispositions.push({ kind: "specific", id: g.id, assetId: g.assetId, recipientId: g.beneficiaryPartyId ?? "", shareBp: g.shareBp, bearsOwnTax: g.bearsOwnTax });
      } else if (g.kind === "pecuniary") {
        dispositions.push({ kind: "pecuniary", id: g.id, amountPence: g.amountPence ?? 0, recipientId: g.beneficiaryPartyId ?? "", bearsOwnTax: g.bearsOwnTax });
      } else if (g.kind === "residuary") {
        dispositions.push({ kind: "residue", id: g.id, recipientId: g.beneficiaryPartyId ?? "", shareBp: g.shareBp ?? 0 });
      } else {
        gaps.push({ blocking: false, message: `"${g.description}" is a life interest; trusts under the will aren't calculated yet.` });
      }
    }
    succession = { type: "will", dispositions, residueBenham: profile.residueBenham };
  } else if (profile.intestacyFamily) {
    succession = { type: "intestacy", family: profile.intestacyFamily };
    assumptions.push("No will is recorded, so the estate is shown passing under the intestacy rules.");
  } else {
    gaps.push({ blocking: true, message: "Record the will, or the family for the intestacy rules, to see who inherits." });
  }

  if (gaps.some((g) => g.blocking) || !succession) return { input: null, gaps, assumptions };

  const live = <T extends { voided?: boolean }>(xs: T[]) => xs.filter((x) => !x.voided);
  const input: IhtInput = {
    dateOfDeath: estate.deceased.dateOfDeath!,
    longTermUkResident: profile.longTermUkResident,
    recipients,
    assets,
    liabilities,
    succession,
    lifetimeGifts: live(profile.gifts).map((g) => ({
      id: g.id,
      label: g.description,
      madeOn: g.madeOn,
      valuePence: g.valuePence,
      recipientCategory: g.recipientPartyId ? (recipients.find((r) => r.id === g.recipientPartyId)?.category ?? g.recipientCategory) : g.recipientCategory,
      form: g.form,
      lifetimeTaxPaidPence: g.lifetimeTaxPaidPence,
      smallGift: g.smallGift,
      weddingGift: g.weddingGift,
      normalExpenditure: g.normalExpenditure,
      relief: g.relief,
    })),
    transferredNrbBp: profile.transferredNrbBp,
    transferredRnrbBp: profile.transferredRnrbBp,
    spouseExemptionLimited: profile.spouseExemptionLimited,
    downsizing: profile.downsizing,
    reliefAllowanceTransferredPence: profile.reliefAllowanceTransferredPence,
    priorTransfers: live(profile.priorTransfers).map((p) => ({ ...p })),
    mergeCharityComponents: profile.mergeCharityComponents,
  };
  return { input, gaps, assumptions };
}

/** Everything the IHT screens need for one estate. */
export function ihtFor(estate: Estate): IhtView {
  const { input, gaps, assumptions } = ihtInputFor(estate);
  if (!input) return { input, result: null, gaps, assumptions, intestacy: null };
  const result = calculateIht(input);
  let intestacy: IntestacyOutcome | null = null;
  if (input.succession.type === "intestacy") {
    const chattels = estate.assets.filter(isChattels).reduce((n, a) => n + (a.valuePence ?? 0), 0);
    intestacy = distributeIntestacy({
      dateOfDeath: input.dateOfDeath,
      family: input.succession.family,
      netEstatePence: result.estate.netPence - result.estate.taxPence,
      personalChattelsPence: chattels,
    });
  }
  return { input, result, gaps, assumptions, intestacy };
}

/** Flags still needing a solicitor's confirmation. */
export function unconfirmedFlags(view: IhtView, profile: TaxProfile | undefined) {
  if (!view.result) return [];
  const done = profile?.confirmations ?? {};
  return view.result.flags.filter((f) => f.level === "confirm" && !done[f.code]);
}
