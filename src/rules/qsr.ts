import { QSR_BP, SOURCES } from "./tables";
import type { ISODate, Line, Pence, PriorTransfer } from "./types";
import { formatBp, formatPounds, prorate, applyBp, yearsBand } from "./util";

/**
 * Quick succession relief: (A ÷ D) × B × percentage, where A is the increase
 * in this estate from the earlier transfer, D the earlier chargeable transfer
 * and B the tax paid on it. Death on an anniversary takes the higher rate.
 */
export function quickSuccessionRelief(prior: PriorTransfer[], dateOfDeath: ISODate): { reliefPence: Pence; lines: Line[] } {
  const lines: Line[] = [];
  let total = 0;
  for (const p of prior) {
    const band = yearsBand(p.transferOn, dateOfDeath);
    const pctBp = band < QSR_BP.length && p.transferOn < dateOfDeath ? QSR_BP[band] : 0;
    const relief = pctBp ? applyBp(prorate(p.taxPaidPence, Math.min(p.netIncreasePence, p.grossTransferPence), p.grossTransferPence), pctBp) : 0;
    total += relief;
    lines.push({
      id: `qsr:${p.id}`,
      section: "tax",
      label: `Quick succession relief: ${p.label}`,
      amountPence: relief,
      op: "less",
      detail: pctBp
        ? `${formatPounds(p.netIncreasePence)} ÷ ${formatPounds(p.grossTransferPence)} × ${formatPounds(p.taxPaidPence)} tax × ${formatBp(pctBp)}.`
        : "More than five years before the death, so no relief.",
      source: SOURCES.qsr,
      refs: [p.id],
    });
  }
  return { reliefPence: total, lines };
}
