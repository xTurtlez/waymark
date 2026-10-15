import type { BasisPoints, ISODate, Pence } from "./types";

/** Whole-pence result of applying a basis-point rate, rounded half up. */
export function applyBp(amount: Pence, bp: BasisPoints): Pence {
  return Math.round((amount * bp) / 10_000);
}

/** amount × numerator ÷ denominator, rounded half up. Zero denominator gives zero. */
export function prorate(amount: Pence, numerator: number, denominator: number): Pence {
  if (denominator === 0) return 0;
  return Math.round((amount * numerator) / denominator);
}

/** a ÷ b as basis points, rounded half up, capped at `cap`. */
export function ratioBp(a: number, b: number, cap = 10_000): BasisPoints {
  if (b <= 0) return 0;
  return Math.min(cap, Math.round((a / b) * 10_000));
}

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
export const pos = (n: number): number => (n > 0 ? n : 0);
export const clampBp = (bp: number | undefined): BasisPoints => Math.max(0, Math.min(10_000, bp ?? 0));

export function formatPounds(p: Pence): string {
  const sign = p < 0 ? "−" : "";
  const abs = Math.abs(p);
  const pounds = Math.floor(abs / 100);
  const pence = abs % 100;
  return `${sign}£${pounds.toLocaleString("en-GB")}${pence ? `.${String(pence).padStart(2, "0")}` : ""}`;
}

export function formatBp(bp: BasisPoints): string {
  const whole = bp % 100 === 0;
  return `${whole ? bp / 100 : (bp / 100).toFixed(2)}%`;
}

// ── Calendar dates ──────────────────────────────────────────────────────────
// ISO strings compare correctly as strings, so comparisons use them directly.

function parts(d: ISODate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid date: ${d}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function iso(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidDate(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && da >= 1 && da <= daysInMonth(y, mo);
}

/**
 * The n-th anniversary of a date. An anniversary of 29 February in a
 * non-leap year falls on 1 March, so a period of whole years ends at the end
 * of 28 February (the cautious reading: it never shortens a period).
 */
export function addYears(d: ISODate, n: number): ISODate {
  const [y, m, day] = parts(d);
  const ty = y + n;
  if (m === 2 && day === 29 && daysInMonth(ty, 2) === 28) return iso(ty, 3, 1);
  return iso(ty, m, day);
}

/** The last day of the sixth month after the month of `d` (IHT due date). */
export function endOfSixthMonthAfter(d: ISODate): ISODate {
  const [y, m] = parts(d);
  const total = m + 6;
  const ty = y + Math.floor((total - 1) / 12);
  const tm = ((total - 1) % 12) + 1;
  return iso(ty, tm, daysInMonth(ty, tm));
}

/** The year in which the UK tax year containing `d` starts (tax years start on 6 April). */
export function taxYearOf(d: ISODate): number {
  const [y, m, day] = parts(d);
  return m > 4 || (m === 4 && day >= 6) ? y : y - 1;
}

/**
 * How many whole-year bands lie between two dates, using statutory wording:
 * returns k where `later` is "more than k years but not more than k+1 years"
 * after `earlier`. A date exactly on an anniversary counts in the lower band.
 */
export function yearsBand(earlier: ISODate, later: ISODate): number {
  let k = 0;
  while (later > addYears(earlier, k + 1)) k += 1;
  return k;
}
