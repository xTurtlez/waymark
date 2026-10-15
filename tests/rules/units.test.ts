import { describe, expect, it } from "vitest";
import {
  addYears,
  applyBp,
  assessLifetimeGifts,
  calculateIht,
  computeRnrb,
  deathEstateReliefs,
  distributeIntestacy,
  endOfSixthMonthAfter,
  formatBp,
  formatPounds,
  grossUp,
  isValidDate,
  isWithinSevenYears,
  prorate,
  quickSuccessionRelief,
  ratioBp,
  reportingRoute,
  rulesFor,
  schedulesFor,
  statutoryLegacy,
  taxYearOf,
  yearsBand,
} from "@/rules";
import { nilRateBandAt, residenceNilRateBandAt } from "@/rules/tables";
import type { EstateAsset, IntestacyFamily } from "@/rules/types";
import { asset, cash, estate, gbp, gift, home, legacy, noFamily, residue, specific } from "./builders";

describe("util", () => {
  it("formats money and percentages", () => {
    expect(formatPounds(gbp(1_234_567))).toBe("£1,234,567");
    expect(formatPounds(-1_050)).toBe("−£10.50");
    expect(formatPounds(1_205)).toBe("£12.05");
    expect(formatBp(4_000)).toBe("40%");
    expect(formatBp(6_250)).toBe("62.50%");
  });
  it("rounds and guards division", () => {
    expect(applyBp(5, 5_000)).toBe(3);
    expect(prorate(100, 1, 0)).toBe(0);
    expect(ratioBp(1, 0)).toBe(0);
    expect(ratioBp(3, 2)).toBe(10_000);
    expect(ratioBp(3, 2, 20_000)).toBe(15_000);
  });
  it("validates dates", () => {
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2023-02-29")).toBe(false);
    expect(isValidDate("2023-13-01")).toBe(false);
    expect(isValidDate("2023-1-01")).toBe(false);
    expect(() => addYears("nope", 1)).toThrow("Invalid date");
  });
  it("handles anniversaries, tax years and the IHT due date", () => {
    expect(addYears("2020-02-29", 1)).toBe("2021-03-01");
    expect(addYears("2020-02-29", 4)).toBe("2024-02-29");
    expect(addYears("2021-06-30", 7)).toBe("2028-06-30");
    expect(taxYearOf("2024-04-05")).toBe(2023);
    expect(taxYearOf("2024-04-06")).toBe(2024);
    expect(taxYearOf("2024-03-31")).toBe(2023);
    expect(endOfSixthMonthAfter("2026-05-14")).toBe("2026-11-30");
    expect(endOfSixthMonthAfter("2025-08-15")).toBe("2026-02-28");
    expect(endOfSixthMonthAfter("2027-08-31")).toBe("2028-02-29");
    expect(endOfSixthMonthAfter("2025-12-01")).toBe("2026-06-30");
  });
  it("uses statutory year bands", () => {
    expect(yearsBand("2020-01-01", "2021-01-01")).toBe(0);
    expect(yearsBand("2020-01-01", "2021-01-02")).toBe(1);
    expect(yearsBand("2020-01-01", "2020-06-01")).toBe(0);
    expect(isWithinSevenYears("2019-05-14", "2026-05-14")).toBe(false);
    expect(isWithinSevenYears("2019-05-15", "2026-05-14")).toBe(true);
  });
});

describe("rule tables", () => {
  it("selects figures by date of death", () => {
    expect(residenceNilRateBandAt("2017-04-05")).toBe(gbp(100_000)); // before the first row: earliest row
    expect(residenceNilRateBandAt("2019-04-06")).toBe(gbp(150_000));
    expect(nilRateBandAt("2026-01-01")).toBe(gbp(325_000));
    expect(rulesFor("2026-04-05").reliefAllowance.value).toBeNull();
    expect(rulesFor("2026-04-06").reliefAllowance.value).toBe(gbp(2_500_000));
    expect(rulesFor("2027-04-05").pensionsInEstate.value).toBe(false);
    expect(rulesFor("2027-04-06").pensionsInEstate.value).toBe(true);
    expect(rulesFor("2021-12-31").excepted.value.regime).toBe("pre_2022");
    expect(statutoryLegacy("2023-07-25").value).toBe(gbp(270_000));
    expect(statutoryLegacy("2023-07-26").value).toBe(gbp(322_000));
  });
});

