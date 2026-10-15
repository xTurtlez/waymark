/**
 * Worked estates for the rules engine. Every expected figure was worked out
 * by hand from the rule it tests; the reasoning sits next to each fixture.
 * Fixtures marked "HMRC" reproduce HMRC's own worked examples.
 *
 * Amounts: gbp(n) is £n in pence; bare integers are exact pence.
 */
import type { IhtInput, ReportingRoute } from "@/rules/types";
import { R, asset, cash, debt, estate, gbp, gift, home, legacy, noFamily, residue, specific } from "./builders";

export interface Expected {
  estateTax?: number;
  totalTax?: number;
  giftTax?: number;
  chargeable?: number;
  nrbAvailable?: number;
  rnrb?: number;
  downsizing?: number;
  lost?: number;
  adjustedAllowance?: number;
  rateBp?: number;
  route?: ReportingRoute;
  unusedNrbBp?: number;
  unusedRnrbBp?: number;
  spouseExempt?: number;
  charityExempt?: number;
  reliefs?: number;
  qsr?: number;
  excluded?: number;
  dueOn?: string;
  flags?: string[];
  noFlags?: string[];
  schedules?: string[];
  complete?: boolean;
  attribution?: Record<string, number>;
  transferableRelief?: number | null;
}

export interface Fixture {
  name: string;
  why: string;
  input: IhtInput;
  expect: Expected;
}

const D26 = "2026-02-01";

