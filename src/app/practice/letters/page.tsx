"use client";

import Link from "next/link";
import { PiEnvelopeSimple } from "react-icons/pi";
import { PracticePage } from "@/components/practice/PracticeShell";
import { useDemo } from "@/lib/store";

export default function LettersPage() {
  const state = useDemo();
  const sent = state.estates.flatMap((e) => e.drafts.filter((d) => d.status === "sent").map((d) => ({ e, d })));
  return (
    <PracticePage eyebrow="Correspondence" title="Letters sent">
      <ul className="m-0 list-none overflow-hidden rounded-[22px] border border-line bg-paper p-0">
        {sent.map(({ e, d }) => (
          <li key={d.id} className="flex items-center gap-4 border-t border-line-soft px-5 py-4 first:border-t-0">
            <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-teal-tint text-lg text-teal">
              <PiEnvelopeSimple aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{d.title}</div>
              <div className="text-[13px] text-muted">
                To {d.to} · Re: {d.re}
              </div>
            </div>
            <Link href={`/practice/estate?id=${e.id}&tab=audit`} className="whitespace-nowrap text-[13px] font-semibold text-teal no-underline hover:underline">
              {e.deceased.shortName}
            </Link>
          </li>
        ))}
        {sent.length === 0 && (
          <li className="p-8 text-center text-muted">
            No letters sent from Waymark yet. Approve a draft in <Link href="/practice/drafts" className="font-semibold text-teal">AI drafts</Link> and it will appear here.
          </li>
        )}
      </ul>
    </PracticePage>
  );
}