describe("intestacy distribution", () => {
  const fam = (f: Partial<IntestacyFamily>): IntestacyFamily => ({ ...noFamily(), ...f });
  const run = (f: Partial<IntestacyFamily>, net: number, chattels = 0, dateOfDeath = "2026-01-10") =>
    distributeIntestacy({ dateOfDeath, family: fam(f), netEstatePence: gbp(net), personalChattelsPence: gbp(chattels) });
  const amounts = (o: ReturnType<typeof run>) => Object.fromEntries(o.shares.map((s) => [s.name, s.amountPence]));

  it("spouse and two children", () => {
    const o = run({ spouseName: "Ann", issue: [{ name: "Ben", alive: true }, { name: "Cara", alive: true }] }, 822_000, 22_000);
    // £22k chattels + £322k + half of £478k (£239k) = £583k; children share £239k.
    expect(amounts(o)).toEqual({ Ann: gbp(583_000), Ben: gbp(119_500), Cara: gbp(119_500) });
    expect(o.flags.map((f) => f.code)).toContain("statutory_trusts");
  });
  it("spouse takes everything when the estate is within the statutory legacy", () => {
    const o = run({ spouseName: "Ann", issue: [{ name: "Ben", alive: true }] }, 200_000, 10_000);
    expect(amounts(o)).toEqual({ Ann: gbp(200_000) });
  });
  it("uses the statutory legacy for the date of death", () => {
    const o = run({ spouseName: "Ann", issue: [{ name: "Ben", alive: true }] }, 370_000, 0, "2021-03-01");
    // £270k legacy + half of £100k.
    expect(amounts(o)).toEqual({ Ann: gbp(320_000), Ben: gbp(50_000) });
  });
  it("spouse with no issue takes all", () => {
    expect(amounts(run({ spouseName: "Ann", parents: ["Mum"] }, 500_000))).toEqual({ Ann: gbp(500_000) });
  });
  it("represents a child who died before, ignores one who left no issue", () => {
    const o = run(
      {
        issue: [
          { name: "Ben", alive: true },
          { name: "Cara", alive: false, descendants: [{ name: "Dot", alive: true }, { name: "Eve", alive: true }] },
          { name: "Finn", alive: false },
        ],
      },
      100_001,
    );
    expect(amounts(o)).toEqual({ Ben: 5_000_050, Dot: 2_500_025, Eve: 2_500_025 });
    expect(o.shares.find((s) => s.name === "Dot")!.relationship).toContain("through Cara");
  });
  it("follows the statutory order", () => {
    expect(amounts(run({ parents: ["Mum", "Dad"] }, 100_000))).toEqual({ Mum: gbp(50_000), Dad: gbp(50_000) });
    expect(amounts(run({ siblingsWhole: [{ name: "Gil", alive: true }], siblingsHalf: [{ name: "Hal", alive: true }] }, 100_000))).toEqual({ Gil: gbp(100_000) });
    expect(amounts(run({ siblingsHalf: [{ name: "Hal", alive: true }] }, 100_000))).toEqual({ Hal: gbp(100_000) });
    expect(amounts(run({ grandparents: ["Nan"] }, 100_000))).toEqual({ Nan: gbp(100_000) });
    expect(amounts(run({ auntsUnclesWhole: [{ name: "Ivy", alive: true }] }, 100_000))).toEqual({ Ivy: gbp(100_000) });
    expect(amounts(run({ auntsUnclesHalf: [{ name: "Jo", alive: true }] }, 100_000))).toEqual({ Jo: gbp(100_000) });
  });
  it("passes to the Crown when there is nobody", () => {
    const o = run({}, 100_000);
    expect(o.shares[0].basis).toBe("bona_vacantia");
    expect(o.flags.map((f) => f.code)).toContain("bona_vacantia");
  });
  it("flags deaths before 1 October 2014", () => {
    const o = run({ spouseName: "Ann" }, 100_000, 0, "2014-09-30");
    expect(o.shares).toEqual([]);
    expect(o.flags[0].code).toBe("intestacy_pre_2014");
  });
  it("treats a negative net estate as nil", () => {
    expect(amounts(run({ spouseName: "Ann" }, -5_000))).toEqual({ Ann: 0 });
  });
});

