"use client";

import { PiArrowCounterClockwiseBold } from "react-icons/pi";
import { Cairn } from "@/components/brand/Cairn";
import { PracticePage } from "@/components/practice/PracticeShell";
import { Avatar, btn } from "@/components/ui/primitives";
import { useActions, useDemo } from "@/lib/store";

export default function SettingsPage() {
  const state = useDemo();
  const { reset } = useActions();
  return (
    <PracticePage eyebrow={state.firm.name} title="Settings">
      <div className="grid items-start gap-[18px] lg:grid-cols-2">
        <section className="rounded-[22px] border border-line bg-paper p-6">
          <h2 className="m-0 font-serif text-xl font-medium">Client portal branding</h2>
          <p className="m-0 mt-2 text-sm leading-relaxed text-ink-3">Executors see your firm&apos;s name throughout. &ldquo;We&rdquo; always means your firm.</p>
          <div className="mt-4 rounded-[18px] p-5" style={{ background: "linear-gradient(170deg,#FCE6C9 0%,#F8CDB8 60%,#EFC9D6 100%)" }}>
            <div className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Cairn size={24} />
              Waymark <span className="font-sans text-[13px] font-medium text-ink-3">with {state.firm.shortName}</span>
            </div>
            <p className="m-0 mt-3 font-serif text-2xl">Good evening, Sarah.</p>
          </div>
          <dl className="m-0 mt-4 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Firm name</dt>
            <dd className="m-0 font-semibold">{state.firm.name}</dd>
            <dt className="text-muted">Short name</dt>
            <dd className="m-0 font-semibold">{state.firm.shortName}</dd>
            <dt className="text-muted">Office</dt>
            <dd className="m-0 font-semibold">{state.firm.town}</dd>
          </dl>
        </section>
        <section className="rounded-[22px] border border-line bg-paper p-6">
          <h2 className="m-0 font-serif text-xl font-medium">Team</h2>
          <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
            {state.staff.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <Avatar initials={s.initials} color={s.color} size={36} />
                <div className="flex-1">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[13px] text-muted">{s.role}</div>
                </div>
                <span className="text-[13px] text-muted">{state.estates.filter((e) => e.feeEarnerId === s.id).length} estates</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[22px] border border-line bg-paper p-6">
          <h2 className="m-0 font-serif text-xl font-medium">Demo data</h2>
          <p className="m-0 mt-2 text-sm leading-relaxed text-ink-3">This prototype keeps its data in your browser. Reset to return every estate to its starting state.</p>
          <button type="button" onClick={reset} className={`${btn.secondary} mt-4 h-11 text-sm`}>
            <PiArrowCounterClockwiseBold aria-hidden /> Reset demo data
          </button>
        </section>
      </div>
    </PracticePage>
  );
}
