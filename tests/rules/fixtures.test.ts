import { describe, expect, it } from "vitest";
import { calculateIht } from "@/rules";
import { FIXTURES } from "./fixtures";

describe("rules engine: worked estates", () => {
  it("has at least 40 fixtures", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(40);
  });

  for (const f of FIXTURES) {
    it(f.name, () => {
      const r = calculateIht(f.input);
      const e = f.expect;
      const giftTax = r.gifts.reduce((n, g) => n + g.taxPence, 0);
      if (e.estateTax !== undefined) expect(r.estate.taxPence, "estate tax").toBe(e.estateTax);
      if (e.totalTax !== undefined) expect(r.totalTaxPence, "total tax").toBe(e.totalTax);
      if (e.giftTax !== undefined) expect(giftTax, "gift tax").toBe(e.giftTax);
      if (e.chargeable !== undefined) expect(r.estate.chargeablePence, "chargeable").toBe(e.chargeable);
      if (e.nrbAvailable !== undefined) expect(r.estate.nilRateBandAvailablePence, "NRB available").toBe(e.nrbAvailable);
      if (e.rnrb !== undefined) expect(r.estate.residenceNilRateBandPence, "RNRB").toBe(e.rnrb);
      if (e.downsizing !== undefined) expect(r.estate.downsizingAdditionPence, "downsizing addition").toBe(e.downsizing);
      if (e.lost !== undefined) expect(r.rnrb.lostRelievableAmountPence, "lost relievable amount").toBe(e.lost);
      if (e.adjustedAllowance !== undefined) expect(r.rnrb.adjustedAllowancePence, "adjusted allowance").toBe(e.adjustedAllowance);
      if (e.rateBp !== undefined) expect(r.estate.rateBp, "rate").toBe(e.rateBp);
      if (e.route !== undefined) expect(r.reporting.route, "reporting route").toBe(e.route);
      if (e.unusedNrbBp !== undefined) expect(r.transferable.nilRateBandBp, "unused NRB").toBe(e.unusedNrbBp);
      if (e.unusedRnrbBp !== undefined) expect(r.transferable.residenceNilRateBandBp, "unused RNRB").toBe(e.unusedRnrbBp);
      if (e.spouseExempt !== undefined) expect(r.estate.spouseExemptPence, "spouse exemption").toBe(e.spouseExempt);
      if (e.charityExempt !== undefined) expect(r.estate.charityExemptPence, "charity exemption").toBe(e.charityExempt);
      if (e.reliefs !== undefined) expect(r.estate.reliefsPence, "reliefs").toBe(e.reliefs);
      if (e.qsr !== undefined) expect(r.estate.quickSuccessionReliefPence, "QSR").toBe(e.qsr);
      if (e.excluded !== undefined) expect(r.estate.excludedPence, "excluded").toBe(e.excluded);
      if (e.dueOn !== undefined) expect(r.paymentDueOn, "due date").toBe(e.dueOn);
      if (e.complete !== undefined) expect(r.complete, "complete").toBe(e.complete);
      if (e.transferableRelief !== undefined) expect(r.transferable.reliefAllowancePence, "transferable relief allowance").toBe(e.transferableRelief);
      const codes = r.flags.map((x) => x.code);
      for (const c of e.flags ?? []) expect(codes, `flag ${c}`).toContain(c);
      for (const c of e.noFlags ?? []) expect(codes, `no flag ${c}`).not.toContain(c);
      if (e.schedules) expect(r.reporting.schedules.map((s) => s.form)).toEqual(e.schedules);
      for (const [ref, tax] of Object.entries(e.attribution ?? {})) {
        expect(r.attribution.find((a) => a.refId === ref)?.taxPence, `tax borne by ${ref}`).toBe(tax);
      }
      // Invariants that hold for every estate.
      expect(r.attribution.filter((a) => a.bucket !== "lifetime_gift").reduce((n, a) => n + a.taxPence, 0), "attribution adds up").toBe(r.estate.taxPence);
      expect(r.totalTaxPence).toBe(r.estate.taxPence + giftTax);
      for (const l of r.lines) expect(Number.isInteger(l.amountPence ?? 0), `${l.id} whole pence`).toBe(true);
    });
  }
});