describe("intestacy in the IHT calculation", () => {
  it("passes to the Crown and flags it", () => {
    const r = calculateIht(estate("2026-01-10", [cash(100_000)], [], { succession: { type: "intestacy", family: noFamily() } }));
    expect(r.flags.map((f) => f.code)).toContain("bona_vacantia");
  });
  it("flags intestacy before October 2014", () => {
    const r = calculateIht(estate("2014-06-01", [cash(100_000)], [], { succession: { type: "intestacy", family: { ...noFamily(), spouseName: "Ann" } } }));
    expect(r.flags.map((f) => f.code)).toEqual(expect.arrayContaining(["intestacy_pre_2014", "death_before_2017"]));
    expect(r.complete).toBe(false);
  });
});

describe("lifetime gifts", () => {
  const ctx = { dateOfDeath: "2026-06-01", bandPence: gbp(325_000), spouseCapPence: null, reliefAllowancePence: null };
  it("exempts gifts to a spouse and to charity", () => {
    const o = assessLifetimeGifts([gift("s", "2025-01-01", 50_000, { recipientCategory: "spouse" }), gift("c", "2025-02-01", 20_000, { recipientCategory: "charity" })], ctx);
    expect(o.results.map((r) => r.chargeablePence)).toEqual([0, 0]);
    expect(o.specifiedExemptTransfersPence).toBe(gbp(70_000));
  });
  it("caps gifts to a non-resident spouse", () => {
    const o = assessLifetimeGifts([gift("s", "2025-01-01", 400_000, { recipientCategory: "spouse" })], { ...ctx, spouseCapPence: gbp(325_000) });
    expect(o.results[0].chargeablePence).toBe(gbp(75_000) - gbp(6_000));
    expect(o.spouseCapUsedPence).toBe(gbp(325_000));
    expect(o.flags.map((f) => f.code)).toContain("spouse_cap_gift");
  });
  it("ignores gifts on or after death", () => {
    const o = assessLifetimeGifts([gift("late", "2026-06-01", 10_000)], ctx);
    expect(o.results).toEqual([]);
    expect(o.flags[0].code).toBe("gift_after_death");
  });
  it("withdraws relief that no longer qualifies and applies 50% relief", () => {
    const o = assessLifetimeGifts(
      [
        gift("lost", "2024-11-01", 100_000, { relief: { kind: "business", rate: "full", stillQualifiesAtDeath: false } }),
        gift("half", "2025-11-01", 100_000, { relief: { kind: "agricultural", rate: "half", stillQualifiesAtDeath: true } }),
      ],
      ctx,
    );
    expect(o.results[0].reliefPence).toBe(0);
    expect(o.results[1].reliefPence).toBe(gbp(50_000));
    expect(o.flags.map((f) => f.code)).toContain("gift_relief_lost");
  });
  it("applies 100% relief with no cap for deaths before April 2026", () => {
    const o = assessLifetimeGifts([gift("full", "2025-01-01", 3_000_000, { relief: { kind: "business", rate: "full", stillQualifiesAtDeath: true } })], ctx);
    expect(o.results[0].reliefPence).toBe(gbp(3_000_000));
    expect(o.reliefAllowanceUsedPence).toBe(0);
  });
  it("splits relief at the allowance and orders same-day gifts as entered", () => {
    const o = assessLifetimeGifts(
      [
        gift("a", "2025-01-01", 2_000_000, { relief: { kind: "business", rate: "full", stillQualifiesAtDeath: true } }),
        gift("b", "2025-01-01", 1_000_000, { relief: { kind: "business", rate: "full", stillQualifiesAtDeath: true } }),
      ],
      { ...ctx, dateOfDeath: "2026-09-01", reliefAllowancePence: gbp(2_500_000) },
    );
    expect(o.results.map((r) => r.reliefPence)).toEqual([gbp(2_000_000), gbp(500_000) + gbp(250_000)]);
    expect(o.reliefAllowanceUsedPence).toBe(gbp(2_500_000));
  });
  it("treats an outright gift more than 7 years before death as exempt but a trust gift as cumulating", () => {
    const o = assessLifetimeGifts([gift("old", "2015-01-01", 100_000), gift("oldtrust", "2016-01-01", 100_000, { form: "trust" })], ctx);
    expect(o.againstBandPence).toBe(0);
    expect(o.taxPence).toBe(0);
    expect(o.trustGiftWithinSevenYears).toBe(false);
  });
  it("notes a recent trust gift for the excepted-estate test", () => {
    const o = assessLifetimeGifts([gift("t", "2024-01-01", 100_000, { form: "trust" })], ctx);
    expect(o.trustGiftWithinSevenYears).toBe(true);
    expect(o.specifiedTransfersPence).toBe(0);
  });
});

