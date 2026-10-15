import { SOURCES } from "./tables";
import type { Line, Pence, Relief } from "./types";
import { applyBp, formatPounds, prorate, sum } from "./util";

export interface RelievableAsset {
  id: string;
  label: string;
  /** Value after liabilities charged on it. */
  netPence: Pence;
  relief?: Relief;
}

export interface ReliefsOutcome {
  byAsset: Map<string, Pence>;
  totalPence: Pence;
  allowanceUsedPence: Pence;
  lines: Line[];
}

/**
 * Business and agricultural relief on the death estate.
 *
 * Before 6 April 2026 (`allowancePence` null), `full` property gets 100%.
 * From then, 100% applies to the first slice of `full` property up to the
 * remaining allowance and 50% to the rest. `half` property always gets 50%
 * and doesn't use the allowance. The allowance is shared across assets in
 * proportion to their value.
 */
export function deathEstateReliefs(assets: RelievableAsset[], allowancePence: Pence | null): ReliefsOutcome {
  const byAsset = new Map<string, Pence>();
  const lines: Line[] = [];
  const full = assets.filter((a) => a.relief?.rate === "full" && a.netPence > 0);
  const half = assets.filter((a) => a.relief?.rate === "half" && a.netPence > 0);
  const fullTotal = sum(full.map((a) => a.netPence));
  const at100 = allowancePence === null ? fullTotal : Math.min(fullTotal, allowancePence);

  // Total relief on `full` property, shared across those assets in proportion
  // to value; the last asset takes any rounding so the total is exact.
  const fullRelief = at100 + applyBp(fullTotal - at100, 5_000);
  let given = 0;
  full.forEach((a, idx) => {
    const share = idx === full.length - 1 ? fullRelief - given : prorate(fullRelief, a.netPence, fullTotal);
    given += share;
    byAsset.set(a.id, share);
  });
  for (const a of half) byAsset.set(a.id, applyBp(a.netPence, 5_000));

  for (const a of [...full, ...half]) {
    const relief = byAsset.get(a.id)!;
    lines.push({
      id: `relief:${a.id}`,
      section: "reliefs",
      label: `${a.relief!.kind === "business" ? "Business" : "Agricultural"} property relief: ${a.label}`,
      amountPence: relief,
      op: "less",
      detail: relief === a.netPence ? "100% relief." : `${formatPounds(relief)} on ${formatPounds(a.netPence)}.`,
      source: SOURCES.reliefs,
      refs: [a.id],
    });
  }
  if (allowancePence !== null && fullTotal > allowancePence) {
    lines.push({
      id: "relief:allowance",
      section: "reliefs",
      label: "100% relief allowance",
      amountPence: allowancePence,
      op: "info",
      detail: `100% relief is limited to ${formatPounds(allowancePence)}; the other ${formatPounds(fullTotal - allowancePence)} gets 50%.`,
      source: SOURCES.reliefs,
    });
  }

  const total = sum([...byAsset.values()]);
  return { byAsset, totalPence: total, allowanceUsedPence: allowancePence === null ? 0 : at100, lines };
}