export const FIXTURES: Fixture[] = [
  // ── Basics ────────────────────────────────────────────────────────────
  {
    name: "01 small estate to children, no home",
    why: "Net £300k − £5k funeral = £295k, within the £325k NRB: no tax. No home, so the whole RNRB (£175k) is unused (100%). Unused NRB £30k = 9.23%. Gross £300k ≤ NRB: low value excepted.",
    input: estate("2026-05-14", [cash(300_000)], [residue("son", 50), residue("daughter", 50)], { liabilities: [debt("funeral", 5_000, { kind: "funeral" })] }),
    expect: { estateTax: 0, chargeable: gbp(295_000), unusedNrbBp: 923, unusedRnrbBp: 10_000, route: "excepted_low_value", dueOn: "2026-11-30" },
  },
  {
    name: "02 Margaret Ellis: home to daughter, residue to children",
    why: "Gross £412,300, debts £8,050, net £404,250. Home (£365k) to a daughter is closely inherited: RNRB £175k. Band £500k > £404,250: no tax. RNRB is used first (£175k), then NRB £229,250, leaving £95,750 (29.46%). Over £325k with no exemptions: IHT400.",
    input: estate(
      "2026-05-14",
      [home(365_000), asset("barclays", "bank", 8_240), asset("nationwide", "savings", 21_560), asset("bonds", "bonds", 17_500)],
      [specific("home", "daughter"), residue("daughter", 50), residue("son", 50)],
      { liabilities: [debt("card", 3_636), debt("energy", 214), debt("funeral", 4_200, { kind: "funeral" })] },
    ),
    expect: {
      estateTax: 0,
      chargeable: gbp(404_250),
      rnrb: gbp(175_000),
      unusedNrbBp: 2946,
      unusedRnrbBp: 0,
      route: "iht400",
      schedules: ["IHT405", "IHT406", "IHT419", "IHT435"],
    },
  },
  {
    name: "03 over the NRB, no home",
    why: "£600k to a nephew: (600,000 − 325,000) × 40% = £110,000. Death 1 June 2025: due 31 December 2025.",
    input: estate("2025-06-01", [cash(600_000)], [residue("nephew")]),
    expect: { estateTax: gbp(110_000), rateBp: 4_000, route: "iht400", dueOn: "2025-12-31", schedules: ["IHT406"] },
  },
  {
    name: "04 everything to spouse",
    why: "£800k all to spouse: exempt, no tax. Home not closely inherited: all £175k RNRB unused (100%); NRB unused (100%). Gross ≤ £3m and nothing chargeable after spouse exemption: exempt excepted estate.",
    input: estate("2024-03-10", [home(500_000), cash(300_000)], [residue("spouse")]),
    expect: { estateTax: 0, spouseExempt: gbp(800_000), unusedNrbBp: 10_000, unusedRnrbBp: 10_000, route: "excepted_exempt" },
  },
  {
    name: "05 second death with full transferred NRB and RNRB",
    why: "NRB 325k + 325k transferred; RNRB 175k + 175k: band £1m equals the £1m estate, so no tax. Not excepted (gross over £650k): IHT400 with IHT402 and IHT436.",
    input: estate("2026-01-20", [home(600_000), cash(400_000)], [residue("son", 50), residue("daughter", 50)], { transferredNrbBp: 10_000, transferredRnrbBp: 10_000 }),
    expect: { estateTax: 0, rnrb: gbp(350_000), nrbAvailable: gbp(650_000), route: "iht400", schedules: ["IHT402", "IHT405", "IHT406", "IHT435", "IHT436"] },
  },
  {
    name: "06 second death over the combined bands",
    why: "£1.2m against £1m of bands: £200,000 × 40% = £80,000.",
    input: estate("2026-01-20", [home(600_000), cash(600_000)], [residue("son", 50), residue("daughter", 50)], { transferredNrbBp: 10_000, transferredRnrbBp: 10_000 }),
    expect: { estateTax: gbp(80_000) },
  },

  // ── RNRB taper (HMRC IHTM46023 / 46044) ───────────────────────────────
  {
    name: "07 HMRC Brian: taper in 2017/18",
    why: "HMRC: estate £2,150,000 is £150,000 over £2m; RNRB £100,000 less £75,000 = £25,000. Tax: (2,150,000 − 325,000 − 25,000) × 40% = £720,000.",
    input: estate("2017-06-01", [home(500_000), cash(1_650_000)], [specific("home", "son"), residue("son")]),
    expect: { rnrb: gbp(25_000), adjustedAllowance: gbp(25_000), estateTax: gbp(720_000) },
  },
  {
    name: "08 taper removes the RNRB entirely",
    why: "£2.4m is £400k over: reduction £200k exceeds the £175k allowance, so RNRB is nil. (2,400,000 − 325,000) × 40% = £830,000. Nothing left to transfer.",
    input: estate("2023-09-01", [home(800_000), cash(1_600_000)], [residue("daughter")]),
    expect: { rnrb: 0, adjustedAllowance: 0, estateTax: gbp(830_000), unusedRnrbBp: 0 },
  },
  {
    name: "09 HMRC Yasuo: taper on the default allowance with brought-forward RNRB",
    why: "HMRC: default allowance £175k + £175k = £350k; £200k over → reduced by £100k to £250k. Tax: (2,200,000 − 325,000 − 250,000) × 40% = £650,000.",
    input: estate("2022-02-01", [home(1_000_000), cash(1_200_000)], [residue("son", 50), residue("daughter", 50)], { transferredRnrbBp: 10_000 }),
    expect: { adjustedAllowance: gbp(250_000), rnrb: gbp(250_000), estateTax: gbp(650_000) },
  },
  {
    name: "10 HMRC Clyde: 62.5% brought forward, then tapered",
    why: "HMRC: £175,000 + 62.5% × £175,000 (£109,375) = £284,375; £100k over → less £50k = £234,375. Tax: (2,100,000 − 325,000 − 234,375) × 40% = £616,250.",
    input: estate("2021-01-01", [home(900_000), cash(1_200_000)], [specific("home", "son"), residue("son")], { transferredRnrbBp: 6_250 }),
    expect: { adjustedAllowance: gbp(234_375), rnrb: gbp(234_375), estateTax: gbp(616_250) },
  },
  {
    name: "11 HMRC Joelle: unused RNRB after taper, estate left to spouse",
    why: "HMRC: £75k over → £100k allowance reduced by £37,500 to £62,500, none used (all to spouse): 62.5% transferable. Pre-2022 death: exempt route limited to £1m gross, so IHT400.",
    input: estate("2017-10-01", [home(1_000_000), cash(1_075_000)], [residue("spouse")]),
    expect: { estateTax: 0, rnrb: 0, adjustedAllowance: gbp(62_500), unusedRnrbBp: 6_250, unusedNrbBp: 10_000, route: "iht400", schedules: ["IHT405", "IHT406"] },
  },
  {
    name: "12 exactly £2m: no taper",
    why: "Taper applies only above £2m. Band 325k + 175k; (2,000,000 − 500,000) × 40% = £600,000.",
    input: estate("2026-02-01", [home(500_000), cash(1_500_000)], [specific("home", "son"), residue("son")]),
    expect: { rnrb: gbp(175_000), estateTax: gbp(600_000) },
  },

  // ── Downsizing (GOV.UK worked examples) ───────────────────────────────
  {
    name: "13 HMRC downsizing: flat to son, rest to daughters",
    why: "GOV.UK example 2: £500k house sold May 2018 against £125k RNRB = 100% (capped). Flat £105k ÷ £175k = 60%. Lost 40% × £175k = £70k, within the £200k left to daughters. RNRB £105k + £70k = £175k.",
    input: estate("2020-09-15", [home(105_000), cash(200_000)], [specific("home", "son"), residue("daughter", 50), residue("daughter2", 50)], {
      downsizing: { disposedOn: "2018-05-15", formerResidenceValuePence: gbp(500_000) },
    }),
    expect: { rnrb: gbp(175_000), downsizing: gbp(70_000), lost: gbp(70_000), estateTax: 0, unusedNrbBp: 6_000, route: "iht205" },
  },
  {
    name: "14 HMRC downsizing: widow sold home, no home at death",
    why: "GOV.UK example 1: £195k ÷ (£125k + £175k) = 65%. No home at death (0%). Lost 65% × £350k = £227,500, within the £400k left to children.",
    input: estate("2020-08-20", [cash(400_000)], [residue("son", 50), residue("daughter", 50)], {
      transferredRnrbBp: 10_000,
      downsizing: { disposedOn: "2018-06-15", formerResidenceValuePence: gbp(195_000) },
    }),
    expect: { lost: gbp(227_500), downsizing: gbp(227_500), rnrb: gbp(227_500), estateTax: 0, unusedRnrbBp: 7_000 },
  },
  {
    name: "15 HMRC downsizing before April 2017: £100k default",
    why: "GOV.UK example 3: disposal March 2016 uses £100k: £150k ÷ £100k = 100%. Share of home £105k ÷ £150k = 70%. Lost 30% × £150k = £45k, within £80k to the daughter. Home to husband (exempt). Unused RNRB £105k ÷ £150k = 70%. NRB: RNRB covers £45k of the £80k, NRB £35k: 89.23% unused.",
    input: estate("2019-12-10", [home(105_000), cash(80_000)], [specific("home", "spouse"), residue("daughter")], {
      downsizing: { disposedOn: "2016-03-20", formerResidenceValuePence: gbp(150_000) },
    }),
    expect: { lost: gbp(45_000), downsizing: gbp(45_000), rnrb: gbp(45_000), spouseExempt: gbp(105_000), unusedRnrbBp: 7_000, unusedNrbBp: 8_923, route: "iht205", flags: ["excepted_pre_2022"] },
  },

  // ── Lifetime gifts ────────────────────────────────────────────────────
  {
    name: "16 PET within 3 years uses up NRB",
    why: "£200k gift June 2024: annual exemptions 2024/25 + 2023/24 (£6k) → £194k chargeable, covered by the NRB. Estate NRB left £131k: (400,000 − 131,000) × 40% = £107,600.",
    input: estate("2026-08-01", [cash(400_000)], [residue("son")], { lifetimeGifts: [gift("g1", "2024-06-10", 200_000)] }),
    expect: { giftTax: 0, nrbAvailable: gbp(131_000), estateTax: gbp(107_600), schedules: ["IHT403", "IHT406"] },
  },
  {
    name: "17 large PET with taper relief (5–6 years)",
    why: "£500k July 2021 less £6k annual exemptions = £494k; over the NRB by £169k: £67,600 × 40% payable (5–6 years) = £27,040. Estate has no NRB left: £100k × 40% = £40,000. Total £67,040.",
    input: estate("2026-08-01", [cash(100_000)], [residue("daughter")], { lifetimeGifts: [gift("g1", "2021-07-01", 500_000)] }),
    expect: { giftTax: gbp(27_040), estateTax: gbp(40_000), totalTax: gbp(67_040), nrbAvailable: 0 },
  },
  {
    name: "18 gift exactly 7 years before death is exempt",
    why: "A PET made 7 years or more before death is exempt. 14 May 2019 → 14 May 2026: outside. Estate £300k within NRB; excepted.",
    input: estate("2026-05-14", [cash(300_000)], [residue("son")], { lifetimeGifts: [gift("g1", "2019-05-14", 400_000)] }),
    expect: { giftTax: 0, estateTax: 0, nrbAvailable: gbp(325_000), route: "excepted_low_value" },
  },
  {
    name: "19 gift one day inside 7 years",
    why: "15 May 2019 → 14 May 2026: within 7 years, 6–7 years band (20% payable). £400k − £6k = £394k; (394,000 − 325,000) × 40% × 20% = £5,520. Estate £300k all taxable: £120,000. Total £125,520.",
    input: estate("2026-05-14", [cash(300_000)], [residue("son")], { lifetimeGifts: [gift("g1", "2019-05-15", 400_000)] }),
    expect: { giftTax: gbp(5_520), estateTax: gbp(120_000), totalTax: gbp(125_520) },
  },
  {
    name: "20 annual exemption order and one-year carry-forward",
    why: "£2k (2023/24) uses £2k of that year. £5k (2024/25) uses £3k of its year + £1k carried from 2023/24: £1k chargeable. £4k later in 2024/25: nothing left: £4k chargeable. £5k against the NRB; (330,000 − 320,000) × 40% = £4,000.",
    input: estate("2026-03-01", [cash(330_000)], [residue("son")], {
      lifetimeGifts: [gift("g1", "2023-05-01", 2_000), gift("g2", "2024-05-01", 5_000), gift("g3", "2024-06-01", 4_000)],
    }),
    expect: { nrbAvailable: gbp(320_000), estateTax: gbp(4_000) },
  },
  {
    name: "21 small gift, wedding gift and a small gift over the limit",
    why: "£250 small gift exempt. £8k wedding gift to a child: £5k wedding + £3k annual (2024/25). £400 'small' gift is over £250 so doesn't qualify, but last year's carried-forward £3k covers it. Nothing chargeable.",
    input: estate("2026-01-01", [cash(200_000)], [residue("son")], {
      lifetimeGifts: [
        gift("s1", "2025-01-10", 250, { smallGift: true }),
        gift("w1", "2025-02-01", 8_000, { weddingGift: "child" }),
        gift("s2", "2025-03-01", 400, { smallGift: true }),
      ],
    }),
    expect: { nrbAvailable: gbp(325_000), estateTax: 0, flags: ["small_gift_over_limit"], route: "excepted_low_value" },
  },
  {
    name: "22 normal expenditure out of income",
    why: "Claimed as normal expenditure: exempt, with a solicitor confirmation flag.",
    input: estate("2026-01-01", [cash(300_000)], [residue("son")], { lifetimeGifts: [gift("n1", "2024-01-01", 50_000, { normalExpenditure: true })] }),
    expect: { estateTax: 0, nrbAvailable: gbp(325_000), flags: ["normal_expenditure"] },
  },
  {
    name: "23 trust gift 12 years ago shadows a later PET (14-year rule)",
    why: "CLT March 2014: £325k − £6k = £319k. PET June 2020: £294k. The CLT is within 7 years before the PET, so the PET has only £6k of NRB: (294,000 − 6,000) × 40% = £115,200 × 40% payable (5–6 yrs) = £46,080. The CLT is over 7 years before death so only the PET reduces the estate's NRB: £31k left; (200,000 − 31,000) × 40% = £67,600. Total £113,680.",
    input: estate("2026-01-15", [cash(200_000)], [residue("son")], {
      lifetimeGifts: [gift("clt", "2014-03-01", 325_000, { form: "trust", recipientCategory: "other" }), gift("pet", "2020-06-01", 300_000)],
    }),
    expect: { giftTax: gbp(46_080), nrbAvailable: gbp(31_000), estateTax: gbp(67_600), totalTax: gbp(113_680) },
  },
  {
    name: "24 trust gift within 7 years with lifetime tax credited",
    why: "CLT May 2022 £400k − £6k = £394k; death tax (394,000 − 325,000) × 40% = £27,600 × 60% (4–5 yrs) = £16,560, less £13,800 paid in lifetime = £2,760. Estate £100k with no NRB left: £40,000.",
    input: estate("2026-07-01", [cash(100_000)], [residue("son")], {
      lifetimeGifts: [gift("clt", "2022-05-01", 400_000, { form: "trust", recipientCategory: "other", lifetimeTaxPaidPence: gbp(13_800) })],
    }),
    expect: { giftTax: gbp(2_760), estateTax: gbp(40_000), totalTax: gbp(42_760), route: "iht400" },
  },

  // ── Charity and the 36% rate ──────────────────────────────────────────
  {
    name: "25 36% rate: 10% of the baseline to charity",
    why: "£525k, £20k to charity. Baseline = 505,000 − 325,000 + 20,000 = £200,000; 10% = £20,000, so 36% applies: (505,000 − 325,000) × 36% = £64,800.",
    input: estate(D26, [cash(525_000)], [legacy("charity", 20_000), residue("nephew")]),
    expect: { estateTax: gbp(64_800), rateBp: 3_600, charityExempt: gbp(20_000), schedules: ["IHT406", "IHT430"] },
  },
  {
    name: "26 charity a pound short of 10%",
    why: "£19,999 to charity: baseline £200,000, 10% = £20,000: fails. (505,001 − 325,000) × 40% = £72,000.40.",
    input: estate(D26, [cash(525_000)], [legacy("charity", 19_999), residue("nephew")]),
    expect: { estateTax: 7_200_040, rateBp: 4_000 },
  },
  {
    name: "27 charity share of residue with a tax-free gift of the home (double grossing at 36%)",
    why: "Home £400k to daughter free of tax; residue £300k half to charity. Band 325k + 175k RNRB. Step 1: £400k is within the band. Step 2: + chargeable residue £150k = £550k, tax at 36% on £50k = £18k. Step 3: re-gross £400k × 550/532 = £413,533.83. Step 4: residue £286,466.17, half chargeable £143,233.09; chargeable £556,766.92; tax 36% × £56,766.92 = £20,436.09. Baseline 556,766.92 − 325,000 + 143,233.09 = £375,000.01: charity passes.",
    input: estate(D26, [home(400_000), cash(300_000)], [specific("home", "daughter"), residue("charity", 50), residue("daughter", 50)]),
    expect: { chargeable: 55_676_692, estateTax: 2_043_609, rateBp: 3_600, charityExempt: 14_323_309, flags: ["double_grossing"] },
  },
  {
    name: "28 36% applies to one component but not another",
    why: "Free estate: £360k chargeable + £40k charity; joint cash £300k to nephew. NRB split 360:300 → £177,272.73 / £147,727.27. Free baseline 360,000 − 177,272.73 + 40,000 = £222,727.27 → passes; joint has no charity → 40%. Bands split the same way: 36% × £182,727.27 = £65,781.82; 40% × £152,272.73 = £60,909.09. Total £126,690.91. Merging would pass, so it's suggested.",
    input: estate(D26, [cash(400_000), asset("joint", "bank", 300_000, { ownership: "joint_tenancy", survivorRecipientId: "nephew" })], [legacy("charity", 40_000), residue("nephew")]),
    expect: { estateTax: 12_669_091, flags: ["charity_components", "charity_merge"] },
  },
  {
    name: "29 same estate with the merge election",
    why: "Merged: chargeable £660k, charity £40k, baseline 660,000 − 325,000 + 40,000 = £375,000; 10% = £37,500 ≤ £40k: 36% throughout. (660,000 − 325,000) × 36% = £120,600.",
    input: estate(D26, [cash(400_000), asset("joint", "bank", 300_000, { ownership: "joint_tenancy", survivorRecipientId: "nephew" })], [legacy("charity", 40_000), residue("nephew")], {
      mergeCharityComponents: true,
    }),
    expect: { estateTax: gbp(120_600), rateBp: 3_600, noFlags: ["charity_merge"] },
  },

  // ── Grossing up ───────────────────────────────────────────────────────
  {
    name: "30 single grossing: tax-free legacy, residue to spouse",
    why: "£400k to son free of tax, residue to spouse. Gross up: 325,000 + 75,000 ÷ 0.6 = £450,000. Tax £50,000 paid from residue: spouse gets 1,000,000 − 400,000 − 50,000 = £550,000.",
    input: estate(D26, [cash(1_000_000)], [legacy("son", 400_000), residue("spouse")]),
    expect: { chargeable: gbp(450_000), estateTax: gbp(50_000), spouseExempt: gbp(550_000), noFlags: ["double_grossing"] },
  },
  {
    name: "31 legacy bearing its own tax: no grossing",
    why: "The same £400k legacy, subject to tax: chargeable £400k, tax (400,000 − 325,000) × 40% = £30,000 borne by the son. Spouse gets £600k.",
    input: estate(D26, [cash(1_000_000)], [legacy("son", 400_000, true), residue("spouse")]),
    expect: { chargeable: gbp(400_000), estateTax: gbp(30_000), spouseExempt: gbp(600_000), attribution: { "leg:son:400000": gbp(30_000) } },
  },
  {
    name: "32 double grossing with other chargeable property",
    why: "IHT400 method: £400k tax-free legacy grossed alone = £450k. Add joint cash £200k (bears own tax): £650k, tax £130k, rate 20%. Re-gross £400k ÷ 0.8 = £500k. Chargeable £700k, tax (700,000 − 325,000) × 40% = £150,000: £107,142.86 on the legacy (from residue), £42,857.14 on the joint cash.",
    input: estate(D26, [cash(1_000_000), asset("joint", "bank", 200_000, { ownership: "joint_tenancy", survivorRecipientId: "nephew" })], [legacy("son", 400_000), residue("spouse")]),
    expect: { chargeable: gbp(700_000), estateTax: gbp(150_000), spouseExempt: gbp(500_000), attribution: { legacies: 10_714_286, joint: 4_285_714 }, flags: ["double_grossing"] },
  },
  {
    name: "33 tax-free legacy with all residue chargeable: no grossing",
    why: "£100k to a friend free of tax, residue to nephew: the whole £600k is chargeable; £110,000 tax. The legacy's share (£18,333.33) is paid from residue.",
    input: estate(D26, [cash(600_000)], [legacy("friend", 100_000), residue("nephew")]),
    expect: { chargeable: gbp(600_000), estateTax: gbp(110_000), attribution: { legacies: 1_833_333, "res:nephew": 9_166_667 } },
  },
  {
    name: "34 half the home to son, rest to spouse",
    why: "50% of a £400k home to son (£200k, tax-free) and the rest to spouse. Closely inherited £200k: RNRB £175k. Grossing: £200k is within the £500k band, so no tax.",
    input: estate(D26, [home(400_000)], [specific("home", "son", { sharePct: 50 }), residue("spouse")]),
    expect: { rnrb: gbp(175_000), chargeable: gbp(200_000), estateTax: 0, spouseExempt: gbp(200_000) },
  },

  // ── Spouse exemption cap ──────────────────────────────────────────────
  {
    name: "35 spouse not UK resident: exemption capped at the NRB",
    why: "£800k to a non-resident spouse: exempt only to £325k. £475k chargeable less £325k NRB: £150k × 40% = £60,000.",
    input: estate(D26, [cash(800_000)], [residue("spouse")], { spouseExemptionLimited: true }),
    expect: { spouseExempt: gbp(325_000), chargeable: gbp(475_000), estateTax: gbp(60_000), flags: ["spouse_cap"] },
  },

  // ── Business and agricultural relief ──────────────────────────────────
  {
    name: "36 business relief before April 2026: 100% uncapped",
    why: "£3m trading company shares at 100%; £400k cash: (400,000 − 325,000) × 40% = £30,000.",
    input: estate("2025-12-01", [asset("company", "unlisted_shares", 3_000_000, { relief: { kind: "business", rate: "full" } }), cash(400_000)], [specific("company", "son"), residue("son")]),
    expect: { reliefs: gbp(3_000_000), estateTax: gbp(30_000), transferableRelief: null, schedules: ["IHT406", "IHT412", "IHT413"] },
  },
  {
    name: "37 business relief from April 2026: £2.5m allowance",
    why: "£2.5m at 100% + £500k at 50% = £2.75m relief. Chargeable £250k + £400k = £650k: (650,000 − 325,000) × 40% = £130,000. Allowance fully used.",
    input: estate("2026-09-01", [asset("company", "unlisted_shares", 3_000_000, { relief: { kind: "business", rate: "full" } }), cash(400_000)], [specific("company", "son"), residue("son")]),
    expect: { reliefs: gbp(2_750_000), estateTax: gbp(130_000), transferableRelief: 0 },
  },
  {
    name: "38 transferred relief allowance from a spouse",
    why: "£2.5m + £2.5m transferred: the whole £3m gets 100%. Tax £30,000; £2m of allowance left for a future claim.",
    input: estate("2026-09-01", [asset("company", "unlisted_shares", 3_000_000, { relief: { kind: "business", rate: "full" } }), cash(400_000)], [specific("company", "son"), residue("son")], {
      reliefAllowanceTransferredPence: gbp(2_500_000),
    }),
    expect: { reliefs: gbp(3_000_000), estateTax: gbp(30_000), transferableRelief: gbp(2_000_000) },
  },
  {
    name: "39 AIM shares at 50% from April 2026",
    why: "AIM £400k at 50% = £200k relief. Chargeable £200k + £300k = £500k: £70,000.",
    input: estate("2026-09-01", [asset("aim", "listed_shares", 400_000, { relief: { kind: "business", rate: "half" } }), cash(300_000)], [residue("son")]),
    expect: { reliefs: gbp(200_000), estateTax: gbp(70_000) },
  },
  {
    name: "40 lifetime gift uses the relief allowance first",
    why: "Jan 2025 gift of £2m business property (after 30 Oct 2024) uses £2m of the £2.5m allowance. Estate: £1m business property gets £500k at 100% + £500k at 50% = £750k relief; chargeable £250k + £100k = £350k: £10,000.",
    input: estate("2026-09-01", [asset("company", "unlisted_shares", 1_000_000, { relief: { kind: "business", rate: "full" } }), cash(100_000)], [residue("son")], {
      lifetimeGifts: [gift("shares", "2025-01-10", 2_000_000, { relief: { kind: "business", rate: "full", stillQualifiesAtDeath: true } })],
    }),
    expect: { giftTax: 0, reliefs: gbp(750_000), estateTax: gbp(10_000), transferableRelief: 0 },
  },
  {
    name: "41 gift before 30 October 2024 doesn't use the allowance",
    why: "June 2024 gift keeps old rules (100%, no allowance). Estate's £1m gets 100% from the full £2.5m allowance; £100k cash under NRB: no tax; £1.5m allowance unused.",
    input: estate("2026-09-01", [asset("company", "unlisted_shares", 1_000_000, { relief: { kind: "business", rate: "full" } }), cash(100_000)], [residue("son")], {
      lifetimeGifts: [gift("shares", "2024-06-01", 2_000_000, { relief: { kind: "business", rate: "full", stillQualifiesAtDeath: true } })],
    }),
    expect: { estateTax: 0, reliefs: gbp(1_000_000), transferableRelief: gbp(1_500_000) },
  },

  // ── Pensions ──────────────────────────────────────────────────────────
  {
    name: "42 pension before April 2027 is outside the estate",
    why: "Death January 2027: the £500k unused fund is excluded (with a check flag). £300k cash: no tax, low value excepted.",
    input: estate("2027-01-10", [asset("pension", "pension", 500_000, { pension: "unused_fund", pensionRecipientId: "son" }), cash(300_000)], [residue("son")]),
    expect: { excluded: gbp(500_000), estateTax: 0, route: "excepted_low_value", flags: ["pension_pre_2027:pension"] },
  },
  {
    name: "43 unused pension in the estate from April 2027",
    why: "£500k pension + £300k cash to son: (800,000 − 325,000) × 40% = £190,000, apportioned 5:3: £118,750 on the pension, £71,250 on residue.",
    input: estate("2027-05-01", [asset("pension", "pension", 500_000, { pension: "unused_fund", pensionRecipientId: "son" }), cash(300_000)], [residue("son")]),
    expect: { estateTax: gbp(190_000), attribution: { pension: gbp(118_750), "res:son": gbp(71_250) }, flags: ["pension_apportionment"], schedules: ["IHT406", "IHT409"] },
  },
  {
    name: "44 pension to spouse is exempt; death-in-service excluded",
    why: "£400k fund to spouse exempt; £600k death-in-service excluded; £200k to son within NRB. Exempt excepted estate (gross £600k, £200k chargeable), with a pensions check flag.",
    input: estate("2027-05-01", [
      asset("pension", "pension", 400_000, { pension: "unused_fund", pensionRecipientId: "spouse" }),
      asset("dis", "pension", 600_000, { pension: "death_in_service" }),
      cash(200_000),
    ], [residue("son")]),
    expect: { estateTax: 0, excluded: gbp(600_000), spouseExempt: gbp(400_000), route: "excepted_exempt", flags: ["excepted_pensions"] },
  },

  // ── Quick succession relief ───────────────────────────────────────────
  {
    name: "45 QSR at 80% (1–2 years)",
    why: "(£100k ÷ £500k) × £70k × 80% = £11,200 off £110,000: £98,800.",
    input: estate("2026-06-01", [cash(600_000)], [residue("nephew")], {
      priorTransfers: [{ id: "p1", label: "Uncle's estate", transferOn: "2024-09-01", netIncreasePence: gbp(100_000), grossTransferPence: gbp(500_000), taxPaidPence: gbp(70_000) }],
    }),
    expect: { qsr: gbp(11_200), estateTax: gbp(98_800) },
  },
  {
    name: "46 QSR on the first anniversary takes 100%",
    why: "Exactly one year: 'one year or less' → 100%. £200k ÷ £200k × £50k = £50,000 off £110,000.",
    input: estate("2026-06-01", [cash(600_000)], [residue("nephew")], {
      priorTransfers: [{ id: "p1", label: "Mother's estate", transferOn: "2025-06-01", netIncreasePence: gbp(200_000), grossTransferPence: gbp(200_000), taxPaidPence: gbp(50_000) }],
    }),
    expect: { qsr: gbp(50_000), estateTax: gbp(60_000) },
  },
  {
    name: "47 QSR after 5 years: none",
    why: "More than five years: no relief. Tax stays £110,000.",
    input: estate("2026-06-01", [cash(600_000)], [residue("nephew")], {
      priorTransfers: [{ id: "p1", label: "Old estate", transferOn: "2020-01-01", netIncreasePence: gbp(200_000), grossTransferPence: gbp(200_000), taxPaidPence: gbp(50_000) }],
    }),
    expect: { qsr: 0, estateTax: gbp(110_000) },
  },

  // ── Joint property and debts ──────────────────────────────────────────
  {
    name: "48 joint home passes to spouse by survivorship",
    why: "Home share £300k to spouse: exempt, not closely inherited (RNRB all unused, 100%). £500k to children: (500,000 − 325,000) × 40% = £70,000.",
    input: estate(D26, [home(300_000, { ownership: "joint_tenancy", survivorRecipientId: "spouse" }), cash(500_000)], [residue("son", 50), residue("daughter", 50)]),
    expect: { estateTax: gbp(70_000), spouseExempt: gbp(300_000), unusedRnrbBp: 10_000, unusedNrbBp: 0, schedules: ["IHT404", "IHT405", "IHT406"] },
  },
  {
    name: "49 joint home passes to daughter by survivorship",
    why: "Home share £300k to daughter: RNRB £175k. (600,000 − 500,000) × 40% = £40,000, half on the home (daughter pays) and half on residue.",
    input: estate(D26, [home(300_000, { ownership: "joint_tenancy", survivorRecipientId: "daughter" }), cash(300_000)], [residue("son")]),
    expect: { rnrb: gbp(175_000), estateTax: gbp(40_000), attribution: { home: gbp(20_000), "res:son": gbp(20_000) } },
  },
  {
    name: "50 mortgage reduces the home for the RNRB",
    why: "£300k home with a £200k mortgage: £100k net, so RNRB £100k. Band £425k; net estate £500k: £30,000. Unused RNRB £75k ÷ £175k = 42.86%.",
    input: estate(D26, [home(300_000), cash(400_000)], [residue("son")], { liabilities: [debt("mortgage", 200_000, { kind: "mortgage", securedOnAssetId: "home" })] }),
    expect: { rnrb: gbp(100_000), estateTax: gbp(30_000), unusedRnrbBp: 4_286 },
  },
  {
    name: "51 debts larger than the free estate",
    why: "£150k of debts against £100k cash: only £100k is deducted (flagged). Joint £200k to son is within the NRB.",
    input: estate(D26, [cash(100_000), asset("joint", "bank", 200_000, { ownership: "joint_tenancy", survivorRecipientId: "son" })], [residue("son")], { liabilities: [debt("loan", 150_000)] }),
    expect: { estateTax: 0, chargeable: gbp(200_000), flags: ["liabilities_exceed_free_estate"] },
  },
  {
    name: "52 debt that isn't deductible",
    why: "A £50k non-deductible debt is ignored: £400k chargeable, £30,000 tax.",
    input: estate(D26, [cash(400_000)], [residue("son")], { liabilities: [debt("family-loan", 50_000, { deductible: false })] }),
    expect: { chargeable: gbp(400_000), estateTax: gbp(30_000) },
  },
  {
    name: "53 gift with reservation of benefit",
    why: "House given away but still lived in (£300k, not the RNRB home) is taxed in the estate: £500k → £70,000; the son as donee bears £42,000. Not excepted.",
    input: estate(D26, [asset("gwr", "property", 300_000, { giftWithReservation: true, giftWithReservationRecipientId: "son" }), cash(200_000)], [residue("son")]),
    expect: { estateTax: gbp(70_000), attribution: { gwr: gbp(42_000), "res:son": gbp(28_000) }, route: "iht400" },
  },

  // ── Intestacy ─────────────────────────────────────────────────────────
  {
    name: "54 intestacy: spouse and two children",
    why: "Net £720k: chattels £20k + legacy £322k + half of £378k (£189k) to spouse: £531k exempt. Children's half £189k is chargeable. Home in residue is half closely inherited (£200k): RNRB £175k. No tax. RNRB covers £175k, NRB £14k: 95.69% NRB unused. Exempt excepted estate.",
    input: estate("2026-01-10", [home(400_000), cash(300_000), asset("chattels", "chattels", 20_000)], [], {
      succession: { type: "intestacy", family: { ...noFamily(), spouseName: "Ann", issue: [{ name: "Ben", alive: true }, { name: "Cara", alive: true }] } },
    }),
    expect: { estateTax: 0, spouseExempt: gbp(531_000), chargeable: gbp(189_000), rnrb: gbp(175_000), unusedNrbBp: 9_569, route: "excepted_exempt" },
  },
  {
    name: "55 intestacy: children only",
    why: "Everything to the children: home closely inherited, RNRB £175k; £400k within £500k: no tax.",
    input: estate("2026-01-10", [home(300_000), cash(100_000)], [], {
      succession: { type: "intestacy", family: { ...noFamily(), issue: [{ name: "Ben", alive: true }, { name: "Cara", alive: true }] } },
    }),
    expect: { estateTax: 0, rnrb: gbp(175_000) },
  },
  {
    name: "56 intestacy: spouse, no children",
    why: "Spouse takes everything: exempt.",
    input: estate("2026-01-10", [cash(900_000)], [], { succession: { type: "intestacy", family: { ...noFamily(), spouseName: "Ann", parents: ["Mum"] } } }),
    expect: { estateTax: 0, spouseExempt: gbp(900_000) },
  },
  {
    name: "57 intestacy: brothers and sisters",
    why: "No spouse or issue; parents dead: siblings take. £500k chargeable: (500,000 − 325,000) × 40% = £70,000. No RNRB (not lineal).",
    input: estate("2026-01-10", [home(400_000), cash(100_000)], [], {
      succession: { type: "intestacy", family: { ...noFamily(), siblingsWhole: [{ name: "Dan", alive: true }] } },
    }),
    expect: { estateTax: gbp(70_000), rnrb: 0 },
  },

  // ── Flags and edges ───────────────────────────────────────────────────
  {
    name: "58 residue shares that don't add up",
    why: "60% to son; the undisposed 40% passes on partial intestacy (out of scope) and is treated as chargeable: £400k, £30,000.",
    input: estate(D26, [cash(400_000)], [residue("son", 60)]),
    expect: { estateTax: gbp(30_000), flags: ["residue_shares"], complete: false },
  },
  {
    name: "59 legacies abate",
    why: "Two £80k legacies from £100k: each abates to £50k. £100k is within the NRB.",
    input: estate(D26, [cash(100_000)], [legacy("friend", 80_000), legacy("nephew", 80_000), residue("son")]),
    expect: { estateTax: 0, chargeable: gbp(100_000), flags: ["legacies_abate"] },
  },
  {
    name: "60 Benham residue division is flagged",
    why: "Benham wording is calculated on the Ratcliffe basis and marked incomplete.",
    input: { ...estate(D26, [cash(800_000)], [residue("spouse", 50), residue("son", 50)]), succession: { type: "will", dispositions: [residue("spouse", 50), residue("son", 50)], residueBenham: true } },
    expect: { estateTax: gbp(30_000), flags: ["benham"], complete: false },
  },
  {
    name: "61 death after the confirmed thresholds",
    why: "June 2030 is after 5 April 2030: same figures, flagged to confirm.",
    input: estate("2030-06-01", [cash(300_000)], [residue("son")]),
    expect: { estateTax: 0, flags: ["rates_unconfirmed"] },
  },
  {
    name: "62 not a long-term UK resident",
    why: "Flagged out of scope; not excepted.",
    input: estate(D26, [cash(300_000)], [residue("son")], { longTermUkResident: false }),
    expect: { estateTax: 0, flags: ["non_resident"], complete: false, route: "iht400" },
  },
  {
    name: "63 trust property is left out",
    why: "Settled property isn't calculated: excluded, flagged and not excepted.",
    input: estate(D26, [cash(300_000), asset("trust", "other", 200_000, { settled: true })], [residue("son")]),
    expect: { excluded: gbp(200_000), flags: ["settled:trust"], complete: false, route: "iht400", schedules: ["IHT406", "IHT418"] },
  },
  {
    name: "64 a death before 2022 small estate uses IHT205",
    why: "Excepted, but for deaths before 1 January 2022 the form was IHT205.",
    input: estate("2020-06-01", [cash(300_000)], [residue("nephew")]),
    expect: { route: "iht205", flags: ["excepted_pre_2022"] },
  },
  {
    name: "65 foreign assets over £100k block the excepted route",
    why: "£150k abroad is over the £100k limit: IHT400 with IHT417 even though no tax is due.",
    input: estate(D26, [cash(100_000), asset("villa", "property", 150_000, { foreign: true })], [residue("son")]),
    expect: { estateTax: 0, route: "iht400", schedules: ["IHT405", "IHT406", "IHT417"] },
  },
  {
    name: "66 relief on residue property is spread over a cash legacy (s.39A)",
    why: "£3m farm (100% APR, pre-2026) in residue, £1m cash, £900k legacy to a friend free of tax, residue to spouse. s.39A: the legacy is reduced by (£4m − £3m relief) ÷ £4m = ¼, so it counts as £225k: within the NRB, no tax. Spouse exemption: £1m after relief − £225k = £775k.",
    input: estate("2025-12-01", [asset("farm", "agricultural", 3_000_000, { relief: { kind: "agricultural", rate: "full" } }), cash(1_000_000)], [legacy("friend", 900_000), residue("spouse")]),
    expect: { reliefs: gbp(3_000_000), chargeable: gbp(225_000), estateTax: 0, spouseExempt: gbp(775_000), route: "iht400", schedules: ["IHT406", "IHT414"] },
  },
  {
    name: "67 pension left to charity doesn't give the will 36%",
    why: "From April 2027 a £50k pension to charity is its own component with nothing chargeable, so it can't make the will's £500k (no charity) pay 36%: (500,000 − 325,000) × 40% = £70,000. Merged, the charity gift would clear 10% of the combined baseline (£175k + £50k), so the merge election is suggested.",
    input: estate("2027-05-01", [asset("pension", "pension", 50_000, { pension: "unused_fund", pensionRecipientId: "charity" }), cash(500_000)], [residue("nephew")]),
    expect: { estateTax: gbp(70_000), rateBp: 4_000, charityExempt: gbp(50_000), flags: ["charity_merge"], noFlags: ["charity_components"] },
  },
  {
    name: "68 pensions part to charity: 36% on the pension component only",
    why: "From April 2027: pensions £400k to nephew + £40k to charity; will £300k to nephew. NRB split 400:300 → £185,714.29 / £139,285.71. Pension baseline 400,000 − 185,714.29 + 40,000 = £254,285.71: £40k clears 10%, so 36%. Will has no charity: 40%. Tax: 36% × £214,285.71 = £77,142.86 and 40% × £160,714.29 = £64,285.72; total £141,428.58. Merging would fail (£40k < 10% of £415,000), so no merge suggestion.",
    input: estate("2027-05-01", [
      asset("pension1", "pension", 400_000, { pension: "unused_fund", pensionRecipientId: "nephew" }),
      asset("pension2", "pension", 40_000, { pension: "unused_fund", pensionRecipientId: "charity" }),
      cash(300_000),
    ], [residue("nephew")]),
    expect: { estateTax: 14_142_858, rateBp: 4_000, flags: ["charity_components"], noFlags: ["charity_merge"] },
  },
];

void R;
