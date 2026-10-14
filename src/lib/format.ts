const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/** £412,300 */
export function money(pence: number): string {
  return gbp.format(Math.round(pence / 100));
}

/** "− £3,636" for liabilities, "TBC" when unknown. Uses a true minus sign. */
export function signedMoney(pence: number | null, liability: boolean): string {
  if (pence === null) return "TBC";
  return liability ? `− ${money(pence)}` : money(pence);
}

/** Parse "£1,234.56", "1234", "about 2k" into pence. Returns null if nothing numeric. */
export function parseMoney(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[£,\s]/g, "");
  const m = s.match(/^(?:about|around|roughly|approx)?(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2] === "k") v *= 1_000;
  if (m[2] === "m") v *= 1_000_000;
  return Math.round(v * 100);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function greeting(d: Date): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(d));
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function longDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });
}

// ── Dates ──────────────────────────────────────────────────────────────────
// Stored values are ISO strings. Calendar logic runs in UK time so "Today"
// means the same on a Vercel server (UTC) and in a browser in Bath.

const TZ = "Europe/London";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Current moment as an ISO timestamp. */
export function nowIso(d: Date = new Date()): string {
  return d.toISOString();
}

/** UK calendar day ("2026-10-10") for a moment. */
export function isoDay(d: Date | string = new Date()): string {
  return dayFmt.format(typeof d === "string" ? new Date(d) : d);
}

function dayToUtc(day: string): number {
  const [y, m, dd] = day.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
}

/** Calendar day `n` days after `day` (negative for before). */
export function addDays(day: string, n: number): string {
  return new Date(dayToUtc(day) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). Accepts days or timestamps (timestamps use their UK day). */
export function daysBetween(a: string, b: string): number {
  const da = a.length > 10 ? isoDay(a) : a;
  const db = b.length > 10 ? isoDay(b) : b;
  return Math.round((dayToUtc(db) - dayToUtc(da)) / 86_400_000);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts });
const fDayMonth = fmt({ day: "numeric", month: "short" });
const fDayMonthLong = fmt({ day: "numeric", month: "long" });
const fDayMonthYear = fmt({ day: "numeric", month: "long", year: "numeric" });
const fWeekdayShort = fmt({ weekday: "short" });
const fWeekdayLong = fmt({ weekday: "long" });
const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const fMonthYear = fmt({ month: "short", year: "numeric" });
const fMonth = fmt({ month: "short" });
const fYear = fmt({ year: "numeric" });

/** Calendar days are stored as "YYYY-MM-DD": format them at UK midday to avoid edge shifts. */
function asDate(v: string): Date {
  return v.length <= 10 ? new Date(`${v}T12:00:00Z`) : new Date(v);
}

/** "6 Oct" */
export function shortDay(v: string): string {
  return fDayMonth.format(asDate(v));
}

/** "6 October", or "6 October 2025" when not this year. */
export function longDay(v: string, now: Date = new Date()): string {
  const d = asDate(v);
  return fYear.format(d) === fYear.format(now) ? fDayMonthLong.format(d) : fDayMonthYear.format(d);
}

/** "14 May 2026" */
export function fullDay(v: string): string {
  return fDayMonthYear.format(asDate(v));
}

/** "Jun 2026" */
export function monthYear(v: string): string {
  return fMonthYear.format(asDate(v));
}

/** "Jun" */
export function monthShort(v: string): string {
  return fMonth.format(asDate(v));
}

/** "07:02" */
export function timeLabel(t: string): string {
  return fTime.format(new Date(t));
}

/** "10 Oct 07:02" (audit trails). */
export function stampLabel(t: string): string {
  return `${shortDay(t)} ${timeLabel(t)}`;
}

/** Today / Yesterday / Tomorrow / weekday within the coming week / "6 Oct". */
export function dayLabel(v: string, now: Date = new Date()): string {
  const diff = daysBetween(isoDay(now), v.length > 10 ? isoDay(v) : v);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return fWeekdayShort.format(asDate(v));
  return shortDay(v);
}

/** Message day separators: Today / Yesterday / weekday this past week / "6 October". */
export function dayHeading(t: string, now: Date = new Date()): string {
  const diff = daysBetween(isoDay(now), isoDay(t));
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff > -7 && diff < 0) return fWeekdayLong.format(new Date(t));
  return longDay(t, now);
}

/** Updates timeline: Today / Yesterday / "6 October". */
export function whenLabel(t: string, now: Date = new Date()): string {
  const diff = daysBetween(isoDay(now), isoDay(t));
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  return longDay(t, now);
}

/** Due date label and whether it is overdue. */
export function dueInfo(dueOn: string | null, done: boolean, now: Date = new Date()): { label: string; overdue: boolean } {
  if (!dueOn) return { label: "", overdue: false };
  const diff = daysBetween(isoDay(now), dueOn);
  if (!done && diff < 0) return { label: "Overdue", overdue: true };
  return { label: dayLabel(dueOn, now), overdue: false };
}

/** "Photo from Sarah · yesterday 21:05" style provenance. */
export function uploadedLabel(t: string, now: Date = new Date()): string {
  const d = dayLabel(t, now);
  return `${d === "Today" || d === "Yesterday" ? d.toLowerCase() : d} ${timeLabel(t)}`;
}

/** Short random id with a type prefix ("t_3f9c0a1b2d4e"). Unique enough per estate; rows also get a UUID in the database. */
export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Number words for headlines: "Four estates need you today." */
export function numberWord(n: number): string {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  return words[n] ?? String(n);
}
