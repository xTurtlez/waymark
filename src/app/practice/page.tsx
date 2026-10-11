"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PiArrowRightBold, PiCaretDown, PiMagnifyingGlass, PiPlusBold, PiSortDescending, PiSparkleFill } from "react-icons/pi";
import { EstateCard } from "@/components/practice/EstateCard";
import { NewEstateSheet } from "@/components/practice/NewEstateSheet";
import { PracticePage } from "@/components/practice/PracticeShell";
import { btn } from "@/components/ui/primitives";
import { STAGES, WAITING_STYLE } from "@/lib/stages";
import { isThirdParty, openFamilyTasks, pendingDrafts, staffById, waitingCounts } from "@/lib/selectors";
import { useDemo } from "@/lib/store";
import { greeting, longDate, numberWord } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { Estate } from "@/lib/types";

type Filter = "attention" | "client" | "third" | "all";
type Sort = "waiting" | "newest" | "name" | "stage";

const TABS: { id: Filter; label: string; dot: string; test: (e: Estate) => boolean }[] = [
  { id: "attention", label: "Needs attention", dot: "bg-coral", test: (e) => e.attention },
  { id: "client", label: "Waiting on family", dot: "bg-amber", test: (e) => openFamilyTasks(e).length > 0 },
  { id: "third", label: "Waiting on others", dot: "bg-plum", test: (e) => isThirdParty(e.waitingOn) },
  { id: "all", label: "All active", dot: "bg-teal", test: () => true },
];

const selectCls =
  "h-10 appearance-none rounded-[12px] border border-line bg-paper pl-3.5 pr-9 text-sm font-medium text-ink-3 hover:bg-cream focus:outline-2 focus:outline-offset-2 focus:outline-teal";

