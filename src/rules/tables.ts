/**
 * Dated rule tables. Every figure the engine uses lives here, keyed by the
 * date it took effect, with the source it was checked against.
 *
 * Checked on 15 October 2026. To change a figure, add a new dated row; never
 * edit an old one, because estates with earlier dates of death still use it.
 */
import type { ExceptedLimits, ISODate, Pence, RuleSnapshot, SourceRef } from "./types";

export const SOURCES = {
  rnrbAmounts: { label: "HMRC IHTM46002: RNRB amounts and taper threshold", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm46002" },
  thresholdsFrozen2031: {
    label: "Autumn Budget 2025: nil-rate bands frozen to April 2031",
    url: "https://www.covermagazine.co.uk/news/4522431/budget-iht-nil-rate-bands-frozen",
  },
  rnrbTaper: { label: "HMRC IHTM46023: tapered withdrawal of the RNRB", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm46023" },
  rnrbBroughtForward: { label: "HMRC IHTM46044: taper and brought-forward allowance", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm46044" },
  downsizing: {
    label: "GOV.UK: how downsizing affects the additional threshold",
    url: "https://www.gov.uk/guidance/how-downsizing-selling-or-gifting-a-home-affects-the-additional-inheritance-tax-threshold",
  },
  downsizingTaper: { label: "HMRC IHTM46067: downsizing and the taper threshold", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm46067" },
  charity: { label: "IHTA 1984 Schedule 1A; HMRC IHTM45000 (reduced rate)", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm45000" },
  reliefs: {
    label: "GOV.UK: APR and BPR changes from 6 April 2026 (Finance Act 2026 s.65, Sch 12)",
    url: "https://www.gov.uk/government/publications/changes-to-agricultural-property-relief-and-business-property-relief/agricultural-property-relief-and-business-property-relief-changes",
  },
  pensions: {
    label: "HMRC technical note: IHT on pensions from 6 April 2027 (Finance Act 2026)",
    url: "https://www.gov.uk/government/publications/inheritance-tax-on-pensions-technical-note/technical-note-inheritance-tax-on-pensions",
  },
  gifts: { label: "GOV.UK: Inheritance Tax on gifts", url: "https://www.gov.uk/inheritance-tax/gifts" },
  qsr: { label: "HMRC IHTM22051–22052: quick succession relief", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm22052" },
  spouseCap: { label: "HMRC IHTM11033: spouse exemption where the spouse is non-UK", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm11033" },
  exceptedLowValue: { label: "HMRC IHTM06012: low value excepted estates", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm06012" },
  exceptedExempt: { label: "HMRC IHTM06013: exempt excepted estates", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm06013" },
  intestacy: { label: "HMRC IHTM12122: intestacy statutory legacy", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm12122" },
  dueDate: { label: "HMRC: IHT is due by the end of the sixth month after death", url: "https://www.gov.uk/paying-inheritance-tax" },
  rates: { label: "GOV.UK: How Inheritance Tax works", url: "https://www.gov.uk/inheritance-tax" },
} satisfies Record<string, SourceRef>;

interface Row<T> {
  from: ISODate;
  value: T;
  source: SourceRef;
}

const POUND = 100;

/** Rows in ascending date order. The row in force is the last with `from` ≤ the date. */
function pick<T>(rows: Row<T>[], date: ISODate): Row<T> {
  let hit = rows[0];
  for (const r of rows) if (r.from <= date) hit = r;
  return hit;
}

// ── Thresholds ─────────────────────────────────────────────────────────────

export const NIL_RATE_BAND: Row<Pence>[] = [{ from: "2009-04-06", value: 325_000 * POUND, source: SOURCES.rnrbAmounts }];

export const RESIDENCE_NIL_RATE_BAND: Row<Pence>[] = [
  { from: "2017-04-06", value: 100_000 * POUND, source: SOURCES.rnrbAmounts },
  { from: "2018-04-06", value: 125_000 * POUND, source: SOURCES.rnrbAmounts },
  { from: "2019-04-06", value: 150_000 * POUND, source: SOURCES.rnrbAmounts },
  { from: "2020-04-06", value: 175_000 * POUND, source: SOURCES.rnrbAmounts },
];

export const RNRB_TAPER_THRESHOLD: Row<Pence>[] = [{ from: "2017-04-06", value: 2_000_000 * POUND, source: SOURCES.rnrbTaper }];

/**
 * The thresholds above are statutory until 5 April 2030 (IHTM46002) and were
 * announced as frozen to April 2031 at Autumn Budget 2025. Deaths after this
 * date get a "confirm" flag rather than a silent assumption.
 */
export const CONFIRMED_THROUGH: ISODate = "2030-04-05";

/** The rules engine supports deaths from the start of the RNRB. */
export const EARLIEST_SUPPORTED_DEATH: ISODate = "2017-04-06";

// ── Rates ──────────────────────────────────────────────────────────────────

export const STANDARD_RATE_BP = 4_000;
export const CHARITY_RATE_BP = 3_600;
export const CHARITY_TEST_BP = 1_000;

// ── Reliefs ────────────────────────────────────────────────────────────────

/** Allowance for 100% business/agricultural relief. null = no cap. */
export const RELIEF_ALLOWANCE: Row<Pence | null>[] = [
  { from: "1992-03-10", value: null, source: SOURCES.reliefs },
  { from: "2026-04-06", value: 2_500_000 * POUND, source: SOURCES.reliefs },
];

/** Lifetime gifts on or after this date use up the allowance when the donor dies from 6 April 2026. */
export const RELIEF_ALLOWANCE_GIFTS_FROM: ISODate = "2024-10-30";

// ── Pensions ───────────────────────────────────────────────────────────────

export const PENSIONS_IN_ESTATE: Row<boolean>[] = [
  { from: "1986-03-18", value: false, source: SOURCES.pensions },
  { from: "2027-04-06", value: true, source: SOURCES.pensions },
];

// ── Lifetime gifts ─────────────────────────────────────────────────────────

export const ANNUAL_EXEMPTION: Pence = 3_000 * POUND;
export const SMALL_GIFT_LIMIT: Pence = 250 * POUND;
export const WEDDING_GIFT_LIMIT: Record<"child" | "grandchild" | "other", Pence> = {
  child: 5_000 * POUND,
  grandchild: 2_500 * POUND,
  other: 1_000 * POUND,
};

/**
 * Taper relief: percentage of the full tax still payable, by the band
 * returned from `yearsBand(gift, death)`. Bands 0–2 (not more than 3 years)
 * pay in full.
 */
export const TAPER_PAYABLE_BP = [10_000, 10_000, 10_000, 8_000, 6_000, 4_000, 2_000];

/** Quick succession relief percentage by `yearsBand(earlier transfer, death)`. */
export const QSR_BP = [10_000, 8_000, 6_000, 4_000, 2_000];

// ── Downsizing ─────────────────────────────────────────────────────────────

export const DOWNSIZING_FROM: ISODate = "2015-07-08";
/** Disposals before the RNRB began are measured against £100,000. */
export const DOWNSIZING_PRE_RNRB_ALLOWANCE: Pence = 100_000 * POUND;

// ── Excepted estates ───────────────────────────────────────────────────────

export const EXCEPTED_ESTATES: Row<ExceptedLimits>[] = [
  {
    from: "2010-03-01",
    value: {
      regime: "pre_2022",
      exemptGrossLimitPence: 1_000_000 * POUND,
      specifiedTransfersLimitPence: 150_000 * POUND,
      trustLimitPence: 150_000 * POUND,
      foreignLimitPence: 100_000 * POUND,
    },
    source: SOURCES.exceptedExempt,
  },
  {
    from: "2022-01-01",
    value: {
      regime: "2022",
      exemptGrossLimitPence: 3_000_000 * POUND,
      specifiedTransfersLimitPence: 250_000 * POUND,
      trustLimitPence: 250_000 * POUND,
      foreignLimitPence: 100_000 * POUND,
    },
    source: SOURCES.exceptedLowValue,
  },
];

// ── Intestacy (England & Wales) ────────────────────────────────────────────

/** Statutory legacy for a spouse or civil partner where the deceased left issue. */
export const STATUTORY_LEGACY: Row<Pence>[] = [
  { from: "2014-10-01", value: 250_000 * POUND, source: SOURCES.intestacy },
  { from: "2020-02-06", value: 270_000 * POUND, source: SOURCES.intestacy },
  { from: "2023-07-26", value: 322_000 * POUND, source: SOURCES.intestacy },
];

export const INTESTACY_SUPPORTED_FROM: ISODate = "2014-10-01";

export function statutoryLegacy(dateOfDeath: ISODate) {
  return pick(STATUTORY_LEGACY, dateOfDeath);
}

export function nilRateBandAt(date: ISODate): Pence {
  return pick(NIL_RATE_BAND, date).value;
}

export function residenceNilRateBandAt(date: ISODate): Pence {
  return pick(RESIDENCE_NIL_RATE_BAND, date).value;
}

/** Select every rule for a date of death. */
export function rulesFor(dateOfDeath: ISODate): RuleSnapshot {
  const nrb = pick(NIL_RATE_BAND, dateOfDeath);
  const rnrb = pick(RESIDENCE_NIL_RATE_BAND, dateOfDeath);
  const taper = pick(RNRB_TAPER_THRESHOLD, dateOfDeath);
  const allowance = pick(RELIEF_ALLOWANCE, dateOfDeath);
  const pensions = pick(PENSIONS_IN_ESTATE, dateOfDeath);
  const excepted = pick(EXCEPTED_ESTATES, dateOfDeath);
  return {
    dateOfDeath,
    nilRateBand: { value: nrb.value, source: nrb.source },
    residenceNilRateBand: { value: rnrb.value, source: rnrb.source },
    rnrbTaperThreshold: { value: taper.value, source: taper.source },
    rateBp: { value: STANDARD_RATE_BP, source: SOURCES.rates },
    charityRateBp: { value: CHARITY_RATE_BP, source: SOURCES.charity },
    charityTestBp: { value: CHARITY_TEST_BP, source: SOURCES.charity },
    reliefAllowance: { value: allowance.value, source: allowance.source },
    pensionsInEstate: { value: pensions.value, source: pensions.source },
    excepted: { value: excepted.value, source: excepted.source },
    confirmedThrough: CONFIRMED_THROUGH,
  };
}
