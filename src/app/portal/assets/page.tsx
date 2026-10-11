"use client";

import { useState } from "react";
import { PiPlusBold } from "react-icons/pi";
import { PortalPage } from "@/components/portal/PortalShell";
import { ASSET_ICON, ASSET_TINT } from "@/components/shared/assetMeta";
import { AddAssetSheet } from "@/components/shared/AddAssetSheet";
import { TONE_CHIP } from "@/lib/stages";
import { feeEarner, firstName, totals } from "@/lib/selectors";
import { useClientEstate, useDemo } from "@/lib/store";
import { money } from "@/lib/format";

const CLIENT_TONE = { confirmed: "teal", awaiting: "plum", estimate: "amber", not_notified: "plum" } as const;
const STATUS_TEXT = { teal: "text-teal", plum: "text-plum", amber: "text-amber-ink", coral: "text-coral-ink", neutral: "text-muted" } as const;

export default function Assets() {
  const state = useDemo();
  const estate = useClientEstate();
  const [open, setOpen] = useState(false);
  const { owned, owed } = totals(estate);
  const solFirst = firstName(feeEarner(state, estate).name);

  return (
    <PortalPage>
      <h1 className="m-0 font-serif text-[32px] font-normal leading-[1.15]">What {estate.deceased.firstName} owned and owed</h1>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-[20px] bg-teal-tint p-4">
          <div className="text-[13px] font-semibold text-teal">Owned, so far</div>
          <div className="mt-1 font-serif text-[26px] font-medium text-teal-deep">{money(owned)}</div>
        </div>
        <div className="rounded-[20px] bg-coral-tint p-4">
          <div className="text-[13px] font-semibold text-coral-ink">Owed, so far</div>
          <div className="mt-1 font-serif text-[26px] font-medium text-coral-deep">{money(owed)}</div>
        </div>
      </div>
      <p className="m-0 mt-2.5 text-[13.5px] leading-[1.4] text-muted">Estimates until each one is confirmed. They don&apos;t need to be exact yet.</p>

      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-2.5 p-0">
        {estate.assets.map((a) => {
          const Icon = ASSET_ICON[a.kind];
          const tint = TONE_CHIP[ASSET_TINT[a.kind]];
          const statusTone = a.liability ? "coral" : CLIENT_TONE[a.state];
          return (
            <li key={a.id} className="flex flex-col gap-2 rounded-[20px] border border-line bg-paper p-3.5">
              <span className={`grid size-[42px] place-items-center rounded-[14px] text-[22px] ${tint}`}>
                <Icon aria-hidden />
              </span>
              <div className="text-[15px] font-semibold leading-tight">{a.clientName ?? a.name}</div>
              <div className="font-serif text-[19px] font-medium">{a.valuePence === null ? "Not known yet" : a.liability ? `owes ${money(a.valuePence)}` : money(a.valuePence)}</div>
              <div className={`text-xs font-semibold ${STATUS_TEXT[statusTone]}`}>{a.clientStatus.replace("Priya", solFirst)}</div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex h-[54px] w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-line-strong bg-transparent text-base font-semibold text-teal hover:bg-paper"
      >
        <PiPlusBold aria-hidden /> Add something
      </button>
      <AddAssetSheet open={open} onClose={() => setOpen(false)} estateId={estate.id} by="family" ownerName={estate.deceased.firstName} solicitorName={solFirst} />
    </PortalPage>
  );
}
