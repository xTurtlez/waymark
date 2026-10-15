import { assessLifetimeGifts } from "./gifts";
import { intestacyAsDispositions } from "./intestacy";
import { quickSuccessionRelief } from "./qsr";
import { deathEstateReliefs } from "./reliefs";
import { reportingRoute, schedulesFor } from "./reporting";
import { computeRnrb } from "./rnrb";
import { EARLIEST_SUPPORTED_DEATH, SOURCES, rulesFor } from "./tables";
import type {
  BasisPoints,
  Disposition,
  EstateAsset,
  Flag,
  IhtInput,
  IhtResult,
  Line,
  Pence,
  Recipient,
  RecipientCategory,
  TaxAttribution,
} from "./types";
import { applyBp, clampBp, endOfSixthMonthAfter, formatBp, formatPounds, isValidDate, pos, prorate, ratioBp, sum } from "./util";

type Bucket = "free" | "survivorship" | "pension" | "reservation";

/** A slice of the estate passing to one recipient, after reliefs. */
interface Piece {
  id: string;
  label: string;
  component: Bucket;
  recipient: Recipient;
  /** Value after liabilities and reliefs (before any grossing up). */
  valuePence: Pence;
  /** Value before reliefs (for "closely inherited" values). */
  preReliefPence: Pence;
  /** True when the recipient pays the tax on it (not the residue). */
  bearsOwnTax: boolean;
  /** "gift" = specific or pecuniary legacy from the free estate; "residue" = a share of residue. */
  kind: "gift" | "residue" | "other";
  attribution: TaxAttribution["bucket"];
  isResidence?: boolean;
}

const UNKNOWN: Recipient = { id: "unknown", name: "Unknown recipient", category: "other" };
const isExempt = (c: RecipientCategory) => c === "spouse" || c === "charity";

/** Value n grossed up so that n is what's left after tax at `rateBp` above `band`. */
export function grossUp(n: Pence, band: Pence, rateBp: BasisPoints): Pence {
  if (n <= band) return n;
  return band + Math.round(((n - band) * 10_000) / (10_000 - rateBp));
}

