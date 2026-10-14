"use client";

import Link from "next/link";
import { useState } from "react";
import { PiCaretLeftBold, PiCircleFill, PiLightbulbFill, PiPlusBold } from "react-icons/pi";
import { AddAssetSheet } from "@/components/shared/AddAssetSheet";
import { Avatar, btn } from "@/components/ui/primitives";
import { feeEarner, firstName } from "@/lib/selectors";
import { useClientEstate, useDemo } from "@/lib/store";
import { assetStatus } from "@/lib/derive";

export default function TodaysStep() {
  const state = useDemo();
  const estate = useClientEstate();
  const [open, setOpen] = useState(false);
  const sol = feeEarner(state, estate);
  const solFirst = firstName(sol.name);
  const step = estate.todayStep;
  const familyBanks = estate.assets.filter((a) => (a.kind === "bank" || a.kind === "savings") && a.addedBy === "family");

  if (!step) {
    return (
      <main className="flex flex-1 flex-col gap-4 px-6 py-10">
        <h1 className="m-0 font-serif text-[32px] font-normal">Nothing to do today</h1>
        <Link href="/portal" className="font-semibold text-teal">
          Back to your journey
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <Link href="/portal" className="flex h-11 items-center gap-1.5 rounded-full bg-line-soft pl-2.5 pr-3.5 text-[15px] font-semibold text-ink no-underline hover:bg-line">
          <PiCaretLeftBold aria-hidden /> Journey
        </Link>
        <span className="text-[13px] font-semibold text-muted">Stage {estate.stage + 1} · step 1 of 3</span>
      </div>
      <main className="flex-1 px-6 pt-6">
        <span className="rounded-full bg-coral-tint px-[11px] py-[5px] text-[13px] font-semibold text-coral-ink">Today&apos;s step</span>
        <h1 className="m-0 mt-3.5 font-serif text-[34px] font-normal leading-[1.12] tracking-[-0.015em]">{step.stepTitle}</h1>

        <div className="mt-[22px] rounded-[22px] bg-teal-tint p-[18px]">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-teal">
            <PiLightbulbFill aria-hidden className="text-lg" /> Why this matters
          </div>
          <p className="m-0 mt-2 text-base leading-normal text-teal-text">{step.why.replace("Priya", solFirst)}</p>
        </div>

        <h2 className="m-0 mt-6 text-[17px] font-semibold">What you&apos;ll need</h2>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
          {step.needs.map((n) => (
            <li key={n} className="flex items-start gap-3 text-base leading-[1.45]">
              <PiCircleFill aria-hidden className="mt-[7px] flex-none text-[10px] text-amber" />
              {n}
            </li>
          ))}
        </ul>

        {familyBanks.length > 0 && (
          <div className="mt-6">
            <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-teal">You&apos;ve added · {familyBanks.length}</h2>
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
              {familyBanks.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[16px] border border-line bg-paper px-4 py-3 text-[15px] font-semibold">
                  {a.clientName ?? a.name}
                  <span className="text-[13px] font-semibold text-amber-ink">{assetStatus(a, estate, solFirst).client}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-[22px] flex items-center gap-3 rounded-[18px] border border-line bg-paper px-4 py-3.5">
          <Avatar initials={sol.initials} color="#5B2E57" size={40} />
          <p className="m-0 text-[15px] leading-[1.4] text-ink-2">
            <b>Then {solFirst} takes over.</b> She&apos;ll write to each bank for you.
          </p>
        </div>
      </main>
      <div className="sticky bottom-0 px-6 pb-[max(34px,env(safe-area-inset-bottom))] pt-4" style={{ background: "linear-gradient(180deg,rgba(251,246,238,0),#FBF6EE 30%)" }}>
        <button type="button" onClick={() => setOpen(true)} className={`${btn.primaryLg} w-full`}>
          <PiPlusBold aria-hidden /> {familyBanks.length ? "Add another account" : "Add the first account"}
        </button>
        <Link href="/portal/messages?compose=banks" className="mt-2 flex h-11 items-center justify-center text-[15px] font-semibold text-teal no-underline hover:underline">
          I&apos;m not sure which banks she used
        </Link>
      </div>
      <AddAssetSheet open={open} onClose={() => setOpen(false)} estateId={estate.id} by="family" defaultKind="bank" ownerName={estate.deceased.firstName} solicitorName={solFirst} />
    </div>
  );
}
