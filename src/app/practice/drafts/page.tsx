"use client";

import Link from "next/link";
import { PiArrowRightBold, PiCheckBold, PiSparkleFill } from "react-icons/pi";
import { PracticePage } from "@/components/practice/PracticeShell";
import { btn } from "@/components/ui/primitives";
import { pendingDrafts } from "@/lib/selectors";
import { useActions, useDemo } from "@/lib/store";
import { stampLabel } from "@/lib/format";

export default function DraftsPage() {
  const state = useDemo();
  const { approveDraft } = useActions();
  const drafts = pendingDrafts(state);
  return (
    <PracticePage eyebrow="Assistant" title={drafts.length ? `${drafts.length} draft${drafts.length === 1 ? "" : "s"} for your review` : "All drafts reviewed"}>
      <p className="m-0 -mt-2 max-w-[640px] text-[15px] leading-relaxed text-ink-3">
        The assistant drafts letters from each estate&apos;s documents and sent log. Nothing goes to a bank, HMRC or a client until a solicitor approves it, and every approval is logged against the estate.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] gap-[18px]">
        {drafts.map(({ estate, draft }) => (
          <article key={draft.id} className="flex flex-col gap-3 rounded-[22px] border border-plum-border bg-paper p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-plum px-[11px] py-[5px] text-[12.5px] font-semibold text-plum">
                <PiSparkleFill aria-hidden /> Draft · needs review
              </span>
              <span className="text-xs text-muted">{stampLabel(draft.createdAt)}</span>
            </div>
            <div>
              <h2 className="m-0 font-serif text-xl font-medium">{draft.title}</h2>
              <div className="mt-1 text-[13px] text-muted">
                {estate.deceased.shortName} · {estate.ref} · to {draft.to}
              </div>
            </div>
            <p className="m-0 line-clamp-3 text-sm leading-relaxed text-ink-3">{draft.body.slice(1).join(" ").replace(/\[\[|\]\]/g, "")}</p>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <Link href={`/practice/estate?id=${estate.id}&ai=draft&draft=${draft.id}`} className={`${btn.plumOutline} h-11 text-sm no-underline`}>
                Open <PiArrowRightBold aria-hidden />
              </Link>
              <button type="button" onClick={() => approveDraft(estate.id, draft.id)} className={`${btn.primary} h-11 text-sm`}>
                <PiCheckBold aria-hidden /> Approve &amp; send
              </button>
            </div>
          </article>
        ))}
      </div>
      {drafts.length === 0 && (
        <p className="rounded-[22px] border border-dashed border-line-strong bg-paper p-8 text-center text-muted">
          Nothing waiting. Sent letters are listed under <Link href="/practice/letters" className="font-semibold text-teal">Letters</Link>.
        </p>
      )}
    </PracticePage>
  );
}
