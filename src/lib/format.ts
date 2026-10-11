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
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function longDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function stampNow(d = new Date()): string {
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

export function timeNow(d = new Date()): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Number words for headlines: "Four estates need you today." */
export function numberWord(n: number): string {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  return words[n] ?? String(n);
}
