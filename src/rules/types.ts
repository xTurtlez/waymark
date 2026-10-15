/**
 * Inputs and outputs of the Waymark rules engine.
 *
 * The engine is pure: no I/O, no clock, no randomness. Everything it needs,
 * including the date of death that selects the rule set, comes in here.
 *
 * Conventions:
 * - Money is integer pence. Percentages are basis points (10000 = 100%).
 * - Dates are ISO calendar dates ("2026-05-14").
 * - Values are the deceased's share at the date of death, before liabilities.
 */

export type Pence = number;
export type BasisPoints = number;
export type ISODate = string;

/** How a recipient is treated for IHT. */
export type RecipientCategory =
  /** Spouse or civil partner: exempt (capped if `spouseExemptionLimited`). */
  | "spouse"
  /** UK (or qualifying) charity, absolute gift: exempt, counts for the 36% test. */
  | "charity"
  /** Child, grandchild, step/adopted/foster child or their spouse: "closely inherited" for the RNRB. */
  | "lineal_descendant"
  /** Anyone else: chargeable. */
  | "other";

export interface Recipient {
  id: string;
  name: string;
  category: RecipientCategory;
}

export type AssetKind =
  | "property"
  | "bank"
  | "savings"
  | "bonds"
  | "listed_shares"
  | "unlisted_shares"
  | "business"
  | "agricultural"
  | "pension"
  | "life_policy"
  | "chattels"
  | "debt_due"
  | "other";

export interface Relief {
  kind: "business" | "agricultural";
  /**
   * `full`: property that qualifies for 100% relief (subject to the £2.5m
   * allowance for deaths from 6 April 2026). `half`: 50% relief property,
   * including shares designated "not listed" (e.g. AIM) from 6 April 2026.
   */
  rate: "full" | "half";
}

export interface EstateAsset {
  id: string;
  label: string;
  kind: AssetKind;
  /** The deceased's share at date of death, before liabilities. */
  valuePence: Pence;
  /** `joint_tenancy` passes by survivorship to `survivorRecipientId`. Default `sole`. */
  ownership?: "sole" | "joint_tenancy" | "tenancy_in_common";
  survivorRecipientId?: string;
  /** The residence nominated as the qualifying residential interest for the RNRB. */
  qualifyingResidence?: boolean;
  relief?: Relief;
  /** Pension treatment. Only `unused_fund` is ever in the estate (and only for deaths from 6 April 2027). */
  pension?: "unused_fund" | "death_in_service" | "dependants_scheme_pension";
  /** Who the pension benefit is paid to (for spouse and charity exemptions). */
  pensionRecipientId?: string;
  foreign?: boolean;
  /** Gift with reservation of benefit: taxed as part of the estate; the donee bears the tax. */
  giftWithReservation?: boolean;
  giftWithReservationRecipientId?: string;
  /** Settled property (interest in possession trust). Not calculated yet. */
  settled?: boolean;
}

export interface Liability {
  id: string;
  label: string;
  amountPence: Pence;
  kind: "debt" | "mortgage" | "funeral";
  /** A liability charged on one asset (e.g. a mortgage) reduces that asset first. */
  securedOnAssetId?: string;
  /** False when the debt is not deductible (e.g. unpaid after death, Finance Act 2013 rules). Default true. */
  deductible?: boolean;
}

export type Disposition =
  /** A specific asset (or a share of it) left to someone. */
  | { kind: "specific"; id: string; assetId: string; recipientId: string; shareBp?: BasisPoints; bearsOwnTax?: boolean }
  /** A cash legacy. Free of tax unless `bearsOwnTax`. */
  | { kind: "pecuniary"; id: string; amountPence: Pence; recipientId: string; bearsOwnTax?: boolean }
  /** A share of residue. Shares should add up to 10000. */
  | { kind: "residue"; id: string; recipientId: string; shareBp: BasisPoints };

export interface IntestacyBranch {
  name: string;
  /** Alive at the death (and, for minors, takes on statutory trusts). */
  alive: boolean;
  /** For someone who died before the deceased: their own issue take their share. */
  descendants?: IntestacyBranch[];
}

