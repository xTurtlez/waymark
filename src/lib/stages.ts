import type { Tone, WaitingOn } from "./types";

/** The seven stages of an estate administration in England & Wales. */
export const STAGES = [
  { short: "Register", long: "Register the death", workspace: "Register" },
  { short: "Gather", long: "Gather documents", workspace: "Documents" },
  { short: "Value", long: "Value the estate", workspace: "Value estate" },
  { short: "IHT", long: "Inheritance Tax", workspace: "Inheritance Tax" },
  { short: "Probate", long: "Apply for probate", workspace: "Apply for probate" },
  { short: "Collect & pay", long: "Collect assets & pay debts", workspace: "Collect & pay" },
  { short: "Distribute", long: "Distribute the estate", workspace: "Distribute" },
] as const;

export const STAGE_COUNT = STAGES.length;

export type SegState = "done" | "now" | "later";
export function segState(i: number, stage: number): SegState {
  return i < stage ? "done" : i === stage ? "now" : "later";
}

export const SEG_BG: Record<SegState, string> = {
  done: "bg-teal",
  now: "bg-coral",
  later: "bg-line",
};

/** Colour treatment for "waiting on" chips. Full class strings so Tailwind can see them. */
export const WAITING_STYLE: Record<WaitingOn, { chip: string; label: string; bar: string }> = {
  family: { chip: "bg-amber-tint text-amber-ink", label: "Families", bar: "bg-amber" },
  bank: { chip: "bg-plum-tint text-plum", label: "Banks & pensions", bar: "bg-plum" },
  hmrc: { chip: "bg-coral-tint text-coral-ink", label: "HMRC", bar: "bg-coral" },
  registry: { chip: "bg-teal-tint text-teal", label: "Probate Registry", bar: "bg-teal" },
  none: { chip: "bg-teal-tint text-teal", label: "On track", bar: "bg-teal" },
};

export const TONE_CHIP: Record<Tone, string> = {
  teal: "bg-teal-tint text-teal",
  coral: "bg-coral-tint text-coral-ink",
  amber: "bg-amber-tint text-amber-ink",
  plum: "bg-plum-tint text-plum",
  neutral: "bg-line-soft text-muted",
};

export const TONE_DOT: Record<Tone, string> = {
  teal: "bg-teal",
  coral: "bg-coral",
  amber: "bg-amber",
  plum: "bg-plum",
  neutral: "bg-line-strong",
};
