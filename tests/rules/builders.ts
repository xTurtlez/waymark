import type { Disposition, EstateAsset, IhtInput, IntestacyFamily, Liability, LifetimeGift, Recipient } from "@/rules/types";

/** Pounds to pence. */
export const gbp = (pounds: number) => Math.round(pounds * 100);

export const R: Record<string, Recipient> = {
  spouse: { id: "spouse", name: "Spouse", category: "spouse" },
  son: { id: "son", name: "Son", category: "lineal_descendant" },
  daughter: { id: "daughter", name: "Daughter", category: "lineal_descendant" },
  daughter2: { id: "daughter2", name: "Second daughter", category: "lineal_descendant" },
  nephew: { id: "nephew", name: "Nephew", category: "other" },
  friend: { id: "friend", name: "Friend", category: "other" },
  charity: { id: "charity", name: "Hospice", category: "charity" },
};

export const asset = (id: string, kind: EstateAsset["kind"], pounds: number, extra: Partial<EstateAsset> = {}): EstateAsset => ({
  id,
  label: id,
  kind,
  valuePence: gbp(pounds),
  ...extra,
});

export const home = (pounds: number, extra: Partial<EstateAsset> = {}) => asset("home", "property", pounds, { qualifyingResidence: true, ...extra });
export const cash = (pounds: number, extra: Partial<EstateAsset> = {}) => asset("cash", "bank", pounds, extra);

export const debt = (id: string, pounds: number, extra: Partial<Liability> = {}): Liability => ({ id, label: id, amountPence: gbp(pounds), kind: "debt", ...extra });

export const residue = (recipientId: string, pct = 100): Disposition => ({ kind: "residue", id: `res:${recipientId}`, recipientId, shareBp: Math.round(pct * 100) });
export const legacy = (recipientId: string, pounds: number, bearsOwnTax = false): Disposition => ({
  kind: "pecuniary",
  id: `leg:${recipientId}:${pounds}`,
  recipientId,
  amountPence: gbp(pounds),
  bearsOwnTax,
});
export const specific = (assetId: string, recipientId: string, extra: { sharePct?: number; bearsOwnTax?: boolean } = {}): Disposition => ({
  kind: "specific",
  id: `spec:${assetId}:${recipientId}`,
  assetId,
  recipientId,
  shareBp: extra.sharePct === undefined ? undefined : Math.round(extra.sharePct * 100),
  bearsOwnTax: extra.bearsOwnTax,
});

export const gift = (id: string, madeOn: string, pounds: number, extra: Partial<LifetimeGift> = {}): LifetimeGift => ({
  id,
  label: id,
  madeOn,
  valuePence: gbp(pounds),
  recipientCategory: "lineal_descendant",
  form: "outright",
  ...extra,
});

export function estate(dateOfDeath: string, assets: EstateAsset[], dispositions: Disposition[], extra: Partial<IhtInput> = {}): IhtInput {
  return {
    dateOfDeath,
    longTermUkResident: true,
    recipients: Object.values(R),
    assets,
    liabilities: [],
    succession: { type: "will", dispositions },
    ...extra,
  };
}

export const noFamily = (): IntestacyFamily => ({
  issue: [],
  parents: [],
  siblingsWhole: [],
  siblingsHalf: [],
  grandparents: [],
  auntsUnclesWhole: [],
  auntsUnclesHalf: [],
});