export function calculateIht(input: IhtInput): IhtResult {
  if (!isValidDate(input.dateOfDeath)) throw new Error(`Invalid date of death: ${input.dateOfDeath}`);
  const dod = input.dateOfDeath;
  const rules = rulesFor(dod);
  const flags: Flag[] = [];
  const lines: Line[] = [];
  const NRB = rules.nilRateBand.value;

  if (dod < EARLIEST_SUPPORTED_DEATH) {
    flags.push({ code: "death_before_2017", level: "out_of_scope", message: "Deaths before 6 April 2017 aren't supported: the figures below use the current rules." });
  }
  if (dod > rules.confirmedThrough) {
    flags.push({
      code: "rates_unconfirmed",
      level: "confirm",
      message: "Thresholds are confirmed to 5 April 2030. The freeze to April 2031 was announced at Autumn Budget 2025; confirm the figures for this date of death.",
      source: SOURCES.thresholdsFrozen2031,
    });
  }
  if (!input.longTermUkResident) {
    flags.push({
      code: "non_resident",
      level: "out_of_scope",
      message: "The deceased was not a long-term UK resident: only UK assets are chargeable and different rules apply. Include UK assets only and have a solicitor check the calculation.",
    });
  }

  // ── Recipients and succession ────────────────────────────────────────────
  const recipients = new Map<string, Recipient>(input.recipients.map((r) => [r.id, r]));
  const recipientFor = (id: string | undefined, what: string): Recipient => {
    const r = id ? recipients.get(id) : undefined;
    if (!r) {
      flags.push({ code: `recipient_missing:${what}`, level: "confirm", message: `${what}: no recipient recorded, so it's treated as chargeable.` });
      return UNKNOWN;
    }
    return r;
  };

  let dispositions: Disposition[];
  let residueBenham = false;
  if (input.succession.type === "will") {
    dispositions = input.succession.dispositions;
    residueBenham = !!input.succession.residueBenham;
  } else {
    const chattels = input.assets.filter((a) => a.kind === "chattels" && (a.ownership ?? "sole") !== "joint_tenancy").map((a) => a.id);
    const intestacy = intestacyAsDispositions(input.succession.family, dod, chattels);
    for (const r of intestacy.recipients) recipients.set(r.id, r);
    dispositions = intestacy.dispositions;
    flags.push(...intestacy.flags);
    lines.push({ id: "succession:intestacy", section: "estate", label: "No will: the estate passes under the intestacy rules", op: "info", source: SOURCES.intestacy });
  }
  if (residueBenham) {
    flags.push({
      code: "benham",
      level: "out_of_scope",
      message: "The will divides residue so each beneficiary receives the same after tax (Re Benham). This is calculated on the usual (Ratcliffe) basis; have a solicitor recalculate.",
    });
  }

  // ── Classify property ────────────────────────────────────────────────────
  const included: (EstateAsset & { bucket: Bucket })[] = [];
  let excludedPence = 0;
  for (const a of input.assets) {
    if (a.settled) {
      flags.push({ code: `settled:${a.id}`, level: "out_of_scope", message: `${a.label}: trust property isn't calculated yet. Its value is left out.` });
      excludedPence += a.valuePence;
      continue;
    }
    if (a.kind === "pension" || a.pension) {
      const treatment = a.pension ?? "unused_fund";
      if (treatment !== "unused_fund") {
        excludedPence += a.valuePence;
        lines.push({
          id: `excluded:${a.id}`,
          section: "estate",
          label: `${a.label} (outside the estate)`,
          amountPence: a.valuePence,
          op: "info",
          detail: treatment === "death_in_service" ? "Death-in-service benefits are excluded." : "Dependants' scheme pensions are excluded.",
          source: SOURCES.pensions,
        });
        continue;
      }
      if (!rules.pensionsInEstate.value) {
        excludedPence += a.valuePence;
        lines.push({ id: `excluded:${a.id}`, section: "estate", label: `${a.label} (outside the estate)`, amountPence: a.valuePence, op: "info", detail: "Pensions are generally outside the estate for deaths before 6 April 2027.", source: SOURCES.pensions });
        flags.push({
          code: `pension_pre_2027:${a.id}`,
          level: "confirm",
          message: `${a.label}: left out as a discretionary pension. Confirm there's no benefit the estate was entitled to as of right.`,
          source: SOURCES.pensions,
        });
        continue;
      }
      included.push({ ...a, bucket: "pension" });
      continue;
    }
    if (a.giftWithReservation) included.push({ ...a, bucket: "reservation" });
    else if (a.ownership === "joint_tenancy") included.push({ ...a, bucket: "survivorship" });
    else included.push({ ...a, bucket: "free" });
  }

  // ── Liabilities ──────────────────────────────────────────────────────────
  const net = new Map<string, Pence>(included.map((a) => [a.id, a.valuePence]));
  let unsecured = 0;
  let securedDeducted = 0;
  for (const l of input.liabilities) {
    if (l.deductible === false) {
      lines.push({ id: `liability:${l.id}`, section: "estate", label: `${l.label} (not deductible)`, amountPence: l.amountPence, op: "info" });
      continue;
    }
    const on = l.securedOnAssetId ? included.find((a) => a.id === l.securedOnAssetId) : undefined;
    if (on) {
      const take = Math.min(l.amountPence, net.get(on.id)!);
      net.set(on.id, net.get(on.id)! - take);
      securedDeducted += take;
      unsecured += l.amountPence - take;
    } else {
      unsecured += l.amountPence;
    }
  }
  const free = included.filter((a) => a.bucket === "free");
  const freeBeforeDebts = sum(free.map((a) => net.get(a.id)!));
  const unsecuredDeducted = Math.min(unsecured, freeBeforeDebts);
  if (unsecured > unsecuredDeducted) {
    flags.push({
      code: "liabilities_exceed_free_estate",
      level: "confirm",
      message: `Debts exceed the free estate by ${formatPounds(unsecured - unsecuredDeducted)}. The excess isn't deducted from joint or other property; confirm how it should be met.`,
    });
  }
  const grossPence = sum(included.map((a) => a.valuePence));
  const liabilitiesPence = securedDeducted + unsecuredDeducted;
  const netPence = grossPence - liabilitiesPence;

  for (const a of included) {
    lines.push({
      id: `asset:${a.id}`,
      section: "estate",
      label: a.label + (a.bucket === "survivorship" ? " (joint, passes by survivorship)" : a.bucket === "pension" ? " (unused pension fund)" : a.bucket === "reservation" ? " (gift with reservation)" : ""),
      amountPence: a.valuePence,
      op: "add",
      refs: [a.id],
    });
  }
  if (liabilitiesPence) lines.push({ id: "estate:liabilities", section: "estate", label: "Less debts, mortgages and funeral costs", amountPence: liabilitiesPence, op: "less" });
  lines.push({ id: "estate:net", section: "estate", label: "Net estate", amountPence: netPence, op: "total" });

  // ── Lifetime gifts ───────────────────────────────────────────────────────
  const transferredNrbBp = clampBp(input.transferredNrbBp);
  const transferredRnrbBp = clampBp(input.transferredRnrbBp);
  const tnrb = applyBp(NRB, transferredNrbBp);
  const allowanceBase = rules.reliefAllowance.value === null ? null : rules.reliefAllowance.value + pos(input.reliefAllowanceTransferredPence ?? 0);
  const spouseCapStart = input.spouseExemptionLimited ? NRB : null;
  const gifts = assessLifetimeGifts(input.lifetimeGifts ?? [], {
    dateOfDeath: dod,
    bandPence: NRB + tnrb,
    spouseCapPence: spouseCapStart,
    reliefAllowancePence: allowanceBase,
  });
  flags.push(...gifts.flags);
  lines.push(...gifts.lines);

  // ── Reliefs on the death estate ──────────────────────────────────────────
  const allowanceLeft = allowanceBase === null ? null : pos(allowanceBase - gifts.reliefAllowanceUsedPence);
  const reliefs = deathEstateReliefs(
    included.filter((a) => a.bucket !== "pension").map((a) => ({ id: a.id, label: a.label, netPence: net.get(a.id)!, relief: a.relief })),
    allowanceLeft,
  );
  lines.push(...reliefs.lines);
  const reliefOf = (id: string) => reliefs.byAsset.get(id) ?? 0;

  // ── Who receives what ────────────────────────────────────────────────────
  const pieces: Piece[] = [];
  const qriAll = included.filter((a) => a.qualifyingResidence);
  if (qriAll.length > 1) flags.push({ code: "multiple_residences", level: "confirm", message: "More than one home is marked as the residence for the RNRB. The personal representatives must nominate one; the first is used." });
  const qri = qriAll[0];
  if (qri && qri.bucket !== "free" && qri.bucket !== "survivorship") {
    flags.push({ code: "residence_not_estate", level: "confirm", message: `${qri.label}: only a home in the estate (or passing by survivorship) can use the RNRB.` });
  }

  for (const a of included.filter((x) => x.bucket !== "free")) {
    const recipient =
      a.bucket === "survivorship"
        ? recipientFor(a.survivorRecipientId, a.label)
        : a.bucket === "pension"
          ? recipientFor(a.pensionRecipientId, a.label)
          : recipientFor(a.giftWithReservationRecipientId, a.label);
    pieces.push({
      id: a.id,
      label: a.label,
      component: a.bucket,
      recipient,
      valuePence: net.get(a.id)! - reliefOf(a.id),
      preReliefPence: net.get(a.id)!,
      bearsOwnTax: true,
      kind: "other",
      attribution: a.bucket === "pension" ? "pension" : a.bucket === "survivorship" ? "survivorship" : "gift_with_reservation",
      isResidence: a === qri,
    });
  }
  if (pieces.some((p) => p.component === "pension")) {
    flags.push({
      code: "pension_apportionment",
      level: "confirm",
      message: "Unused pension funds are taxed at the estate rate and counted towards the £2m RNRB taper here. Confirm against HMRC guidance for deaths from 6 April 2027.",
      source: SOURCES.pensions,
    });
  }

  // Free estate under the will or intestacy, with s.39A attribution of reliefs.
  const freeAfterDebts = freeBeforeDebts - unsecuredDeducted;
  const freeReliefTotal = sum(free.map((a) => reliefOf(a.id)));
  const freeById = new Map(free.map((a) => [a.id, a]));
  const specificShares = new Map<string, number>();
  const specifics: { d: Extract<Disposition, { kind: "specific" }>; pre: Pence; relief: Pence }[] = [];
  for (const d of dispositions) {
    if (d.kind !== "specific") continue;
    const a = freeById.get(d.assetId);
    if (!a) {
      flags.push({ code: `gift_asset_missing:${d.id}`, level: "confirm", message: "A specific gift refers to property that isn't in the free estate (it may be joint property or no longer owned). It's ignored." });
      continue;
    }
    const share = clampBp(d.shareBp ?? 10_000);
    const used = specificShares.get(a.id) ?? 0;
    const allowed = Math.min(share, 10_000 - used);
    specificShares.set(a.id, used + allowed);
    specifics.push({ d, pre: applyBp(net.get(a.id)!, allowed), relief: applyBp(reliefOf(a.id), allowed) });
  }
  const pecuniary = dispositions.filter((d): d is Extract<Disposition, { kind: "pecuniary" }> => d.kind === "pecuniary");
  const residueShares = dispositions.filter((d): d is Extract<Disposition, { kind: "residue" }> => d.kind === "residue");

  // s.39A: relief on property not specifically given is spread over the other gifts and residue.
  const relievableSpecific = specifics.filter((s) => s.relief > 0);
  const ePrime = freeAfterDebts - sum(relievableSpecific.map((s) => s.pre));
  const rPrime = freeReliefTotal - sum(relievableSpecific.map((s) => s.relief));
  const factor = (v: Pence) => (ePrime > 0 && rPrime > 0 ? prorate(v, ePrime - rPrime, ePrime) : v);

  const giftPieces: Piece[] = [];
  for (const s of specifics) {
    const a = freeById.get(s.d.assetId)!;
    giftPieces.push({
      id: s.d.id,
      label: `${a.label}${(s.d.shareBp ?? 10_000) < 10_000 ? ` (${formatBp(s.d.shareBp!)} share)` : ""}`,
      component: "free",
      recipient: recipientFor(s.d.recipientId, a.label),
      valuePence: s.relief > 0 ? s.pre - s.relief : factor(s.pre),
      preReliefPence: s.pre,
      bearsOwnTax: !!s.d.bearsOwnTax,
      kind: "gift",
      attribution: "specific_gift",
      isResidence: a === qri,
    });
  }
  const freeAfterReliefs = freeAfterDebts - freeReliefTotal;
  const specificsTotal = sum(giftPieces.map((p) => p.valuePence));
  let legacyRoom = pos(freeAfterReliefs - specificsTotal);
  const pecuniaryTotal = sum(pecuniary.map((d) => d.amountPence));
  const pecuniaryAttributedTotal = sum(pecuniary.map((d) => factor(d.amountPence)));
  const abate = pecuniaryAttributedTotal > legacyRoom;
  if (abate && pecuniary.length) {
    flags.push({ code: "legacies_abate", level: "info", message: `Cash legacies of ${formatPounds(pecuniaryTotal)} are more than the estate can pay, so they are reduced proportionately.` });
  }
  for (const d of pecuniary) {
    const attributed = factor(d.amountPence);
    const value = abate ? prorate(attributed, legacyRoom, pecuniaryAttributedTotal) : attributed;
    giftPieces.push({
      id: d.id,
      label: `Legacy of ${formatPounds(d.amountPence)}`,
      component: "free",
      recipient: recipientFor(d.recipientId, `Legacy of ${formatPounds(d.amountPence)}`),
      valuePence: value,
      preReliefPence: abate ? prorate(d.amountPence, legacyRoom, pecuniaryAttributedTotal) : d.amountPence,
      bearsOwnTax: !!d.bearsOwnTax,
      kind: "gift",
      attribution: "specific_gift",
    });
  }
  legacyRoom = pos(freeAfterReliefs - sum(giftPieces.map((p) => p.valuePence)));
  const residueValue = legacyRoom;

  const shareTotal = sum(residueShares.map((r) => clampBp(r.shareBp)));
  if (residueShares.length && shareTotal !== 10_000) {
    flags.push({
      code: "residue_shares",
      level: shareTotal < 10_000 ? "out_of_scope" : "confirm",
      message:
        shareTotal < 10_000
          ? `Residue shares add up to ${formatBp(shareTotal)}. The rest passes on a partial intestacy, which is treated here as chargeable.`
          : `Residue shares add up to ${formatBp(shareTotal)}; they are scaled down to 100%.`,
    });
  }
  const residueParts: { recipient: Recipient; shareBp: BasisPoints; id: string }[] = residueShares.map((r) => ({
    id: r.id,
    recipient: recipientFor(r.recipientId, "Residue"),
    shareBp: shareTotal > 10_000 ? Math.round((clampBp(r.shareBp) * 10_000) / shareTotal) : clampBp(r.shareBp),
  }));
  if (shareTotal < 10_000 && residueValue > 0) {
    residueParts.push({ id: "residue:undisposed", recipient: { id: "undisposed", name: residueShares.length ? "Undisposed residue" : "Residue (no residuary gift recorded)", category: "other" }, shareBp: 10_000 - Math.min(shareTotal, 10_000) });
  }

  // Spouse exemption cap (spouse not UK resident).
  const spouseCap = spouseCapStart === null ? null : pos(spouseCapStart - gifts.spouseCapUsedPence);

  const exemptResidueBp = sum(residueParts.filter((r) => isExempt(r.recipient.category)).map((r) => r.shareBp));
  const chargeableResidueBp = 10_000 - exemptResidueBp;

  // ── RNRB ─────────────────────────────────────────────────────────────────
  const residenceNet = qri && (qri.bucket === "free" || qri.bucket === "survivorship") ? net.get(qri.id)! : 0;
  let residenceCI = 0;
  if (qri && qri.bucket === "survivorship") {
    residenceCI = pieces.find((p) => p.id === qri.id)!.recipient.category === "lineal_descendant" ? residenceNet : 0;
  } else if (qri && qri.bucket === "free") {
    const givenBp = specificShares.get(qri.id) ?? 0;
    residenceCI =
      sum(specifics.filter((s) => s.d.assetId === qri.id && recipientFor(s.d.recipientId, qri.label).category === "lineal_descendant").map((s) => s.pre)) +
      applyBp(applyBp(residenceNet, 10_000 - givenBp), sum(residueParts.filter((r) => r.recipient.category === "lineal_descendant").map((r) => r.shareBp)));
  }
  const residenceInResidue = qri && qri.bucket === "free" ? applyBp(residenceNet, 10_000 - (specificShares.get(qri.id) ?? 0)) : 0;
  const lineal = (p: Piece) => p.recipient.category === "lineal_descendant" && !p.isResidence && p.component !== "pension";
  const otherCI =
    sum(pieces.filter(lineal).map((p) => p.valuePence)) +
    sum(giftPieces.filter(lineal).map((p) => p.valuePence)) +
    applyBp(pos(residueValue - residenceInResidue), sum(residueParts.filter((r) => r.recipient.category === "lineal_descendant").map((r) => r.shareBp)));

  const enhancement = dod >= EARLIEST_SUPPORTED_DEATH ? rules.residenceNilRateBand.value : 0;
  const rnrb = computeRnrb({
    dateOfDeath: dod,
    residentialEnhancementPence: enhancement,
    transferredRnrbBp: transferredRnrbBp,
    taperThresholdPence: rules.rnrbTaperThreshold.value,
    taperValuePence: netPence,
    residencePence: residenceNet,
    residenceCloselyInheritedPence: residenceCI,
    otherCloselyInheritedPence: otherCI,
    downsizing: input.downsizing,
  });
  flags.push(...rnrb.flags);

  // ── Exemptions, bands, grossing and tax ──────────────────────────────────
  const nrbAvailable = pos(NRB + tnrb - gifts.againstBandPence);
  const band = nrbAvailable + rnrb.totalPence;

  const allPieces = [...pieces, ...giftPieces];
  const exemptValue = (category: "spouse" | "charity", residue: Pence) =>
    sum(allPieces.filter((p) => p.recipient.category === category).map((p) => p.valuePence)) +
    applyBp(residue, sum(residueParts.filter((r) => r.recipient.category === category).map((r) => r.shareBp)));

  // Tax-free chargeable legacies from the free estate.
  const taxFree = giftPieces.filter((p) => !p.bearsOwnTax && !isExempt(p.recipient.category));
  const T = sum(taxFree.map((p) => p.valuePence));
  const ownTax = allPieces.filter((p) => p.bearsOwnTax && !isExempt(p.recipient.category));
  const B = sum(ownTax.map((p) => p.valuePence));
  const needsGrossing = T > 0 && exemptResidueBp > 0;

  interface Pass {
    rateBp: BasisPoints;
    grossedT: Pence;
    residueAfterGiftTax: Pence;
    chargeableResidue: Pence;
    spouseExempt: Pence;
    spouseOverCap: Pence;
    charityExempt: Pence;
    chargeable: Pence;
    grossing: "none" | "single" | "double";
  }
  const taxAt = (chargeable: Pence, rateBp: BasisPoints) => applyBp(pos(chargeable - band), rateBp);

  const runPass = (rateBp: BasisPoints): Pass => {
    let grossedT = T;
    let grossing: Pass["grossing"] = "none";
    if (needsGrossing) {
      const g1 = grossUp(T, band, rateBp);
      if (chargeableResidueBp === 0 && B === 0) {
        grossedT = g1;
        grossing = "single";
      } else {
        const residue1 = pos(residueValue - (g1 - T));
        const h = g1 + B + applyBp(residue1, chargeableResidueBp);
        const taxH = taxAt(h, rateBp);
        grossedT = Math.round((T * h) / (h - taxH)); // tax is always less than h
        grossing = "double";
      }
    }
    const residueAfterGiftTax = pos(residueValue - (grossedT - T));
    const chargeableResidue = applyBp(residueAfterGiftTax, chargeableResidueBp);
    let spouseExempt = exemptValue("spouse", residueAfterGiftTax);
    let spouseOverCap = 0;
    if (spouseCap !== null && spouseExempt > spouseCap) {
      spouseOverCap = spouseExempt - spouseCap;
      spouseExempt = spouseCap;
    }
    const charityExempt = exemptValue("charity", residueAfterGiftTax);
    return { rateBp, grossedT, residueAfterGiftTax, chargeableResidue, spouseExempt, spouseOverCap, charityExempt, chargeable: grossedT + B + chargeableResidue + spouseOverCap, grossing };
  };

  // 36% rate: the charity test per component (or merged).
  const charityTest = (p: Pass) => {
    const components: Record<Bucket, { chargeable: Pence; charity: Pence }> = {
      free: { chargeable: 0, charity: 0 },
      survivorship: { chargeable: 0, charity: 0 },
      pension: { chargeable: 0, charity: 0 },
      reservation: { chargeable: 0, charity: 0 },
    };
    for (const piece of pieces) {
      if (piece.recipient.category === "charity") components[piece.component].charity += piece.valuePence;
      else if (piece.recipient.category !== "spouse") components[piece.component].chargeable += piece.valuePence;
    }
    components.free.chargeable += p.grossedT + p.chargeableResidue + sum(giftPieces.filter((g) => g.bearsOwnTax && !isExempt(g.recipient.category)).map((g) => g.valuePence));
    components.free.charity += sum(giftPieces.filter((g) => g.recipient.category === "charity").map((g) => g.valuePence)) +
      applyBp(p.residueAfterGiftTax, sum(residueParts.filter((r) => r.recipient.category === "charity").map((r) => r.shareBp)));
    components.free.chargeable += p.spouseOverCap;

    const list = input.mergeCharityComponents
      ? [{ name: "merged" as const, chargeable: sum(Object.values(components).map((c) => c.chargeable)), charity: sum(Object.values(components).map((c) => c.charity)) }]
      : (Object.entries(components) as [Bucket, { chargeable: Pence; charity: Pence }][]).map(([name, c]) => ({ name, ...c }));
    const totalChargeable = sum(list.map((c) => c.chargeable));
    return list
      .filter((c) => c.chargeable > 0 || c.charity > 0)
      .map((c) => {
        const nrbShare = prorate(nrbAvailable, c.chargeable, totalChargeable);
        const baseline = c.chargeable - nrbShare + c.charity;
        const passes = c.charity > 0 && baseline > 0 && c.charity * 10_000 >= rules.charityTestBp.value * baseline;
        return { ...c, nrbShare, baseline, passes };
      });
  };

  // A component only matters for the rate if something in it is chargeable.
  const passesChargeable = (ts: ReturnType<typeof charityTest>) => ts.some((t) => t.passes && t.chargeable > 0);
  let pass = runPass(rules.rateBp.value);
  let tests = charityTest(pass);
  const anyCharity = tests.some((t) => t.charity > 0);
  if (passesChargeable(tests)) {
    // Legacies are grossed up at the rate of the component they sit in (the will).
    const willPasses = tests.some((t) => (t.name === "free" || t.name === "merged") && t.passes);
    const regrossed = runPass(willPasses ? rules.charityRateBp.value : rules.rateBp.value);
    const retest = charityTest(regrossed);
    if (passesChargeable(retest)) {
      pass = regrossed;
      tests = retest;
    } /* v8 ignore start -- defensive: grossing at 36% shrinks the grossed legacies, which raises the charity share and lowers the baseline, so a pass at 40% should still pass. Kept in case component apportionment ever makes it fail. */ else {
      flags.push({ code: "charity_borderline", level: "confirm", message: "The 36% rate is borderline once tax-free legacies are grossed up at 36%. The 40% rate is used; have a solicitor check." });
    }
    /* v8 ignore stop */
  }
  const chargeableComponents = tests.filter((t) => t.chargeable > 0);
  const passing = chargeableComponents.filter((t) => t.passes);
  const mixedRates = passing.length > 0 && passing.length < chargeableComponents.length;
  const uniform36 = passing.length > 0 && passing.length === chargeableComponents.length;
  if (anyCharity && chargeableComponents.length > 1) {
    flags.push({ code: "charity_components", level: "confirm", message: "The 36% test is applied to each part of the estate (will, joint property, pensions) separately. Confirm the apportionment of the nil-rate band.", source: SOURCES.charity });
  }
  if (anyCharity && !input.mergeCharityComponents && passing.length < chargeableComponents.length) {
    const merged = sum(tests.map((t) => t.charity)) * 10_000 >= rules.charityTestBp.value * sum(tests.map((t) => t.baseline));
    if (merged) flags.push({ code: "charity_merge", level: "info", message: "Merging the components would let the whole estate use the 36% rate. The personal representatives can elect to merge.", source: SOURCES.charity });
  }

  if (pass.spouseOverCap) {
    flags.push({
      code: "spouse_cap",
      level: "confirm",
      message: `The spouse exemption is capped at ${formatPounds(spouseCap!)} because the spouse is not a long-term UK resident; ${formatPounds(pass.spouseOverCap)} is chargeable. The spouse may be able to elect to be treated as UK resident.`,
      source: SOURCES.spouseCap,
    });
  }

  const rateBp = uniform36 ? rules.charityRateBp.value : rules.rateBp.value;
  const chargeable = pass.chargeable;
  const taxable = pos(chargeable - band);
  let taxBeforeRelief: Pence;
  if (mixedRates) {
    const total = sum(chargeableComponents.map((c) => c.chargeable));
    taxBeforeRelief = sum(chargeableComponents.map((c) => applyBp(pos(c.chargeable - prorate(band, c.chargeable, total)), c.passes ? rules.charityRateBp.value : rules.rateBp.value)));
  } else {
    taxBeforeRelief = applyBp(taxable, rateBp);
  }
  const qsr = quickSuccessionRelief(input.priorTransfers ?? [], dod);
  const qsrApplied = Math.min(qsr.reliefPence, taxBeforeRelief);
  const estateTax = taxBeforeRelief - qsrApplied;

  // Exemption and allowance lines.
  if (reliefs.totalPence) lines.push({ id: "reliefs:total", section: "reliefs", label: "Total reliefs", amountPence: reliefs.totalPence, op: "total" });
  if (pass.spouseExempt) lines.push({ id: "exempt:spouse", section: "exemptions", label: "Spouse or civil partner exemption", amountPence: pass.spouseExempt, op: "less" });
  if (pass.charityExempt) lines.push({ id: "exempt:charity", section: "exemptions", label: "Charity exemption", amountPence: pass.charityExempt, op: "less" });
  lines.push({ id: "allow:nrb", section: "allowances", label: "Nil-rate band", amountPence: NRB, op: "info", source: rules.nilRateBand.source });
  if (tnrb) lines.push({ id: "allow:tnrb", section: "allowances", label: `Transferred from a spouse (${formatBp(transferredNrbBp)})`, amountPence: tnrb, op: "add", source: SOURCES.rates });
  if (gifts.againstBandPence) lines.push({ id: "allow:gifts", section: "allowances", label: "Less gifts in the 7 years before death", amountPence: Math.min(gifts.againstBandPence, NRB + tnrb), op: "less" });
  lines.push({ id: "allow:nrb_available", section: "allowances", label: "Nil-rate band available to the estate", amountPence: nrbAvailable, op: "total" });
  lines.push(...rnrb.lines);

  if (pass.grossing !== "none") {
    lines.push({
      id: "tax:grossing",
      section: "tax",
      label: `Tax-free legacies grossed up (${pass.grossing} grossing)`,
      amountPence: pass.grossedT,
      op: "info",
      detail: `Legacies of ${formatPounds(T)} pass free of tax while some residue is exempt, so they count as ${formatPounds(pass.grossedT)}: the amount that leaves ${formatPounds(T)} after tax.`,
      source: { label: "IHTA 1984 s.38", url: "https://www.gov.uk/hmrc-internal-manuals/inheritance-tax-manual/ihtm26101" },
    });
    if (pass.grossing === "double") {
      flags.push({ code: "double_grossing", level: "confirm", message: "Double grossing up applies (tax-free legacies with partly exempt residue or other chargeable property). Have a solicitor check the figures." });
    }
  }
  lines.push({ id: "tax:chargeable", section: "tax", label: "Chargeable estate", amountPence: chargeable, op: "total" });
  lines.push({ id: "tax:band", section: "tax", label: "Less nil-rate bands", amountPence: Math.min(band, chargeable), op: "less" });
  lines.push({ id: "tax:taxable", section: "tax", label: "Taxable", amountPence: taxable, op: "total" });
  lines.push({
    id: "tax:rate",
    section: "tax",
    label: mixedRates ? "Tax at 36% and 40% by component" : `Tax at ${formatBp(rateBp)}`,
    amountPence: taxBeforeRelief,
    op: "total",
    detail: rateBp === rules.charityRateBp.value ? "At least 10% of the baseline amount goes to charity, so the reduced rate applies." : undefined,
    source: rateBp === rules.charityRateBp.value || mixedRates ? SOURCES.charity : SOURCES.rates,
  });
  if (qsr.lines.length) {
    lines.push(...qsr.lines);
  }
  lines.push({ id: "tax:estate", section: "tax", label: "Tax on the estate", amountPence: estateTax, op: "total" });
  const totalTax = estateTax + gifts.taxPence;
  if (gifts.taxPence) lines.push({ id: "tax:total", section: "tax", label: "Total tax (estate and gifts)", amountPence: totalTax, op: "total" });

  // ── Who bears the tax ────────────────────────────────────────────────────
  const attribution: TaxAttribution[] = [];
  const bearers: { bucket: TaxAttribution["bucket"]; refId: string; label: string; chargeable: Pence }[] = [];
  if (pass.grossedT) bearers.push({ bucket: "residue", refId: "legacies", label: "Tax on tax-free legacies (paid from residue)", chargeable: pass.grossedT });
  for (const p of ownTax) bearers.push({ bucket: p.attribution, refId: p.id, label: `${p.label} (${p.recipient.name})`, chargeable: p.valuePence });
  for (const r of residueParts.filter((x) => !isExempt(x.recipient.category))) {
    bearers.push({ bucket: "residue", refId: r.id, label: `Residue share: ${r.recipient.name}`, chargeable: applyBp(pass.residueAfterGiftTax, r.shareBp) });
  }
  if (pass.spouseOverCap) bearers.push({ bucket: "residue", refId: "spouse_over_cap", label: "Spouse's gifts over the capped exemption", chargeable: pass.spouseOverCap });
  const bearerTotal = sum(bearers.map((b) => b.chargeable));
  let assigned = 0;
  bearers.forEach((b, idx) => {
    const tax = idx === bearers.length - 1 ? estateTax - assigned : prorate(estateTax, b.chargeable, bearerTotal);
    assigned += tax;
    attribution.push({ bucket: b.bucket, refId: b.refId, label: b.label, chargeablePence: b.chargeable, taxPence: tax });
  });
  for (const g of gifts.results.filter((r) => r.taxPence > 0)) {
    attribution.push({ bucket: "lifetime_gift", refId: g.id, label: `${g.label} (paid by the recipient)`, chargeablePence: g.chargeablePence, taxPence: g.taxPence });
  }

  // ── Unused allowances ────────────────────────────────────────────────────
  const rnrbUsed = Math.min(rnrb.totalPence, chargeable);
  const nrbUsed = Math.min(nrbAvailable, pos(chargeable - rnrbUsed));
  const unusedNrbBp = ratioBp(nrbAvailable - nrbUsed, NRB);
  const reliefAllowanceUnused = allowanceLeft === null ? null : pos(allowanceLeft - reliefs.allowanceUsedPence);

  // ── Reporting ────────────────────────────────────────────────────────────
  const foreignPence = sum(input.assets.filter((a) => a.foreign).map((a) => a.valuePence));
  const report = reportingRoute({
    dateOfDeath: dod,
    limits: rules.excepted.value,
    nilRateBandPence: NRB,
    transferredNrbBp,
    longTermUkResident: input.longTermUkResident,
    grossPence,
    netPence,
    spouseExemptPence: pass.spouseExempt,
    charityExemptPence: pass.charityExempt,
    specifiedTransfersPence: gifts.specifiedTransfersPence,
    specifiedExemptTransfersPence: gifts.specifiedExemptTransfersPence,
    foreignPence,
    hasSettledProperty: input.assets.some((a) => a.settled),
    hasGiftWithReservation: input.assets.some((a) => a.giftWithReservation),
    trustGiftWithinSevenYears: gifts.trustGiftWithinSevenYears,
    pensionsInEstate: rules.pensionsInEstate.value,
    hasEstatePension: pieces.some((p) => p.component === "pension"),
    taxPence: totalTax,
  });
  flags.push(...report.flags);
  const schedules =
    report.route === "iht400"
      ? schedulesFor({
          assets: input.assets,
          hasDebts: input.liabilities.some((l) => l.kind !== "funeral"),
          hasGifts: (input.lifetimeGifts ?? []).some((g) => g.madeOn < dod),
          transferredNrb: tnrb > 0,
          transferredRnrb: transferredRnrbBp > 0,
          claimsRnrb: rnrb.totalPence > 0,
          charityRate: rateBp === rules.charityRateBp.value || mixedRates,
        })
      : [];
  lines.push({
    id: "reporting:route",
    section: "reporting",
    label: report.route === "iht400" ? "Full account needed: IHT400" : report.route === "iht205" ? "Excepted estate: IHT205" : "Excepted estate: no IHT400 needed",
    op: "info",
    detail: report.reasons.join(" "),
    source: report.route === "excepted_exempt" ? SOURCES.exceptedExempt : SOURCES.exceptedLowValue,
  });

  const paymentDueOn = endOfSixthMonthAfter(dod);
  if (totalTax > 0) {
    lines.push({ id: "reporting:due", section: "reporting", label: `Tax due by ${paymentDueOn}`, op: "info", detail: "Interest runs on unpaid tax after this date. Tax on land can be paid in 10 annual instalments.", source: SOURCES.dueDate });
  }

  const seen = new Set<string>();
  const uniqueFlags = flags.filter((f) => (seen.has(f.code) ? false : (seen.add(f.code), true)));

  return {
    dateOfDeath: dod,
    ruleSet: rules,
    lines,
    flags: uniqueFlags,
    gifts: gifts.results,
    estate: {
      grossPence,
      excludedPence,
      liabilitiesPence,
      netPence,
      reliefsPence: reliefs.totalPence,
      spouseExemptPence: pass.spouseExempt,
      charityExemptPence: pass.charityExempt,
      chargeablePence: chargeable,
      nilRateBandPence: NRB,
      transferredNilRateBandPence: tnrb,
      lifetimeGiftsAgainstBandPence: gifts.againstBandPence,
      nilRateBandAvailablePence: nrbAvailable,
      residenceNilRateBandPence: rnrb.totalPence,
      downsizingAdditionPence: rnrb.downsizingAdditionPence,
      taxablePence: taxable,
      rateBp,
      taxBeforeReliefPence: taxBeforeRelief,
      quickSuccessionReliefPence: qsrApplied,
      taxPence: estateTax,
      estateRateBp: chargeable > 0 ? ratioBp(estateTax, chargeable) : 0,
    },
    rnrb: {
      defaultAllowancePence: rnrb.defaultAllowancePence,
      taperReductionPence: rnrb.taperReductionPence,
      adjustedAllowancePence: rnrb.adjustedAllowancePence,
      qualifyingResidencePence: residenceNet,
      closelyInheritedResidencePence: residenceCI,
      lostRelievableAmountPence: rnrb.lostRelievableAmountPence,
    },
    attribution,
    totalTaxPence: totalTax,
    transferable: { nilRateBandBp: unusedNrbBp, residenceNilRateBandBp: rnrb.unusedBp, reliefAllowancePence: reliefAllowanceUnused },
    reporting: { route: report.route, reasons: report.reasons, schedules },
    paymentDueOn,
    complete: !uniqueFlags.some((f) => f.level === "out_of_scope"),
  };
}