export default function Dashboard() {
  const state = useDemo();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("attention");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("any");
  const [earner, setEarner] = useState("any");
  const [sort, setSort] = useState<Sort>("waiting");
  const [newOpen, setNewOpen] = useState(false);

  const me = staffById(state, state.currentStaffId);
  const attentionCount = state.estates.filter((e) => e.attention).length;
  const drafts = pendingDrafts(state);
  const docsRead = state.estates.reduce((n, e) => n + e.extractions.filter((x) => x.status === "review").length, 0);

  const estates = useMemo(() => {
    const tab = TABS.find((t) => t.id === filter)!;
    const q = query.trim().toLowerCase();
    const list = state.estates.filter((e) => {
      if (!tab.test(e)) return false;
      if (stage !== "any" && String(e.stage) !== stage) return false;
      if (earner !== "any" && e.feeEarnerId !== earner) return false;
      if (q) {
        const hay = [e.deceased.fullName, e.ref, ...e.parties.map((p) => p.name)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...list];
    if (sort === "waiting") sorted.sort((a, b) => b.daysOpen - a.daysOpen);
    if (sort === "newest") sorted.sort((a, b) => a.daysOpen - b.daysOpen);
    if (sort === "name") sorted.sort((a, b) => a.deceased.shortName.localeCompare(b.deceased.shortName));
    if (sort === "stage") sorted.sort((a, b) => a.stage - b.stage);
    // Attention first in the default view, matching the design order.
    if (sort === "waiting" && filter === "attention") return list;
    return sorted;
  }, [state.estates, filter, query, stage, earner, sort]);

  const wc = waitingCounts(state);
  const max = Math.max(1, wc.family, wc.bank, wc.registry, wc.hmrc);
  const waiting = [
    { label: WAITING_STYLE.family.label, n: wc.family, bar: WAITING_STYLE.family.bar },
    { label: WAITING_STYLE.bank.label, n: wc.bank, bar: WAITING_STYLE.bank.bar },
    { label: WAITING_STYLE.registry.label, n: wc.registry, bar: WAITING_STYLE.registry.bar },
    { label: WAITING_STYLE.hmrc.label, n: wc.hmrc, bar: WAITING_STYLE.hmrc.bar },
  ];

  const hello = now ? `${greeting(now)}, ${me?.name.split(" ")[0]}.` : `Hello, ${me?.name.split(" ")[0]}.`;
  const headline =
    attentionCount === 0
      ? `${hello} Nothing urgent today.`
      : `${hello} ${numberWord(attentionCount)} estate${attentionCount === 1 ? " needs" : "s need"} you today.`;

  return (
    <PracticePage
      eyebrow={now ? longDate(now) : " "}
      title={headline}
      actions={
        <>
          <label className="flex h-[46px] w-[min(300px,100%)] items-center gap-2.5 rounded-[14px] border border-line bg-paper px-4 text-[15px] text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal">
            <PiMagnifyingGlass aria-hidden className="flex-none text-lg" />
            <span className="sr-only">Search estates</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search estates, people, refs"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
            />
          </label>
          <button type="button" onClick={() => setNewOpen(true)} className={`${btn.primary} h-[46px] text-[15px]`}>
            <PiPlusBold aria-hidden /> New estate
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Filter estates" className="flex flex-wrap gap-1.5 rounded-[16px] bg-line-soft p-[5px]">
          {TABS.map((t) => {
            const n = state.estates.filter(t.test).length;
            const on = filter === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`flex h-10 items-center gap-2 rounded-[12px] px-4 text-sm font-semibold text-ink transition-colors ${on ? "bg-paper shadow-[0_1px_3px_rgba(43,33,28,.12)]" : "hover:bg-paper/50"}`}
              >
                <span className={`size-2 rounded-full ${t.dot}`} />
                {t.label}
                <span className="font-medium text-muted">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <select aria-label="Stage" className={selectCls} value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="any">All stages</option>
              {STAGES.map((s, i) => (
                <option key={s.long} value={String(i)}>
                  {i + 1}. {s.long}
                </option>
              ))}
            </select>
            <PiCaretDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
          </div>
          <div className="relative">
            <select aria-label="Fee earner" className={selectCls} value={earner} onChange={(e) => setEarner(e.target.value)}>
              <option value="any">Fee earner: anyone</option>
              {state.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  Fee earner: {s.name}
                </option>
              ))}
            </select>
            <PiCaretDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
          </div>
          <div className="relative">
            <PiSortDescending aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <select aria-label="Sort" className={`${selectCls} pl-8`} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="waiting">Longest waiting</option>
              <option value="newest">Newest first</option>
              <option value="stage">By stage</option>
              <option value="name">By name</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-[18px]">
          {estates.map((e) => (
            <EstateCard key={e.id} estate={e} state={state} />
          ))}
          {estates.length === 0 && (
            <p className="col-span-full rounded-[22px] border border-dashed border-line-strong bg-paper p-8 text-center text-muted">
              No estates match. {query && <>Nothing found for “{query}”.</>}
            </p>
          )}
        </div>

        <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-[22px] border border-line bg-paper p-[22px]">
            <h2 className="m-0 font-serif text-xl font-medium">Who we&apos;re waiting on</h2>
            <div className="mt-4 flex flex-col gap-3.5">
              {waiting.map((w) => (
                <div key={w.label}>
                  <div className="flex justify-between text-sm font-medium">
                    <span>{w.label}</span>
                    <b>{w.n}</b>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-line-soft">
                    <div className={`h-full rounded-full ${w.bar}`} style={{ width: `${Math.round((w.n / max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] bg-plum-tint p-[22px] text-plum-deep">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-plum">
              <PiSparkleFill aria-hidden className="text-base" />
              Assistant · for your review
            </div>
            <p className="m-0 mt-2.5 text-base leading-[1.45]">
              {drafts.length
                ? `${numberWord(drafts.length)} letter${drafts.length === 1 ? "" : "s"} drafted overnight${docsRead ? ` and ${docsRead} document${docsRead === 1 ? "" : "s"} read` : ""}. Nothing is sent until you approve it.`
                : "All drafts reviewed. Nothing is waiting for you."}
            </p>
            {drafts.length > 0 && (
              <div className="mt-3.5 flex flex-col gap-2 text-sm font-medium">
                {drafts.map(({ estate, draft }) => (
                  <Link
                    key={draft.id}
                    href={`/practice/estate?id=${estate.id}&ai=draft&draft=${draft.id}`}
                    className="rounded-[12px] bg-paper px-3 py-2.5 text-ink no-underline hover:bg-cream"
                  >
                    {draft.title} · {estate.deceased.shortName.split(" ").at(-1)}
                  </Link>
                ))}
              </div>
            )}
            <Link href="/practice/drafts" className="mt-3.5 flex h-11 items-center justify-center gap-2 rounded-[12px] bg-plum text-sm font-semibold text-cream no-underline hover:bg-plum-deep">
              Review drafts <PiArrowRightBold aria-hidden />
            </Link>
          </section>


        </div>
      </div>
      <NewEstateSheet open={newOpen} onClose={() => setNewOpen(false)} />
    </PracticePage>
  );
}
