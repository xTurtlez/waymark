import { ANNUAL_EXEMPTION, RELIEF_ALLOWANCE_GIFTS_FROM, SMALL_GIFT_LIMIT, SOURCES, STANDARD_RATE_BP, TAPER_PAYABLE_BP, WEDDING_GIFT_LIMIT } from "./tables";
import type { Flag, GiftResult, ISODate, LifetimeGift, Line, Pence } from "./types";
import { addYears, applyBp, formatPounds, pos, taxYearOf, yearsBand } from "./util";

export interface GiftsContext {
  dateOfDeath: ISODate;
  /** Nil-rate band at death plus any transferred nil-rate band. */
  bandPence: Pence;
  /** Remaining spouse exemption when it is capped; null when unlimited. */
  spouseCapPence: Pence | null;
  /** 100% relief allowance for the death (incl. any transferred); null = no cap. */
  reliefAllowancePence: Pence | null;
}

export interface GiftsOutcome {
  results: GiftResult[];
  lines: Line[];
  flags: Flag[];
  /** Chargeable value of gifts in the 7 years before death: uses up the estate's nil-rate band. */
  againstBandPence: Pence;
  taxPence: Pence;
  reliefAllowanceUsedPence: Pence;
  spouseCapUsedPence: Pence;
  /** For the excepted-estate tests. */
  specifiedTransfersPence: Pence;
  specifiedExemptTransfersPence: Pence;
  trustGiftWithinSevenYears: boolean;
}

/** Death within 7 years of the gift: "seven years or more before death" is exempt. */
export function isWithinSevenYears(madeOn: ISODate, dateOfDeath: ISODate): boolean {
  return dateOfDeath < addYears(madeOn, 7);
}

