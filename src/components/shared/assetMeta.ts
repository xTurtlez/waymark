import type { IconType } from "react-icons";
import {
  PiBank,
  PiCertificate,
  PiChartLineUp,
  PiCreditCard,
  PiEnvelopeOpen,
  PiFileText,
  PiHouseLine,
  PiLightning,
  PiPiggyBank,
  PiReceipt,
  PiScroll,
  PiTicket,
  PiUmbrella,
  PiWallet,
} from "react-icons/pi";
import type { AssetKind, AssetState, DocState, EstateDocument, Tone } from "@/lib/types";

export const ASSET_ICON: Record<AssetKind, IconType> = {
  property: PiHouseLine,
  bank: PiBank,
  savings: PiPiggyBank,
  bonds: PiTicket,
  pension: PiUmbrella,
  investment: PiChartLineUp,
  credit: PiCreditCard,
  utility: PiLightning,
  other: PiWallet,
};

/** Icon tint per asset kind in the portal grid. */
export const ASSET_TINT: Record<AssetKind, Tone> = {
  property: "teal",
  bank: "plum",
  savings: "plum",
  bonds: "amber",
  pension: "plum",
  investment: "teal",
  credit: "coral",
  utility: "coral",
  other: "amber",
};

export const ASSET_KIND_LABEL: { kind: AssetKind; label: string; liability?: boolean }[] = [
  { kind: "bank", label: "Bank account" },
  { kind: "savings", label: "Savings" },
  { kind: "property", label: "Property" },
  { kind: "pension", label: "Pension" },
  { kind: "investment", label: "Shares or investments" },
  { kind: "bonds", label: "Premium Bonds" },
  { kind: "other", label: "Something else" },
  { kind: "credit", label: "Credit card or loan", liability: true },
  { kind: "utility", label: "Bill to pay", liability: true },
];

export const ASSET_STATE_TONE: Record<AssetState, Tone> = {
  confirmed: "teal",
  awaiting: "plum",
  estimate: "amber",
  not_notified: "coral",
};

export const DOC_ICON: Record<EstateDocument["icon"], IconType> = {
  scroll: PiScroll,
  envelope: PiEnvelopeOpen,
  receipt: PiReceipt,
  certificate: PiCertificate,
  file: PiFileText,
  bank: PiBank,
  house: PiHouseLine,
};

export const DOC_FIRM: Record<DocState, { label: string; text: string; tile: string }> = {
  accepted: { label: "Verified", text: "text-teal", tile: "border border-line bg-paper" },
  held: { label: "Held in safe", text: "text-teal", tile: "border border-line bg-paper" },
  checking: { label: "To check", text: "text-amber-ink", tile: "border border-amber-line bg-paper" },
  needed: { label: "Missing", text: "text-coral-ink", tile: "border-[1.5px] border-dashed border-[#E8A898] bg-cream" },
};
