"use client";

import Link from "next/link";
import { PiArrowRightBold, PiArrowCounterClockwiseBold, PiBriefcase, PiDeviceMobile, PiHandWaving } from "react-icons/pi";
import { Cairn, Wordmark } from "@/components/brand/Cairn";
import { StoreProvider, useActions, useDemo } from "@/lib/store";

/** Demo entry (GitHub Pages build): pick a side of the product. */
export default function DemoHome() {
  return (
    <StoreProvider mode="demo">
      <Home />
    </StoreProvider>
  );
}

function Home() {
  const state = useDemo();
  const { reset } = useActions();
  const firm = state.firm;

  return (
    <main className="relative min-h-screen overflow-hidden px-[clamp(20px,4vw,48px)] py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[220px] -top-[160px] size-[720px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(248,205,184,.85), rgba(252,230,201,.5) 45%, rgba(251,246,238,0) 70%)" }}
      />
      <div className="relative mx-auto max-w-[1080px]">
        <header className="flex items-center justify-between gap-4">
          <Wordmark size={28} markSize={34} />
          <button type="button" onClick={reset} className="inline-flex h-11 items-center gap-2 rounded-[14px] px-3 text-[15px] font-semibold text-ink-3 hover:bg-paper">
            <PiArrowCounterClockwiseBold aria-hidden /> Reset demo data
          </button>
        </header>

        <section className="pt-[clamp(32px,7vw,88px)]">
          <span className="inline-block rounded-full bg-teal-tint px-3.5 py-[7px] text-sm font-semibold text-teal">Product prototype · {firm.name}</span>
          <h1 className="mt-5 max-w-[760px] font-serif text-[clamp(40px,5.4vw,64px)] font-normal leading-[1.04] tracking-[-0.025em]">
            Every estate, every blocker, one calm workspace.
          </h1>
          <p className="mt-5 max-w-[620px] text-lg leading-relaxed text-ink-2">
            Both sides of Waymark share one set of data. Open the practice workspace and the client portal in two tabs, act on one side, and watch the other update.
          </p>
        </section>

        <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
          <Link
            href="/practice"
            className="group flex flex-col gap-4 rounded-[28px] bg-deep-teal p-7 text-cream no-underline shadow-[0_40px_80px_-30px_rgba(43,33,28,.35)] transition-transform duration-150 hover:-translate-y-0.5"
          >
            <span className="grid size-12 place-items-center rounded-[12px] bg-white/10 text-2xl text-amber">
              <PiBriefcase aria-hidden />
            </span>
            <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-on-dark-3">For the firm</span>
            <span className="font-serif text-[28px] leading-tight">Practice workspace</span>
            <span className="text-[15px] leading-relaxed text-on-dark-2">
              Signed in as Priya Shah, Partner. Caseload dashboard, estate workspace and the assistant that drafts under review.
            </span>
            <span className="mt-auto inline-flex items-center gap-2 font-semibold text-amber">
              Open workspace <PiArrowRightBold aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/portal"
            className="group flex flex-col gap-4 rounded-[28px] p-7 text-ink no-underline shadow-[0_40px_80px_-30px_rgba(43,33,28,.35)] transition-transform duration-150 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(160deg, #FCE6C9 0%, #F8CDB8 45%, #EFC9D6 100%)" }}
          >
            <span className="grid size-12 place-items-center rounded-[12px] bg-paper/70 text-2xl text-coral-ink">
              <PiDeviceMobile aria-hidden />
            </span>
            <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">For the family</span>
            <span className="font-serif text-[28px] leading-tight">Client portal</span>
            <span className="text-[15px] leading-relaxed text-ink-2">
              Signed in as Sarah Ellis, executor of her mother Margaret&apos;s estate. Branded for {firm.shortName}. Best on a phone.
            </span>
            <span className="mt-auto inline-flex items-center gap-2 font-semibold text-teal">
              Open portal <PiArrowRightBold aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/portal/welcome"
            className="group flex flex-col gap-4 rounded-[28px] border border-line bg-paper p-7 text-ink no-underline transition-transform duration-150 hover:-translate-y-0.5"
          >
            <span className="grid size-12 place-items-center rounded-[12px] bg-amber-tint text-2xl text-amber-ink">
              <PiHandWaving aria-hidden />
            </span>
            <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">First visit</span>
            <span className="font-serif text-[28px] leading-tight">Client onboarding</span>
            <span className="text-[15px] leading-relaxed text-ink-3">The welcome flow an executor sees when they accept their solicitor&apos;s invitation.</span>
            <span className="mt-auto inline-flex items-center gap-2 font-semibold text-teal">
              Start onboarding <PiArrowRightBold aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <footer className="mt-16 flex flex-wrap items-center gap-3 border-t border-line pt-6 text-sm text-muted">
          <Cairn size={22} />
          <span>Probate, one clear step at a time. Software for law firms. Waymark is not a law firm and does not give legal advice.</span>
        </footer>
      </div>
    </main>
  );
}