export interface IntestacyFamily {
  /** Married or in a civil partnership at death, and survived the deceased by 28 days. */
  spouseName?: string;
  issue: IntestacyBranch[];
  parents: string[];
  siblingsWhole: IntestacyBranch[];
  siblingsHalf: IntestacyBranch[];
  grandparents: string[];
  auntsUnclesWhole: IntestacyBranch[];
  auntsUnclesHalf: IntestacyBranch[];
}

export type Succession =
  | { type: "will"; dispositions: Disposition[]; /** Will directs Benham-style division of residue. */ residueBenham?: boolean }
  | { type: "intestacy"; family: IntestacyFamily };

export interface LifetimeGift {
  id: string;
  label: string;
  madeOn: ISODate;
  valuePence: Pence;
  recipientCategory: RecipientCategory;
  /** `outright` to a person is a PET; `trust` is a chargeable lifetime transfer (CLT). */
  form?: "outright" | "trust";
  /** Tax already paid on a CLT when it was made. */
  lifetimeTaxPaidPence?: Pence;
  /** Gift of £250 or less to someone who had no other gift that year. */
  smallGift?: boolean;
  weddingGift?: "child" | "grandchild" | "other";
  /** Claimed as normal expenditure out of income (solicitor must confirm). */
  normalExpenditure?: boolean;
  /** Business or agricultural relief, if the property still qualifies at death. */
  relief?: Relief & { stillQualifiesAtDeath: boolean };
}

export interface PriorTransfer {
  id: string;
  label: string;
  /** Date of the earlier transfer (usually the earlier death). */
  transferOn: ISODate;
  /** A: the increase in the deceased's estate from that transfer. */
  netIncreasePence: Pence;
  /** D: the value of the earlier chargeable transfer. */
  grossTransferPence: Pence;
  /** B: tax paid on the earlier chargeable transfer. */
  taxPaidPence: Pence;
}

export interface IhtInput {
  dateOfDeath: ISODate;
  /** Long-term UK resident (deaths from 6 April 2025) or UK-domiciled (earlier deaths). */
  longTermUkResident: boolean;
  recipients: Recipient[];
  assets: EstateAsset[];
  liabilities: Liability[];
  succession: Succession;
  lifetimeGifts?: LifetimeGift[];
  /** Unused nil-rate band transferred from a predeceased spouse, as a percentage (max 100%). */
  transferredNrbBp?: BasisPoints;
  /** Unused residence nil-rate band transferred from a predeceased spouse (max 100%). */
  transferredRnrbBp?: BasisPoints;
  /** The deceased was UK resident and the surviving spouse is not: exemption capped at the nil-rate band. */
  spouseExemptionLimited?: boolean;
  /** A former home sold or given away on or after 8 July 2015. */
  downsizing?: { disposedOn: ISODate; formerResidenceValuePence: Pence };
  /** Unused 100% relief allowance transferred from a predeceased spouse (deaths from 6 April 2026). */
  reliefAllowanceTransferredPence?: Pence;
  priorTransfers?: PriorTransfer[];
  /** Personal representatives elect to merge components for the 36% charity rate. */
  mergeCharityComponents?: boolean;
}

// ── Output ────────────────────────────────────────────────────────────────

export interface SourceRef {
  label: string;
  url: string;
}

export type FlagLevel =
  /** A solicitor must confirm a judgment or a rule the engine can't verify. */
  | "confirm"
  /** Part of the estate the engine doesn't calculate; the figures are incomplete. */
  | "out_of_scope"
  /** For information. */
  | "info";

export interface Flag {
  code: string;
  level: FlagLevel;
  message: string;
  source?: SourceRef;
}

export type LineSection = "gifts" | "estate" | "reliefs" | "exemptions" | "allowances" | "tax" | "reporting";

export interface Line {
  id: string;
  section: LineSection;
  label: string;
  amountPence?: Pence;
  /** How the amount is applied: added, deducted, a subtotal, or for information. */
  op: "add" | "less" | "total" | "info";
  detail?: string;
  source?: SourceRef;
  refs?: string[];
}

