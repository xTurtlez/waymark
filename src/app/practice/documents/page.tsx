"use client";

import Link from "next/link";
import { PiCheckBold } from "react-icons/pi";
import { PracticePage } from "@/components/practice/PracticeShell";
import { DOC_FIRM, DOC_ICON } from "@/components/shared/assetMeta";
import { btn } from "@/components/ui/primitives";
import { useActions, useDemo } from "@/lib/store";
import type { Estate, EstateDocument } from "@/lib/types";
import { dayLabel } from "@/lib/format";

type Item = { e: Estate; d: EstateDocument };

function Section({ title, items, check, onCheck }: { title: string; items: Item[]; check?: boolean; onCheck: (estateId: string, docId: string) => void }) {
return (
  <section>
    <h2 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
      {title} · {items.length}
    </h2>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
      {items.map(({ e, d }) => {
        const Icon = DOC_ICON[d.icon];
        const st = DOC_FIRM[d.state];
        return (
          <div key={d.id} className={`flex flex-col gap-2 rounded-[18px] p-4 ${st.tile}`}>
            <div className="flex items-start gap-3">
              <Icon aria-hidden className="mt-0.5 flex-none text-xl text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{d.name}</div>
                <Link href={`/practice/estate?id=${e.id}&tab=documents`} className="text-[13px] text-muted no-underline hover:text-teal">
                  {e.deceased.shortName} · {e.ref}
                </Link>
                <div className={`mt-1 text-xs font-semibold ${st.text}`}>
                  {st.label}
                  {d.uploadedAt ? ` · added ${dayLabel(d.uploadedAt)}` : ""}
                </div>
              </div>
            </div>
            {check && (
              <button type="button" onClick={() => onCheck(e.id, d.id)} className={`${btn.primary} h-10 text-[13px]`}>
                <PiCheckBold aria-hidden /> Mark checked
              </button>
            )}
          </div>
        );
      })}
      {items.length === 0 && <p className="m-0 text-sm text-muted">Nothing here.</p>}
    </div>
  </section>
);
}

export default function DocumentsPage() {
  const state = useDemo();
  const { markDocChecked } = useActions();
  const toCheck = state.estates.flatMap((e) => e.documents.filter((d) => d.state === "checking").map((d) => ({ e, d })));
  const missing = state.estates.flatMap((e) => e.documents.filter((d) => d.state === "needed").map((d) => ({ e, d })));

  return (
    <PracticePage eyebrow="Across every estate" title="Documents">
      <Section title="Uploaded, waiting for a check" items={toCheck} check onCheck={markDocChecked} />
      <Section title="Still needed from families" items={missing} onCheck={markDocChecked} />
    </PracticePage>
  );
}
