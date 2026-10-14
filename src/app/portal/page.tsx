"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PiArrowRightBold, PiChatCircleText, PiXBold } from "react-icons/pi";
import { JourneyPath } from "@/components/portal/JourneyPath";
import { BottomNav, PortalBrand } from "@/components/portal/PortalShell";
import { Avatar, btn } from "@/components/ui/primitives";
import { clientParty, feeEarner, firstName, openFamilyTasks } from "@/lib/selectors";
import { useClientEstate, useDemo, useStore } from "@/lib/store";
import { greeting, numberWord } from "@/lib/format";
import { useNow } from "@/lib/useNow";

export default function Journey() {
  const state = useDemo();
  const estate = useClientEstate();
  const now = useNow();
  const [termOpen, setTermOpen] = useState(false);
  const { mode } = useStore();
  const router = useRouter();
  // First visit after accepting the invite: start with onboarding.
  useEffect(() => {
    if (mode === "live" && !state.onboarded) router.replace("/portal/welcome");
  }, [mode, state.onboarded, router]);
  const me = clientParty(estate);
  const sol = feeEarner(state, estate);
  const solFirst = firstName(sol.name);
  const step = estate.todayStep;
  const needsYou = openFamilyTasks(estate).length;
  const evening = now ? now.getHours() >= 18 : false;
  const behind = estate.stage;
  const progressPct = Math.min(95, Math.max(5, Math.round(((estate.monthsIn ?? 3) / 10.5) * 100)));

  return (
    <>
      <main className="flex-1">
        <div className="relative overflow-hidden pb-10" style={{ background: "linear-gradient(170deg,#FCE6C9 0%,#F8CDB8 38%,#EFC9D6 72%,#FBF6EE 100%)" }}>
          <div aria-hidden className="absolute -right-[70px] top-[60px] size-[220px] rotate-[20deg] rounded-[100%_0] bg-teal/10" />
          <div aria-hidden className="absolute right-10 top-[150px] size-[140px] -rotate-[30deg] rounded-[100%_0] bg-plum/[0.08]" />
          <div aria-hidden className="absolute -left-[120px] -top-[90px] size-[260px] rounded-full" style={{ background: "radial-gradient(circle,rgba(255,230,180,.9),rgba(255,230,180,0) 70%)" }} />

          <PortalBrand className="relative px-6 pt-5" />

          <div className="relative px-6 pt-[30px]">
            <p className="m-0 text-[15px] font-medium text-ink-3">{estate.deceased.shortName}&apos;s estate</p>
            <h1 className="m-0 mt-1.5 font-serif text-[36px] font-normal leading-[1.12] tracking-[-0.015em]">
              {now ? greeting(now) : "Hello"}, {firstName(me.name)}. You&apos;re doing well.
            </h1>
            <p className="m-0 mt-3 text-[17px] leading-normal text-ink-2">
              {behind > 0 ? `${numberWord(behind)} stage${behind > 1 ? "s are" : " is"} behind you. ` : "You've made a start. "}
              {step ? `There's one thing to look at today${evening ? ", and it can wait until morning" : ""}.` : "There's nothing you need to do today."}
            </p>
          </div>

          {step && (
            <div className="relative mx-4 mt-6 animate-rise rounded-[28px] bg-paper p-[22px] shadow-task">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-coral-tint px-[11px] py-[5px] text-[13px] font-semibold text-coral-ink">Today&apos;s step</span>
                <span className="text-[13px] font-medium text-muted">About {step.minutes} minutes</span>
              </div>
              <h2 className="m-0 mt-3.5 font-serif text-[25px] font-medium leading-[1.2]">{step.title}</h2>
              <p className="m-0 mt-2 text-base leading-normal text-ink-3">{step.body.replace("Priya", solFirst)}</p>
              <Link href="/portal/step" className={`${btn.primaryLg} mt-[18px] w-full no-underline`}>
                Begin <PiArrowRightBold aria-hidden />
              </Link>
            </div>
          )}
        </div>

        <section className="px-6 pt-2">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 font-serif text-2xl font-medium">Your path</h2>
            <span className="text-sm font-semibold text-teal">{estate.stage} of 7 done</span>
          </div>
          <p className="m-0 mt-1.5 text-[15px] leading-normal text-muted">Seven stages. {solFirst} handles most of them for you.</p>
        </section>
        <JourneyPath stage={estate.stage} needsYou={needsYou} />

        <section className="mx-4 mt-3 rounded-[28px] border border-line bg-paper p-[22px]">
          <h2 className="m-0 font-serif text-[22px] font-medium">An honest timeline</h2>
          <p className="m-0 mt-2 text-base leading-normal text-ink-2">
            Estates like {estate.deceased.firstName}&apos;s usually take <b>{estate.typicalDuration ?? "9 to 12 months"}</b>. You&apos;re about {estate.monthsIn ?? 3} months in.
          </p>
          <div className="relative mt-[18px] h-3 rounded-full bg-line-soft" role="img" aria-label={`About ${progressPct}% of the way through`}>
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#0E5F5B,#E3A13A)" }} />
            <div className="absolute -top-[5px] -ml-[11px] size-[22px] rounded-full border-4 border-paper bg-coral" style={{ left: `${progressPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[13px] font-medium text-muted">
            <span>Jun 2026</span>
            <span>Now</span>
            <span>Spring 2027</span>
          </div>
          <p className="m-0 mt-4 text-[15px] leading-[1.55] text-ink-3">
            Once any tax is settled, {solFirst} applies for the{" "}
            <button
              type="button"
              aria-expanded={termOpen}
              aria-controls="term-probate"
              onClick={() => setTermOpen((v) => !v)}
              className="border-0 bg-transparent p-0 font-semibold text-teal underline decoration-dotted underline-offset-4"
            >
              grant of probate
            </button>
            . The probate office currently takes 8 to 16 weeks.
          </p>
          {termOpen && (
            <div id="term-probate" className="mt-3 animate-fade rounded-[16px] bg-teal-tint px-4 py-3.5 text-[15px] leading-normal text-teal-text">
              <div className="flex items-center justify-between text-[13px] font-semibold uppercase tracking-[0.04em] text-teal">
                In plain English
                <button type="button" onClick={() => setTermOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-full bg-teal/10 text-teal">
                  <PiXBold aria-hidden />
                </button>
              </div>
              A legal document from the court that confirms {firstName(me.name)} is allowed to deal with {estate.deceased.firstName}&apos;s money and property. Banks ask to see it before they release funds.
            </div>
          )}
          <p className="m-0 mt-3.5 text-sm leading-normal text-muted">Questions from HMRC or slow replies from banks can add time. {solFirst} will tell you as soon as anything changes.</p>
        </section>

        <section className="mx-4 mt-3 flex items-center gap-3.5 rounded-[24px] bg-plum-tint p-4">
          <Avatar initials={sol.initials} color="#5B2E57" size={52} />
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{sol.name}</div>
            <div className="text-sm leading-[1.35] text-plum">Your solicitor · usually replies within a working day</div>
          </div>
          <Link href="/portal/messages" aria-label={`Message ${solFirst}`} className="grid size-12 flex-none place-items-center rounded-full bg-paper text-[22px] text-plum no-underline">
            <PiChatCircleText aria-hidden />
          </Link>
        </section>
        <div className="h-7" />
      </main>
      <BottomNav />
    </>
  );
}