describe("residence nil-rate band", () => {
  const base = {
    dateOfDeath: "2026-01-01",
    residentialEnhancementPence: gbp(175_000),
    transferredRnrbBp: 0,
    taperThresholdPence: gbp(2_000_000),
    taperValuePence: gbp(500_000),
    residencePence: gbp(300_000),
    residenceCloselyInheritedPence: gbp(300_000),
    otherCloselyInheritedPence: 0,
  };
  it("ignores downsizing outside the dates", () => {
    const early = computeRnrb({ ...base, downsizing: { disposedOn: "2015-07-07", formerResidenceValuePence: gbp(500_000) } });
    expect(early.flags[0].code).toBe("downsizing_date");
    const after = computeRnrb({ ...base, downsizing: { disposedOn: "2026-02-01", formerResidenceValuePence: gbp(500_000) } });
    expect(after.downsizingAdditionPence).toBe(0);
  });
  it("gives no addition when nothing is closely inherited", () => {
    const r = computeRnrb({ ...base, residencePence: 0, residenceCloselyInheritedPence: 0, downsizing: { disposedOn: "2019-01-01", formerResidenceValuePence: gbp(500_000) } });
    expect(r.lostRelievableAmountPence).toBe(gbp(175_000));
    expect(r.downsizingAdditionPence).toBe(0);
  });
  it("gives no lost allowance when the home at death is worth more than the former home", () => {
    const r = computeRnrb({ ...base, downsizing: { disposedOn: "2019-01-01", formerResidenceValuePence: gbp(50_000) } });
    expect(r.lostRelievableAmountPence).toBe(0);
  });
  it("measures downsizing against the tapered allowance (HMRC IHTM46067 example 1)", () => {
    // £2.1m estate: £175k less £50k = £125k; lost 100% × £125k.
    const r = computeRnrb({ ...base, taperValuePence: gbp(2_100_000), residencePence: 0, residenceCloselyInheritedPence: 0, otherCloselyInheritedPence: gbp(500_000), downsizing: { disposedOn: "2020-06-01", formerResidenceValuePence: gbp(400_000) } });
    expect(r.adjustedAllowancePence).toBe(gbp(125_000));
    expect(r.lostRelievableAmountPence).toBe(gbp(125_000));
    expect(r.flags.map((f) => f.code)).toContain("downsizing_taper");
  });
  it("describes a home only partly closely inherited", () => {
    const r = computeRnrb({ ...base, residenceCloselyInheritedPence: gbp(100_000) });
    expect(r.residenceAmountPence).toBe(gbp(100_000));
    expect(r.lines.find((l) => l.id === "rnrb:home")!.detail).toContain("of the home's net value");
  });
});

describe("death estate reliefs", () => {
  it("shares the 100% slice across assets and notes the cap", () => {
    const o = deathEstateReliefs(
      [
        { id: "a", label: "Farm", netPence: gbp(2_000_000), relief: { kind: "agricultural", rate: "full" } },
        { id: "b", label: "Company", netPence: gbp(1_000_000), relief: { kind: "business", rate: "full" } },
        { id: "c", label: "Nothing", netPence: 0, relief: { kind: "business", rate: "full" } },
        { id: "d", label: "Cash", netPence: gbp(5) },
      ],
      gbp(2_500_000),
    );
    // £2.5m at 100% + £500k at 50% = £2.75m, shared 2:1.
    expect(o.byAsset.get("a")).toBe(prorate(gbp(2_750_000), 2, 3));
    expect(o.byAsset.get("b")).toBe(gbp(2_750_000) - prorate(gbp(2_750_000), 2, 3));
    expect(o.totalPence).toBe(gbp(2_750_000));
    expect(o.lines.map((l) => l.id)).toContain("relief:allowance");
    expect(o.lines[0].label).toContain("Agricultural");
  });
});

describe("quick succession relief", () => {
  it("gives nothing for a transfer dated after the death", () => {
    const o = quickSuccessionRelief([{ id: "x", label: "x", transferOn: "2027-01-01", netIncreasePence: 100, grossTransferPence: 100, taxPaidPence: 100 }], "2026-01-01");
    expect(o.reliefPence).toBe(0);
  });
});

