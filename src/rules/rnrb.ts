import { DOWNSIZING_FROM, DOWNSIZING_PRE_RNRB_ALLOWANCE, EARLIEST_SUPPORTED_DEATH, SOURCES, residenceNilRateBandAt } from "./tables";
import type { BasisPoints, Flag, ISODate, Line, Pence } from "./types";
import { applyBp, formatBp, formatPounds, pos, ratioBp } from "./util";

export interface RnrbInput {
  dateOfDeath: ISODate;
  /** Residential enhancement at death (the maximum RNRB). */
  residentialEnhancementPence: Pence;
  transferredRnrbBp: BasisPoints;
  taperThresholdPence: Pence;
  /** Estate value after liabilities, before exemptions and reliefs (excludes lifetime gifts). */
  taperValuePence: Pence;
  /** Net value of the qualifying residential interest (0 if none). */
  residencePence: Pence;
  /** The part of it closely inherited (by lineal descendants). */
  residenceCloselyInheritedPence: Pence;
  /** Value of everything else closely inherited (for the downsizing addition). */
  otherCloselyInheritedPence: Pence;
  downsizing?: { disposedOn: ISODate; formerResidenceValuePence: Pence };
}

export interface RnrbOutcome {
  defaultAllowancePence: Pence;
  taperReductionPence: Pence;
  adjustedAllowancePence: Pence;
  /** Residence nil-rate amount from the home itself. */
  residenceAmountPence: Pence;
  lostRelievableAmountPence: Pence;
  downsizingAdditionPence: Pence;
  /** Total RNRB available against the death estate. */
  totalPence: Pence;
  /** Unused RNRB as a percentage of the residential enhancement, for a surviving spouse's estate. */
  unusedBp: BasisPoints;
  lines: Line[];
  flags: Flag[];
}

export function computeRnrb(i: RnrbInput): RnrbOutcome {
  const lines: Line[] = [];
  const flags: Flag[] = [];
  const enhancement = i.residentialEnhancementPence;
  const broughtForward = applyBp(enhancement, i.transferredRnrbBp);
  const defaultAllowance = enhancement + broughtForward;
  const over = pos(i.taperValuePence - i.taperThresholdPence);
  const taperReduction = Math.min(defaultAllowance, Math.round(over / 2));
  const adjusted = defaultAllowance - taperReduction;

  lines.push({
    id: "rnrb:default",
    section: "allowances",
    label: "Residence nil-rate band",
    amountPence: defaultAllowance,
    op: "info",
    detail: broughtForward
      ? `${formatPounds(enhancement)} plus ${formatPounds(broughtForward)} transferred from a spouse (${formatBp(i.transferredRnrbBp)}).`
      : `${formatPounds(enhancement)} for this date of death.`,
    source: SOURCES.rnrbAmounts,
  });
  if (taperReduction) {
    lines.push({
      id: "rnrb:taper",
      section: "allowances",
      label: "Less taper: £1 for every £2 over the threshold",
      amountPence: taperReduction,
      op: "less",
      detail: `Estate after liabilities ${formatPounds(i.taperValuePence)} is ${formatPounds(over)} over ${formatPounds(i.taperThresholdPence)}.`,
      source: i.transferredRnrbBp ? SOURCES.rnrbBroughtForward : SOURCES.rnrbTaper,
    });
  }

  const residenceAmount = Math.min(adjusted, i.residenceCloselyInheritedPence);
  if (i.residencePence > 0) {
    lines.push({
      id: "rnrb:home",
      section: "allowances",
      label: "Home passing to direct descendants",
      amountPence: i.residenceCloselyInheritedPence,
      op: "info",
      detail:
        i.residenceCloselyInheritedPence === 0
          ? "The home does not pass to direct descendants, so this part of the allowance isn't available."
          : i.residenceCloselyInheritedPence < i.residencePence
            ? `${formatPounds(i.residenceCloselyInheritedPence)} of the home's net value of ${formatPounds(i.residencePence)} passes to direct descendants.`
            : "The home passes to direct descendants.",
    });
  }

  // Downsizing addition.
  let lost = 0;
  let addition = 0;
  const d = i.downsizing;
  if (d) {
    if (d.disposedOn < DOWNSIZING_FROM || d.disposedOn >= i.dateOfDeath) {
      flags.push({
        code: "downsizing_date",
        level: "info",
        message: "The downsizing addition only applies to a former home sold or given away from 8 July 2015 and before the death.",
        source: SOURCES.downsizing,
      });
    } else {
      // Step 1: RNRB available at disposal (+ the brought-forward amount at death).
      const atDisposal = (d.disposedOn < EARLIEST_SUPPORTED_DEATH ? DOWNSIZING_PRE_RNRB_ALLOWANCE : residenceNilRateBandAt(d.disposedOn)) + broughtForward;
      // Step 2: former home as a percentage of that (max 100%).
      const p1 = ratioBp(d.formerResidenceValuePence, atDisposal);
      // Step 3: home in the estate as a percentage of the adjusted allowance at death.
      const p2 = i.residencePence > 0 ? ratioBp(i.residencePence, adjusted) : 0;
      // Steps 4–5.
      lost = p1 > p2 ? applyBp(adjusted, p1 - p2) : 0;
      const closelyInheritedAny = i.residenceCloselyInheritedPence + i.otherCloselyInheritedPence > 0;
      addition = closelyInheritedAny ? Math.min(lost, i.otherCloselyInheritedPence, pos(adjusted - residenceAmount)) : 0;
      lines.push({
        id: "rnrb:downsizing",
        section: "allowances",
        label: "Downsizing addition",
        amountPence: addition,
        op: "add",
        detail:
          `Former home ${formatPounds(d.formerResidenceValuePence)} was ${formatBp(p1)} of ${formatPounds(atDisposal)} available at disposal; ` +
          `home at death is ${formatBp(p2)} of the allowance; lost allowance ${formatPounds(lost)}` +
          (lost ? `, limited to other assets passing to direct descendants (${formatPounds(i.otherCloselyInheritedPence)}).` : "."),
        source: SOURCES.downsizing,
      });
      if (adjusted !== defaultAllowance) {
        flags.push({ code: "downsizing_taper", level: "info", message: "Downsizing is measured against the tapered allowance.", source: SOURCES.downsizingTaper });
      }
    }
  }

  const total = Math.min(adjusted, residenceAmount + addition);
  const unused = pos(adjusted - total);
  const unusedBp = ratioBp(unused, enhancement);
  lines.push({
    id: "rnrb:total",
    section: "allowances",
    label: "Residence nil-rate band available",
    amountPence: total,
    op: "total",
    detail: unused ? `${formatPounds(unused)} unused (${formatBp(unusedBp)}) can pass to a surviving spouse's estate.` : undefined,
  });

  return {
    defaultAllowancePence: defaultAllowance,
    taperReductionPence: taperReduction,
    adjustedAllowancePence: adjusted,
    residenceAmountPence: residenceAmount,
    lostRelievableAmountPence: lost,
    downsizingAdditionPence: addition,
    totalPence: total,
    unusedBp,
    lines,
    flags,
  };
}
