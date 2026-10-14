"use client";

import { useEffect, useRef } from "react";
import { PiCheckBold } from "react-icons/pi";
import { stageTiming } from "@/lib/derive";
import { STAGES } from "@/lib/stages";
import type { Estate } from "@/lib/types";

const W = 342;
const STEP = 135;
const H = 50 + STEP * 6 + 50;

/**
 * The winding seven-stage path from the client journey design.
 * The completed part draws itself in on load (skipped for reduced motion).
 */
export function JourneyPath({ estate, needsYou }: { estate: Estate; needsYou: number }) {
  const stage = estate.stage;
  const progRef = useRef<SVGPathElement>(null);
  const pts = STAGES.map((_, i) => [i % 2 ? 286 : 56, 50 + i * STEP] as const);
  let fullD = `M${pts[0][0]},${pts[0][1]}`;
  let progD = fullD;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const seg = ` C${x0},${y0 + 70} ${x1},${y1 - 70} ${x1},${y1}`;
    fullD += seg;
    if (i <= stage) progD += seg;
  }
  if (stage === 0) progD += " l0,0.1";

  useEffect(() => {
    const p = progRef.current;
    if (!p || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const L = p.getTotalLength();
    if (!L) return;
    p.style.transition = "none";
    p.style.strokeDasharray = `${L}`;
    p.style.strokeDashoffset = `${L}`;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset 1.8s cubic-bezier(.45,0,.2,1) .3s";
    p.style.strokeDashoffset = "0";
  }, [stage]);

  return (
    <ol className="relative mx-auto mt-3 list-none p-0" style={{ width: W, height: H }} aria-label="Your path through the seven stages">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="hpg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0E5F5B" />
            <stop offset=".55" stopColor="#E3A13A" />
            <stop offset="1" stopColor="#E36E55" />
          </linearGradient>
        </defs>
        <path d={fullD} fill="none" stroke="#EADFCF" strokeWidth="12" strokeLinecap="round" />
        <path d={fullD} fill="none" stroke="#FBF6EE" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
        <path ref={progRef} d={progD} fill="none" stroke="url(#hpg)" strokeWidth="12" strokeLinecap="round" />
      </svg>
      {STAGES.map((s, i) => {
        const done = i < stage;
        const now = i === stage;
        const left = i % 2 === 0;
        const [nx, ny] = pts[i];
        const eyebrow = done ? "Done" : now ? "You are here" : i === stage + 1 ? "Up next" : `Stage ${i + 1}`;
        const meta = done
          ? stageTiming(estate, i)
          : now
            ? `${stageTiming(estate, i)}${needsYou ? ` · ${needsYou} thing${needsYou > 1 ? "s" : ""} for you` : ""}`
            : stageTiming(estate, i);
        return (
          <li key={s.long} aria-current={now ? "step" : undefined}>
            <div
              className={`absolute rounded-[20px] px-4 py-3.5 ${now ? "border-[1.5px] border-coral bg-paper shadow-now" : "border border-transparent bg-cream/95"}`}
              style={{ left: left ? 92 : 4, top: ny - 40, width: 246, textAlign: left ? "left" : "right" }}
            >
              <div className={`text-xs font-semibold uppercase tracking-[0.06em] ${done ? "text-teal" : now ? "text-coral-ink" : "text-muted"}`}>{eyebrow}</div>
              <div className="mt-1 font-serif text-[19px] font-medium leading-tight text-ink">{s.long}</div>
              <div className="mt-1 text-sm leading-[1.35] text-ink-3">{meta}</div>
            </div>
            <div
              aria-hidden
              className={`absolute -ml-6 -mt-6 grid size-12 place-items-center rounded-full text-[17px] font-semibold ${
                done ? "border-4 border-cream bg-teal text-white" : now ? "border-4 border-cream bg-coral text-white shadow-[0_0_0_9px_rgba(227,110,85,.18)]" : "border-2 border-line-strong bg-paper text-ink-3"
              }`}
              style={{ left: nx, top: ny }}
            >
              {done ? <PiCheckBold /> : i + 1}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