describe("reporting", () => {
  const base = {
    dateOfDeath: "2026-01-01",
    limits: rulesFor("2026-01-01").excepted.value,
    nilRateBandPence: gbp(325_000),
    transferredNrbBp: 0,
    longTermUkResident: true,
    grossPence: gbp(300_000),
    netPence: gbp(300_000),
    spouseExemptPence: 0,
    charityExemptPence: 0,
    specifiedTransfersPence: 0,
    specifiedExemptTransfersPence: 0,
    foreignPence: 0,
    hasSettledProperty: false,
    hasGiftWithReservation: false,
    trustGiftWithinSevenYears: false,
    pensionsInEstate: false,
    hasEstatePension: false,
    taxPence: 0,
  };
  it("lists every reason an estate isn't excepted", () => {
    const o = reportingRoute({ ...base, longTermUkResident: false, foreignPence: gbp(200_000), specifiedTransfersPence: gbp(300_000), hasSettledProperty: true, hasGiftWithReservation: true, trustGiftWithinSevenYears: true, taxPence: 1 });
    expect(o.route).toBe("iht400");
    for (const s of ["long-term UK resident", "foreign assets", "gifts in the 7 years", "trust (settled)", "reservation", "gift into trust", "tax is payable"]) expect(o.reasons[0]).toContain(s);
  });
  it("doubles the low-value threshold with a full transferred NRB", () => {
    const o = reportingRoute({ ...base, grossPence: gbp(600_000), netPence: gbp(600_000), transferredNrbBp: 10_000 });
    expect(o.route).toBe("excepted_low_value");
    expect(o.flags[0].code).toBe("excepted_tnrb");
  });
  it("explains why a large estate isn't excepted", () => {
    expect(reportingRoute({ ...base, grossPence: gbp(4_000_000), netPence: gbp(4_000_000) }).reasons[0]).not.toContain("after spouse");
    expect(reportingRoute({ ...base, grossPence: gbp(1_000_000), netPence: gbp(1_000_000), spouseExemptPence: gbp(100_000) }).reasons[0]).toContain("after spouse");
  });
  it("names every schedule", () => {
    const all: EstateAsset[] = [
      asset("a", "property", 1, { ownership: "tenancy_in_common", foreign: true, settled: true }),
      asset("b", "chattels", 1),
      asset("c", "life_policy", 1),
      asset("d", "listed_shares", 1),
      asset("e", "agricultural", 1),
      asset("f", "business", 1),
      asset("g", "debt_due", 1),
      asset("h", "pension", 1),
      asset("i", "unlisted_shares", 1),
      asset("j", "savings", 1),
      asset("k", "other", 1, { relief: { kind: "agricultural", rate: "half" } }),
    ];
    const forms = schedulesFor({ assets: all, hasDebts: true, hasGifts: true, transferredNrb: true, transferredRnrb: true, claimsRnrb: true, charityRate: true }).map((s) => s.form);
    expect(forms).toEqual(["IHT402", "IHT403", "IHT404", "IHT405", "IHT406", "IHT407", "IHT409", "IHT410", "IHT411", "IHT412", "IHT413", "IHT414", "IHT416", "IHT417", "IHT418", "IHT419", "IHT430", "IHT435", "IHT436"]);
  });
});

