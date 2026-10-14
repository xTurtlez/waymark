"use client";

import { PortalPage } from "@/components/portal/PortalShell";
import { TONE_DOT } from "@/lib/stages";
import { feeEarner, firstName } from "@/lib/selectors";
import { useClientEstate, useDemo } from "@/lib/store";
import { whenLabel } from "@/lib/format";

export default function Updates() {
  const state = useDemo();
  const estate = useClientEstate();
  const solFirst = firstName(feeEarner(state, estate).name);
  return (
    <PortalPage>
      <h1 className="m-0 font-serif text-[32px] font-normal leading-[1.15]">What&apos;s been happening</h1>
      <p className="m-0 mt-2 text-base leading-normal text-ink-3">
        From {solFirst} and the team at {state.firm.shortName}. Things are moving, even on quiet days.
      </p>
      <ol className="relative m-0 mt-[22px] list-none pl-[34px]">
        <div aria-hidden className="absolute bottom-0 left-[11px] top-2 w-[3px] rounded-full" style={{ background: "linear-gradient(180deg,#E36E55,#E3A13A 50%,#0E5F5B)" }} />
        {[...estate.updates].sort((a, b) => (a.at < b.at ? 1 : -1)).map((u) => (
          <li key={u.id} className="relative mb-4 animate-rise">
            <span aria-hidden className={`absolute -left-[34px] top-4 size-[25px] rounded-full border-4 border-cream ${TONE_DOT[u.tone]}`} />
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted">{whenLabel(u.at)}</div>
            <div className={`rounded-[20px] border border-line px-4 py-3.5 ${u.milestone ? "bg-teal-tint" : "bg-paper"}`}>
              <div className="text-base font-semibold leading-[1.35]">{u.title}</div>
              <div className="mt-1 text-[14.5px] leading-[1.45] text-ink-3">{u.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </PortalPage>
  );
}
