"use client";

import Link from "next/link";
import type { IconType } from "react-icons";
import { PiBank, PiBuildings, PiCheckCircle, PiGavel, PiHandWaving } from "react-icons/pi";
import { Avatar, StageBar } from "@/components/ui/primitives";
import { WAITING_STYLE } from "@/lib/stages";
import { clientParty, feeEarner, firstName, openFamilyTasks, stageLabel } from "@/lib/selectors";
import type { DemoState, Estate, WaitingOn } from "@/lib/types";

export const WAITING_ICON: Record<WaitingOn, IconType> = {
  bank: PiBuildings,
  hmrc: PiBank,
  registry: PiGavel,
  family: PiHandWaving,
  none: PiCheckCircle,
};

export function EstateCard({ estate, state }: { estate: Estate; state: DemoState }) {
  const earner = feeEarner(state, estate);
  const client = clientParty(estate);
  const fam = openFamilyTasks(estate).length;
  const Icon = WAITING_ICON[estate.waitingOn];
  return (
    <Link
      href={`/practice/estate?id=${estate.id}`}
      className={`group relative flex flex-col gap-3.5 rounded-[22px] border bg-paper p-5 text-ink no-underline shadow-card transition-shadow duration-150 hover:shadow-lift ${estate.attention ? "border-coral-line" : "border-line"}`}
    >
      <div className="flex justify-between gap-2.5">
        <div className="min-w-0">
          <div className="font-serif text-xl font-medium leading-tight group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">
            {estate.deceased.shortName}
          </div>
          <div className="mt-[3px] text-[13px] text-muted">
            {estate.ref} · {client.name}
          </div>
        </div>
        <span title={`Fee earner: ${earner.name}`}>
          <Avatar initials={earner.initials} color={earner.color} size={34} />
        </span>
      </div>
      <div>
        <div className="flex justify-between gap-2 text-[13px] font-semibold">
          <span>{stageLabel(estate)}</span>
          <span className="whitespace-nowrap font-medium text-muted">{estate.daysOpen} days open</span>
        </div>
        <div className="mt-2">
          <StageBar stage={estate.stage} />
        </div>
      </div>
      <div className={`flex items-start gap-2.5 rounded-[14px] px-3 py-[11px] text-[13.5px] font-medium leading-[1.35] ${WAITING_STYLE[estate.waitingOn].chip}`}>
        <Icon aria-hidden className="mt-px flex-none text-[17px]" />
        <span>{estate.blocker}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 text-[13px] font-semibold">
        <span className={fam ? "text-amber-ink" : "text-muted"}>
          {fam ? `${fam} item${fam > 1 ? "s" : ""} with ${firstName(client.name)}` : "Nothing with the family"}
        </span>
        {estate.attention && <span className="whitespace-nowrap rounded-full bg-coral px-2.5 py-1 text-white">Needs attention</span>}
      </div>
    </Link>
  );
}