export interface GiftResult {
  id: string;
  label: string;
  madeOn: ISODate;
  valuePence: Pence;
  exemptPence: Pence;
  exemptions: { kind: string; amountPence: Pence }[];
  reliefPence: Pence;
  chargeablePence: Pence;
  /** Made within 7 years of death and chargeable (failed PET or CLT). */
  withinSevenYears: boolean;
  /** Chargeable transfers in the 7 years before this gift. */
  cumulativeBeforePence: Pence;
  nilRateBandAvailablePence: Pence;
  taxableAbovePence: Pence;
  taxBeforeTaperPence: Pence;
  /** Percentage of the full tax payable after taper relief. */
  taperPayableBp: BasisPoints;
  lifetimeTaxCreditPence: Pence;
  taxPence: Pence;
}

export interface TaxAttribution {
  /** What bears the tax: residue, a survivorship asset, a pension, a gift... */
  bucket: "residue" | "specific_gift" | "survivorship" | "pension" | "gift_with_reservation" | "lifetime_gift";
  refId: string;
  label: string;
  chargeablePence: Pence;
  taxPence: Pence;
}

export type ReportingRoute = "excepted_low_value" | "excepted_exempt" | "iht205" | "iht400";

export interface IhtResult {
  dateOfDeath: ISODate;
  ruleSet: RuleSnapshot;
  lines: Line[];
  flags: Flag[];
  gifts: GiftResult[];
  estate: {
    grossPence: Pence;
    excludedPence: Pence;
    liabilitiesPence: Pence;
    netPence: Pence;
    reliefsPence: Pence;
    spouseExemptPence: Pence;
    charityExemptPence: Pence;
    /** Chargeable value of the death estate, after grossing up where needed. */
    chargeablePence: Pence;
    nilRateBandPence: Pence;
    transferredNilRateBandPence: Pence;
    lifetimeGiftsAgainstBandPence: Pence;
    nilRateBandAvailablePence: Pence;
    residenceNilRateBandPence: Pence;
    downsizingAdditionPence: Pence;
    taxablePence: Pence;
    rateBp: BasisPoints;
    taxBeforeReliefPence: Pence;
    quickSuccessionReliefPence: Pence;
    taxPence: Pence;
    /** Tax divided by chargeable value. */
    estateRateBp: BasisPoints;
  };
  rnrb: {
    defaultAllowancePence: Pence;
    taperReductionPence: Pence;
    adjustedAllowancePence: Pence;
    qualifyingResidencePence: Pence;
    closelyInheritedResidencePence: Pence;
    lostRelievableAmountPence: Pence;
  };
  attribution: TaxAttribution[];
  totalTaxPence: Pence;
  /** Unused allowances a surviving spouse's estate could later claim, as percentages. */
  transferable: { nilRateBandBp: BasisPoints; residenceNilRateBandBp: BasisPoints; reliefAllowancePence: Pence | null };
  reporting: { route: ReportingRoute; reasons: string[]; schedules: { form: string; title: string }[] };
  /** Tax on the death estate is due by the end of the sixth month after the month of death. */
  paymentDueOn: ISODate;
  /** False when out-of-scope flags mean some value wasn't calculated. */
  complete: boolean;
}

export interface RuleValue<T> {
  value: T;
  source: SourceRef;
}

/** The rule values selected for a date of death. */
export interface RuleSnapshot {
  dateOfDeath: ISODate;
  nilRateBand: RuleValue<Pence>;
  residenceNilRateBand: RuleValue<Pence>;
  rnrbTaperThreshold: RuleValue<Pence>;
  rateBp: RuleValue<BasisPoints>;
  charityRateBp: RuleValue<BasisPoints>;
  charityTestBp: RuleValue<BasisPoints>;
  /** null: no cap on 100% relief (deaths before 6 April 2026). */
  reliefAllowance: RuleValue<Pence | null>;
  pensionsInEstate: RuleValue<boolean>;
  excepted: RuleValue<ExceptedLimits>;
  /** The figures are only confirmed up to this date of death. */
  confirmedThrough: ISODate;
}

export interface ExceptedLimits {
  regime: "2022" | "pre_2022";
  exemptGrossLimitPence: Pence;
  specifiedTransfersLimitPence: Pence;
  trustLimitPence: Pence;
  foreignLimitPence: Pence;
}