describe("calculation edges", () => {
  it("rejects an invalid date of death", () => {
    expect(() => calculateIht(estate("2026-02-30", [], []))).toThrow("Invalid date of death");
  });
  it("grosses up only above the band", () => {
    expect(grossUp(gbp(100), gbp(200), 4_000)).toBe(gbp(100));
    expect(grossUp(gbp(400_000), gbp(325_000), 4_000)).toBe(gbp(450_000));
  });
  it("treats unknown recipients as chargeable", () => {
    const r = calculateIht(
      estate("2026-02-01", [cash(400_000), asset("joint", "bank", 50_000, { ownership: "joint_tenancy" })], [legacy("ghost", 10_000), residue("nobody")]),
    );
    expect(r.flags.map((f) => f.code)).toEqual(expect.arrayContaining(["recipient_missing:joint", "recipient_missing:Residue"]));
    expect(r.estate.chargeablePence).toBe(gbp(450_000));
  });
  it("reports each problem once", () => {
    const r = calculateIht(estate("2026-02-01", [home(300_000)], [specific("home", "ghost"), residue("son")]));
    expect(r.flags.filter((f) => f.code === "recipient_missing:home")).toHaveLength(1);
  });
  it("ignores a specific gift of something not in the free estate", () => {
    const r = calculateIht(estate("2026-02-01", [cash(100_000)], [specific("gone", "son"), residue("son")]));
    expect(r.flags.map((f) => f.code)).toContain("gift_asset_missing:spec:gone:son");
  });
  it("limits specific gifts of one asset to 100%", () => {
    const r = calculateIht(estate("2026-02-01", [home(400_000)], [specific("home", "son", { sharePct: 80 }), { ...specific("home", "daughter", { sharePct: 80 }), id: "second" }, residue("spouse")]));
    // Son gets 80%, daughter the remaining 20%.
    expect(r.rnrb.closelyInheritedResidencePence).toBe(gbp(400_000));
  });
  it("needs a single home for the RNRB", () => {
    const two = calculateIht(estate("2026-02-01", [home(300_000), asset("cottage", "property", 200_000, { qualifyingResidence: true })], [residue("son")]));
    expect(two.flags.map((f) => f.code)).toContain("multiple_residences");
    const gwrHome = calculateIht(estate("2026-02-01", [home(300_000, { giftWithReservation: true, giftWithReservationRecipientId: "son" })], [residue("son")]));
    expect(gwrHome.flags.map((f) => f.code)).toContain("residence_not_estate");
    expect(gwrHome.estate.residenceNilRateBandPence).toBe(0);
  });
  it("uses no RNRB for deaths before April 2017", () => {
    const r = calculateIht(estate("2016-06-01", [home(400_000)], [residue("son")]));
    expect(r.estate.residenceNilRateBandPence).toBe(0);
    expect(r.flags.map((f) => f.code)).toContain("death_before_2017");
  });
  it("scales residue shares over 100%", () => {
    const r = calculateIht(estate("2026-02-01", [cash(100_000)], [residue("son", 80), residue("daughter", 40)]));
    expect(r.flags.find((f) => f.code === "residue_shares")!.level).toBe("confirm");
  });
  it("treats residue as undisposed when there's no residuary gift", () => {
    const r = calculateIht(estate("2026-02-01", [cash(500_000)], [legacy("spouse", 100_000)]));
    expect(r.estate.chargeablePence).toBe(gbp(400_000));
  });
  it("counts lifetime gifts to a non-resident spouse against the cap", () => {
    const r = calculateIht(estate("2026-02-01", [cash(300_000)], [residue("spouse")], { spouseExemptionLimited: true, lifetimeGifts: [gift("s", "2025-01-01", 100_000, { recipientCategory: "spouse" })] }));
    expect(r.estate.spouseExemptPence).toBe(gbp(225_000));
  });
  it("excludes dependants' scheme pensions and treats a pension with no treatment as an unused fund", () => {
    const r = calculateIht(
      estate("2027-05-01", [asset("db", "pension", 100_000, { pension: "dependants_scheme_pension" }), asset("dc", "pension", 100_000, { pensionRecipientId: "son" })], [residue("son")]),
    );
    expect(r.estate.excludedPence).toBe(gbp(100_000));
    expect(r.estate.grossPence).toBe(gbp(100_000));
  });
  it("doesn't count a joint home to a non-descendant as closely inherited", () => {
    const r = calculateIht(estate("2026-02-01", [home(300_000, { ownership: "joint_tenancy", survivorRecipientId: "nephew" })], [residue("son")]));
    expect(r.rnrb.closelyInheritedResidencePence).toBe(0);
  });
  it("sorts gifts by date whatever order they're entered in", () => {
    const r = calculateIht(estate("2026-03-01", [cash(330_000)], [residue("son")], { lifetimeGifts: [gift("g3", "2024-06-01", 4_000), gift("g1", "2023-05-01", 2_000), gift("g2", "2024-05-01", 5_000)] }));
    // Same as fixture 20: £5k chargeable however the gifts are listed.
    expect(r.gifts.map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
    expect(r.estate.lifetimeGiftsAgainstBandPence).toBe(gbp(5_000));
  });
  it("shows the gift tax total line only when gifts bear tax", () => {
    const r = calculateIht(estate("2026-08-01", [cash(100_000)], [residue("son")], { lifetimeGifts: [gift("g", "2025-07-01", 500_000)] }));
    expect(r.lines.map((l) => l.id)).toEqual(expect.arrayContaining(["gifts:tax", "tax:total"]));
    expect(r.attribution.some((a) => a.bucket === "lifetime_gift")).toBe(true);
  });
});