export function assessLifetimeGifts(gifts: LifetimeGift[], ctx: GiftsContext): GiftsOutcome {
  const flags: Flag[] = [];
  const lines: Line[] = [];
  const ordered = gifts
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.madeOn < ctx.dateOfDeath)
    .sort((a, b) => (a.g.madeOn === b.g.madeOn ? a.i - b.i : a.g.madeOn < b.g.madeOn ? -1 : 1))
    .map(({ g }) => g);
  if (ordered.length < gifts.length) {
    flags.push({ code: "gift_after_death", level: "info", message: "A gift dated on or after the date of death was ignored." });
  }

  const aeRemaining = new Map<number, Pence>();
  const aeLeft = (year: number) => aeRemaining.get(year) ?? ANNUAL_EXEMPTION;
  let spouseCap = ctx.spouseCapPence;
  let spouseCapUsed = 0;
  let allowance = ctx.reliefAllowancePence;
  let allowanceUsed = 0;

  const chargeableAt: { madeOn: ISODate; chargeable: Pence; counts: boolean }[] = [];
  const results: GiftResult[] = [];

  for (const g of ordered) {
    const exemptions: { kind: string; amountPence: Pence }[] = [];
    let remaining = g.valuePence;
    const take = (kind: string, amount: Pence) => {
      const a = Math.min(remaining, pos(amount));
      if (a > 0) {
        exemptions.push({ kind, amountPence: a });
        remaining -= a;
      }
    };

    if (g.recipientCategory === "spouse") {
      if (spouseCap === null) {
        take("spouse", remaining);
      } else {
        const before = remaining;
        take("spouse", spouseCap);
        spouseCap -= before - remaining;
        spouseCapUsed += before - remaining;
        if (remaining > 0) {
          flags.push({
            code: "spouse_cap_gift",
            level: "confirm",
            message: `${g.label}: the spouse exemption is capped because the spouse is not UK resident; ${formatPounds(remaining)} is chargeable.`,
            source: SOURCES.spouseCap,
          });
        }
      }
    } else if (g.recipientCategory === "charity") {
      take("charity", remaining);
    } else {
      if (g.smallGift) {
        if (g.valuePence <= SMALL_GIFT_LIMIT) take("small_gift", remaining);
        else flags.push({ code: "small_gift_over_limit", level: "info", message: `${g.label}: the small gifts exemption only covers gifts of £250 or less, so it doesn't apply.`, source: SOURCES.gifts });
      }
      if (g.weddingGift) take("wedding", WEDDING_GIFT_LIMIT[g.weddingGift]);
      if (g.normalExpenditure && remaining > 0) {
        take("normal_expenditure", remaining);
        flags.push({
          code: "normal_expenditure",
          level: "confirm",
          message: `${g.label}: treated as normal expenditure out of income. A solicitor must confirm it was regular, from income, and left the donor's standard of living intact.`,
          source: SOURCES.gifts,
        });
      }
    }

    // Business and agricultural relief, as it applies at death.
    let reliefPence = 0;
    if (g.relief && remaining > 0) {
      if (!g.relief.stillQualifiesAtDeath) {
        flags.push({ code: "gift_relief_lost", level: "confirm", message: `${g.label}: relief withdrawn because the property no longer qualifies at death. Confirm with the recipient.` });
      } else if (g.relief.rate === "half") {
        reliefPence = applyBp(remaining, 5_000);
      } else if (allowance === null || g.madeOn < RELIEF_ALLOWANCE_GIFTS_FROM) {
        reliefPence = remaining;
      } else {
        const full = Math.min(remaining, allowance);
        allowance -= full;
        allowanceUsed += full;
        reliefPence = full + applyBp(remaining - full, 5_000);
      }
      remaining -= reliefPence;
    }

    // Annual exemption: this tax year first, then last year's unused amount.
    // (Also covers the part of a gift to a non-resident spouse above the cap.)
    if (remaining > 0) {
      const year = taxYearOf(g.madeOn);
      const own = Math.min(remaining, aeLeft(year));
      aeRemaining.set(year, aeLeft(year) - own);
      const carried = Math.min(remaining - own, aeLeft(year - 1));
      aeRemaining.set(year - 1, aeLeft(year - 1) - carried);
      take("annual", own + carried);
    }

    const chargeable = remaining;
    const within = isWithinSevenYears(g.madeOn, ctx.dateOfDeath);
    const isTrust = g.form === "trust";
    // Chargeable transfers that count in cumulation: CLTs, and PETs that failed.
    const counts = chargeable > 0 && (isTrust || within);

    let cumulativeBefore = 0;
    for (const prior of chargeableAt) if (prior.counts && g.madeOn < addYears(prior.madeOn, 7)) cumulativeBefore += prior.chargeable;
    chargeableAt.push({ madeOn: g.madeOn, chargeable, counts });

    const band = pos(ctx.bandPence - cumulativeBefore);
    const taxable = within ? pos(chargeable - band) : 0;
    const taxBeforeTaper = applyBp(taxable, STANDARD_RATE_BP);
    const payableBp = TAPER_PAYABLE_BP[Math.min(yearsBand(g.madeOn, ctx.dateOfDeath), 6)];
    const afterTaper = applyBp(taxBeforeTaper, payableBp);
    const credit = isTrust ? Math.min(afterTaper, g.lifetimeTaxPaidPence ?? 0) : 0;
    const tax = afterTaper - credit;

    results.push({
      id: g.id,
      label: g.label,
      madeOn: g.madeOn,
      valuePence: g.valuePence,
      exemptPence: g.valuePence - chargeable - reliefPence,
      exemptions,
      reliefPence,
      chargeablePence: chargeable,
      withinSevenYears: within && chargeable > 0,
      cumulativeBeforePence: cumulativeBefore,
      nilRateBandAvailablePence: band,
      taxableAbovePence: taxable,
      taxBeforeTaperPence: taxBeforeTaper,
      taperPayableBp: payableBp,
      lifetimeTaxCreditPence: credit,
      taxPence: tax,
    });
  }

  const withinResults = results.filter((r) => r.withinSevenYears);
  const againstBand = withinResults.reduce((n, r) => n + r.chargeablePence, 0);
  const taxPence = results.reduce((n, r) => n + r.taxPence, 0);

  for (const r of withinResults) {
    lines.push({
      id: `gift:${r.id}`,
      section: "gifts",
      label: `${r.label} (${r.madeOn})`,
      amountPence: r.chargeablePence,
      op: "add",
      detail:
        `Value ${formatPounds(r.valuePence)}` +
        (r.exemptPence ? `, exemptions ${formatPounds(r.exemptPence)}` : "") +
        (r.reliefPence ? `, relief ${formatPounds(r.reliefPence)}` : "") +
        `. Nil-rate band left for this gift ${formatPounds(r.nilRateBandAvailablePence)}` +
        (r.taxPence ? `; tax ${formatPounds(r.taxPence)}${r.taperPayableBp < 10_000 ? ` after taper relief (${r.taperPayableBp / 100}% payable)` : ""}${r.lifetimeTaxCreditPence ? `, less ${formatPounds(r.lifetimeTaxCreditPence)} paid in lifetime` : ""}.` : "; no tax on the gift."),
      source: SOURCES.gifts,
      refs: [r.id],
    });
  }
  if (withinResults.length) {
    lines.push({
      id: "gifts:total",
      section: "gifts",
      label: "Chargeable gifts in the 7 years before death",
      amountPence: againstBand,
      op: "total",
      detail: "These use the nil-rate band before the estate does.",
    });
  }
  if (taxPence) {
    lines.push({ id: "gifts:tax", section: "gifts", label: "Tax on gifts (payable by the recipients)", amountPence: taxPence, op: "total" });
  }

  const ordinaryWithin = results.filter((r) => isWithinSevenYears(r.madeOn, ctx.dateOfDeath));
  const byId = new Map(ordered.map((g) => [g.id, g]));
  const specifiedTransfersPence = ordinaryWithin.filter((r) => byId.get(r.id)!.form !== "trust").reduce((n, r) => n + r.chargeablePence, 0);
  const specifiedExemptTransfersPence = ordinaryWithin
    .filter((r) => ["spouse", "charity"].includes(byId.get(r.id)!.recipientCategory))
    .reduce((n, r) => n + r.valuePence, 0);
  const trustGiftWithinSevenYears = ordinaryWithin.some((r) => byId.get(r.id)!.form === "trust");

  return {
    results,
    lines,
    flags,
    againstBandPence: againstBand,
    taxPence,
    reliefAllowanceUsedPence: allowanceUsed,
    spouseCapUsedPence: spouseCapUsed,
    specifiedTransfersPence,
    specifiedExemptTransfersPence,
    trustGiftWithinSevenYears,
  };
}
