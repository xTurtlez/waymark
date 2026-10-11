import type { ReactNode } from "react";
import { SEG_BG, segState } from "@/lib/stages";

/** Shared class strings. Kept as literals so Tailwind can see them. */
export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-[14px] bg-teal px-4 font-semibold text-paper transition-colors duration-150 hover:bg-teal-hover disabled:cursor-not-allowed disabled:opacity-60",
  primaryLg:
    "inline-flex h-14 items-center justify-center gap-2.5 rounded-[18px] bg-teal px-6 text-[17px] font-semibold text-paper transition-colors duration-150 hover:bg-teal-hover disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-[12px] border border-line-strong bg-paper px-4 font-semibold text-ink transition-colors duration-150 hover:bg-cream",
  secondaryLg:
    "inline-flex h-14 items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-line-strong bg-paper px-6 text-[17px] font-semibold text-ink transition-colors duration-150 hover:bg-cream",
  plumOutline:
    "inline-flex items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-plum-line font-semibold text-plum transition-colors duration-150 hover:bg-plum-wash",
  link: "font-semibold text-teal underline underline-offset-4 hover:text-teal-hover",
};

export const input =
  "h-[50px] w-full rounded-[14px] border-[1.5px] border-line-strong bg-cream px-4 text-base text-ink placeholder:text-muted focus:border-teal focus:outline-2 focus:outline-offset-2 focus:outline-teal";

export const card = "rounded-[20px] border border-line bg-paper";

export function Avatar({
  initials,
  color,
  size = 36,
  className = "",
  ring,
}: {
  initials: string;
  color: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`grid flex-none place-items-center rounded-full font-semibold text-white ${ring ? "ring-4 ring-cream" : ""} ${className}`}
      style={{ width: size, height: size, background: color, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initials}
    </span>
  );
}

/** 7-segment stage bar: teal done, coral current, line future. */
export function StageBar({
  stage,
  height = 7,
  gap = 4,
  label,
}: {
  stage: number;
  height?: number;
  gap?: number;
  label?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label ?? `Stage ${stage + 1} of 7`}
      className="grid grid-cols-7"
      style={{ gap }}
    >
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={`rounded-full ${SEG_BG[segState(i, stage)]}`} style={{ height }} />
      ))}
    </div>
  );
}

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function Eyebrow({ children, className = "text-muted" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[13px] font-semibold uppercase tracking-[0.06em] ${className}`}>{children}</div>;
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
  tone = "paper",
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "paper" | "teal" | "amber";
}) {
  const bg =
    tone === "teal"
      ? "bg-teal-tint text-teal-deep"
      : tone === "amber"
        ? "bg-amber-wash border border-amber-line"
        : "bg-paper border border-line";
  return (
    <section className={`rounded-[20px] px-[22px] py-5 ${bg} ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 font-serif text-xl font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-[14px] bg-cream px-4 py-3 text-sm text-muted">{children}</p>;
}
