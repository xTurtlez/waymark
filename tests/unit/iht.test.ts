import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ihtFor, ihtInputFor, taxCategoryOf, unconfirmedFlags } from "@/lib/iht";
import { reducer } from "@/lib/reducer";
import { buildSeed } from "@/lib/seed";
import { actionSchema, FAMILY_ACTIONS, STAFF_ONLY } from "@/server/action-schema";
import type { Estate } from "@/lib/types";

const NOW = new Date("2026-10-14T09:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const byId = (s: ReturnType<typeof buildSeed>, id: string) => s.estates.find((e) => e.id === id)!;

describe("estate → rules engine", () => {
  it("works out the seeded estates", () => {
    const s = buildSeed(NOW);
    const ellis = ihtFor(byId(s, "ellis"));
    expect(ellis.result?.totalTaxPence).toBe(0);
    expect(ellis.result?.reporting.route).toBe("excepted_low_value");

    const mehta = ihtFor(byId(s, "mehta"));
    expect(mehta.result?.totalTaxPence).toBe(305_200_00);
    expect(mehta.result?.reporting.route).toBe("iht400");

    const reid = ihtFor(byId(s, "reid"));
    expect(reid.input?.succession.type).toBe("intestacy");
    expect(reid.result?.totalTaxPence).toBe(0);
    const shares = Object.fromEntries(reid.intestacy!.shares.map((x) => [x.name, x.amountPence]));
    expect(shares["Moira Reid"]).toBe(410_500_00);
    // Whatever isn't the spouse's goes to the children equally, and nothing is lost.
    const total = reid.intestacy!.shares.reduce((n, x) => n + x.amountPence, 0);
    expect(total).toBe(reid.result!.estate.netPence - reid.result!.estate.taxPence);
  });

  it("explains what's missing instead of guessing", () => {
    const s = buildSeed(NOW);
    const e: Estate = structuredClone(byId(s, "ellis"));
    e.deceased.dateOfDeath = null;
    const v = ihtInputFor(e);
    expect(v.input).toBeNull();
    expect(v.gaps.some((g) => g.blocking && /date of death/.test(g.message))).toBe(true);

    const noWill: Estate = structuredClone(byId(s, "ellis"));
    noWill.will = undefined;
    noWill.tax = { ...noWill.tax!, intestacyFamily: undefined };
    expect(ihtInputFor(noWill).gaps.some((g) => g.blocking && /intestacy/.test(g.message))).toBe(true);

    const unvalued: Estate = structuredClone(byId(s, "ellis"));
    unvalued.assets[0].valuePence = null;
    const u = ihtInputFor(unvalued);
    expect(u.input).not.toBeNull();
    expect(u.gaps.some((g) => !g.blocking && /Not valued yet/.test(g.message))).toBe(true);
  });

  it("infers tax categories from relationships and says so", () => {
    const base = { id: "p", name: "A", initials: "A", color: "#000", role: "beneficiary" as const };
    expect(taxCategoryOf({ ...base, relationship: "wife" })).toEqual({ category: "spouse", assumed: true });
    expect(taxCategoryOf({ ...base, relationship: "granddaughter" })).toEqual({ category: "lineal_descendant", assumed: true });
    expect(taxCategoryOf({ ...base, relationship: "friend" })).toEqual({ category: "other", assumed: true });
    expect(taxCategoryOf({ ...base, relationship: "wife", taxCategory: "other" })).toEqual({ category: "other", assumed: false });
  });
});

describe("IHT actions", () => {
  it("records tax facts with an audit entry each", () => {
    let s = buildSeed(NOW);
    const audit0 = byId(s, "mehta").audit.length;
    s = reducer(s, { type: "updateTaxProfile", estateId: "mehta", patch: { transferredNrbBp: 5000, downsizing: null } });
    s = reducer(s, { type: "addLifetimeGift", estateId: "mehta", gift: { description: "Car", madeOn: "2025-01-01", valuePence: 20_000_00, recipientCategory: "other", form: "outright" } });
    s = reducer(s, { type: "addPriorTransfer", estateId: "mehta", transfer: { label: "Estate of J", transferOn: "2024-01-01", netIncreasePence: 100_000_00, grossTransferPence: 150_000_00, taxPaidPence: 50_000_00 } });
    const m = byId(s, "mehta");
    expect(m.tax!.transferredNrbBp).toBe(5000);
    expect(m.tax!.gifts.map((g) => g.madeOn)).toEqual([...m.tax!.gifts.map((g) => g.madeOn)].sort());
    expect(m.tax!.priorTransfers).toHaveLength(1);
    expect(m.audit.length).toBe(audit0 + 3);
  });

  it("voids rather than deletes, and voided records leave the calculation", () => {
    let s = buildSeed(NOW);
    const before = ihtFor(byId(s, "mehta")).result!.totalTaxPence;
    const gift = byId(s, "mehta").tax!.gifts[0];
    s = reducer(s, { type: "voidLifetimeGift", estateId: "mehta", giftId: gift.id });
    const m = byId(s, "mehta");
    expect(m.tax!.gifts.find((g) => g.id === gift.id)?.voided).toBe(true);
    expect(ihtFor(m).result!.totalTaxPence).not.toBe(before);
  });

  it("allows only one home for the residence nil-rate band", () => {
    let s = buildSeed(NOW);
    const second = byId(s, "ellis").assets.find((a) => !a.liability && !a.tax?.qualifyingResidence)!;
    s = reducer(s, { type: "setAssetTax", estateId: "ellis", assetId: second.id, tax: { qualifyingResidence: true } });
    expect(byId(s, "ellis").assets.filter((a) => a.tax?.qualifyingResidence).map((a) => a.id)).toEqual([second.id]);
  });

  it("keeps a confirmation only for the wording that was confirmed", () => {
    let s = buildSeed(NOW);
    const view = ihtFor(byId(s, "ellis"));
    const flags = unconfirmedFlags(view, byId(s, "ellis").tax);
    expect(flags.length).toBeGreaterThan(0);
    s = reducer(s, { type: "confirmIhtFlag", estateId: "ellis", code: flags[0].code, message: flags[0].message });
    const e = byId(s, "ellis");
    expect(e.tax!.confirmations[flags[0].code]).toMatchObject({ by: s.currentStaffId, message: flags[0].message });
    expect(unconfirmedFlags(ihtFor(e), e.tax).length).toBe(flags.length - 1);
  });

  it("validates IHT actions and keeps them staff-only", () => {
    const ok = [
      { type: "updateTaxProfile", estateId: "ellis", patch: { transferredNrbBp: 10000 } },
      { type: "setPartyTaxCategory", estateId: "ellis", partyId: "p_sarah", category: "lineal_descendant" },
      { type: "setAssetTax", estateId: "ellis", assetId: "a_house", tax: { qualifyingResidence: true } },
      { type: "addLifetimeGift", estateId: "ellis", gift: { description: "Cash", madeOn: "2024-05-01", valuePence: 1000, recipientCategory: "other", form: "outright" } },
      { type: "confirmIhtFlag", estateId: "ellis", code: "excepted_tnrb", message: "x" },
    ];
    for (const a of ok) expect(actionSchema.safeParse(a).success, a.type).toBe(true);
    for (const a of ok) {
      expect(STAFF_ONLY.has(a.type)).toBe(true);
      expect(FAMILY_ACTIONS.has(a.type)).toBe(false);
    }
    expect(actionSchema.safeParse({ type: "updateTaxProfile", estateId: "ellis", patch: { transferredNrbBp: 10001 } }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "updateTaxProfile", estateId: "ellis", patch: { other: 1 } }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "addLifetimeGift", estateId: "ellis", gift: { description: "Cash", madeOn: "2024-02-30", valuePence: 1000, recipientCategory: "other", form: "outright" } }).success).toBe(false);
  });
});
