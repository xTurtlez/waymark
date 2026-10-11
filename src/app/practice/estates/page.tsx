"use client";

import Link from "next/link";
import { useState } from "react";
import { PiPlusBold } from "react-icons/pi";
import { WAITING_ICON } from "@/components/practice/EstateCard";
import { NewEstateSheet } from "@/components/practice/NewEstateSheet";
import { PracticePage } from "@/components/practice/PracticeShell";
import { Avatar, StageBar, btn } from "@/components/ui/primitives";
import { WAITING_STYLE } from "@/lib/stages";
import { clientParty, feeEarner, openFamilyTasks, stageLabel } from "@/lib/selectors";
import { useDemo } from "@/lib/store";

/** Dense table view of the whole caseload. */
export default function EstatesPage() {
  const state = useDemo();
  const [open, setOpen] = useState(false);
  const rows = [...state.estates].sort((a, b) => Number(b.attention) - Number(a.attention) || b.daysOpen - a.daysOpen);
  return (
    <PracticePage
      eyebrow={`${state.firm.name}`}
      title={`${state.estates.length} active estates`}
      actions={
        <button type="button" onClick={() => setOpen(true)} className={`${btn.primary} h-[46px] text-[15px]`}>
          <PiPlusBold aria-hidden /> New estate
        </button>
      }
    >
      <div className="overflow-x-auto rounded-[22px] border border-line bg-paper">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] font-semibold text-muted">
              <th className="px-5 py-3 font-semibold">Estate</th>
              <th className="px-3 py-3 font-semibold">Stage</th>
              <th className="px-3 py-3 font-semibold">Waiting on</th>
              <th className="px-3 py-3 font-semibold">Family</th>
              <th className="px-3 py-3 text-right font-semibold">Days</th>
              <th className="px-5 py-3 font-semibold">Fee earner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const Icon = WAITING_ICON[e.waitingOn];
              const fam = openFamilyTasks(e).length;
              const earner = feeEarner(state, e);
              return (
                <tr key={e.id} className="border-t border-line-soft align-middle hover:bg-cream">
                  <td className="px-5 py-3.5">
                    <Link href={`/practice/estate?id=${e.id}`} className="font-serif text-[17px] font-medium text-ink no-underline hover:underline">
                      {e.deceased.shortName}
                    </Link>
                    <div className="text-[12.5px] text-muted">
                      {e.ref} · {clientParty(e).name}
                      {e.attention && <span className="ml-2 rounded-full bg-coral px-2 py-0.5 text-[11px] font-semibold text-white">Needs attention</span>}
                    </div>
                  </td>
                  <td className="w-[220px] px-3 py-3.5">
                    <div className="mb-1.5 text-[12.5px] font-semibold">{stageLabel(e)}</div>
                    <StageBar stage={e.stage} height={5} gap={3} />
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex max-w-[280px] items-start gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium leading-snug ${WAITING_STYLE[e.waitingOn].chip}`}>
                      <Icon aria-hidden className="mt-0.5 flex-none" />
                      {e.blocker}
                    </span>
                  </td>
                  <td className={`px-3 py-3.5 font-semibold ${fam ? "text-amber-ink" : "text-muted"}`}>{fam ? `${fam} open` : "—"}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-ink-3">{e.daysOpen}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2">
                      <Avatar initials={earner.initials} color={earner.color} size={28} />
                      <span className="text-ink-3">{earner.name}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <NewEstateSheet open={open} onClose={() => setOpen(false)} />
    </PracticePage>
  );
}
