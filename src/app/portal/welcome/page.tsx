"use client";

import Link from "next/link";
import { useState } from "react";
import { PiArrowLeftBold, PiArrowRightBold, PiCheckBold, PiCheckCircleFill } from "react-icons/pi";
import { Cairn } from "@/components/brand/Cairn";
import { Avatar } from "@/components/ui/primitives";
import { clientParty, feeEarner, firstName } from "@/lib/selectors";
import { useActions, useClientEstate, useDemo, useStore } from "@/lib/store";

const RELATIONSHIPS = ["Mum or dad", "Partner", "Brother or sister", "Friend", "Someone else"];
const ROLES = [
  { title: "I'm an executor", body: "Named in the will, or agreed with the family, to sort out the estate." },
  { title: "I'm due to receive something", body: "A beneficiary. You'll see progress and anything that needs you." },
  { title: "I'm not sure", body: "That's fine. {sol} will help you work it out." },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const primary = "h-[58px] w-full rounded-[18px] bg-teal text-[17px] font-semibold text-paper transition-colors hover:bg-teal-hover disabled:opacity-50";
const field = "h-[58px] w-full rounded-[16px] border-[1.5px] border-line-strong bg-paper px-4 text-[17px] focus:border-2 focus:border-teal focus:outline-none";

export default function Welcome() {
  const state = useDemo();
  const estate = useClientEstate();
  const { completeOnboarding } = useActions();
  const { mode } = useStore();
  const me = clientParty(estate);
  const sol = feeEarner(state, estate);
  const solFirst = firstName(sol.name);
  const [step, setStep] = useState(0);
  const dod = estate.deceased.dateOfDeath ? new Date(estate.deceased.dateOfDeath + "T12:00:00") : null;
  const [name, setName] = useState(estate.deceased.fullName);
  const [day, setDay] = useState(dod ? String(dod.getDate()) : "");
  const [month, setMonth] = useState(dod ? MONTHS[dod.getMonth()] : "");
  const [year, setYear] = useState(dod ? String(dod.getFullYear()) : "");
  const [rel, setRel] = useState(RELATIONSHIPS[0]);
  const [role, setRole] = useState(0);
  const [noSolicitor, setNoSolicitor] = useState(false);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const nameOk = name.trim().length > 2;

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
      {step === 0 && (
        <>
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(175deg,#FCE6C9 0%,#F8CDB8 40%,#EFC9D6 78%,#E9DCEB 100%)" }} />
          <div aria-hidden className="absolute -left-20 top-[120px] size-[300px] rounded-full" style={{ background: "radial-gradient(circle,rgba(255,236,196,.95),rgba(255,236,196,0) 70%)" }} />
          <div aria-hidden className="absolute -right-[50px] top-[200px] size-[200px] rotate-[25deg] rounded-[100%_0] bg-teal/[0.12]" />
          <div aria-hidden className="absolute right-[90px] top-[300px] size-[120px] -rotate-[20deg] rounded-[100%_0] bg-plum/10" />
          <div aria-hidden className="absolute left-[30px] top-20 size-[150px] rotate-[10deg] rounded-[0_100%] bg-amber/[0.16]" />
          <div className="relative flex flex-1 flex-col px-7 pb-[34px] pt-7">
            <div className="flex items-center gap-2 font-serif text-xl font-semibold">
              <Cairn size={26} /> Waymark
            </div>
            <div className="mt-1.5 text-sm font-medium text-ink-2">Invited by {state.firm.name}</div>
            <div className="mt-auto pt-16">
              <h1 className="m-0 font-serif text-[42px] font-normal leading-[1.1] tracking-[-0.02em]">We&apos;re sorry for your loss.</h1>
              <p className="m-0 mt-4 font-serif text-[25px] leading-[1.3] text-ink-2">We&apos;ll take this one step at a time, together.</p>
              <p className="m-0 mt-[18px] text-[17px] leading-normal text-ink-2">There&apos;s no rush. You can stop whenever you like and pick up where you left off.</p>
              <button type="button" onClick={next} className={`${primary} mt-7`}>
                Let&apos;s begin
              </button>
              <p className="m-0 mt-3.5 text-center text-[15px] text-ink-3">
                Already have an account?{" "}
                <Link href="/portal" className="font-semibold text-teal">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </>
      )}

      {step > 0 && step < 4 && (
        <div className="flex items-center gap-3 px-5 pt-5">
          <button type="button" onClick={back} aria-label="Back" className="grid size-11 place-items-center rounded-full bg-line-soft text-lg text-ink hover:bg-line">
            <PiArrowLeftBold aria-hidden />
          </button>
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {[1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-teal" : "bg-line"}`} />
            ))}
          </div>
          <span className="text-sm font-semibold text-muted">{step} of 3</span>
        </div>
      )}

      {step === 1 && (
        <form
          className="flex flex-1 flex-col px-6 pb-[34px] pt-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameOk) next();
          }}
        >
          <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.15]">Who has died?</h2>
          <p className="m-0 mt-2.5 text-[17px] leading-normal text-ink-3">Their name as it appears on official papers. You can change this later.</p>
          <label htmlFor="ob-name" className="mt-[26px] text-[15px] font-semibold">
            Full name
          </label>
          <input id="ob-name" className={`${field} mt-2`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <fieldset className="m-0 mt-5 border-0 p-0">
            <legend className="text-[15px] font-semibold">Date they died</legend>
            <div className="mt-2 grid grid-cols-[1fr_1.4fr_1.2fr] gap-2">
              <label className="sr-only" htmlFor="ob-day">
                Day
              </label>
              <input id="ob-day" className={field} inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Day" />
              <label className="sr-only" htmlFor="ob-month">
                Month
              </label>
              <select id="ob-month" className={field} value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="ob-year">
                Year
              </label>
              <input id="ob-year" className={field} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Year" />
            </div>
          </fieldset>
          <fieldset className="m-0 mt-5 border-0 p-0">
            <legend className="text-[15px] font-semibold">They were my…</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {RELATIONSHIPS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={rel === r}
                  onClick={() => setRel(r)}
                  className={`h-[46px] rounded-full px-[18px] text-[15px] ${rel === r ? "bg-teal font-semibold text-white" : "border-[1.5px] border-line-strong font-medium hover:bg-paper"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={!nameOk} className={`${primary} mt-auto`}>
            Continue
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col px-6 pb-[34px] pt-7">
          <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.15]">What&apos;s your part in this?</h2>
          <p className="m-0 mt-2.5 text-[17px] leading-normal text-ink-3">It helps us show you the right things.</p>
          <div role="radiogroup" aria-label="Your role" className="mt-6 flex flex-col gap-3">
            {ROLES.map((r, i) => {
              const on = role === i;
              return (
                <button
                  key={r.title}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRole(i)}
                  className={`flex items-start gap-3.5 rounded-[20px] p-[18px] text-left ${on ? "border-2 border-teal bg-paper" : "border-[1.5px] border-line-strong bg-transparent hover:bg-paper/60"}`}
                >
                  <span className={`mt-0.5 size-[26px] flex-none rounded-full ${on ? "border-8 border-teal" : "border-2 border-line-strong"}`} />
                  <span>
                    <span className="block text-[17px] font-semibold">{r.title}</span>
                    <span className="mt-1 block text-[15px] leading-[1.45] text-ink-3">{r.body.replace("{sol}", solFirst)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={next} className={`${primary} mt-auto`}>
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-1 flex-col px-6 pb-[34px] pt-7">
          <h2 className="m-0 font-serif text-[32px] font-normal leading-[1.15]">Who is your solicitor?</h2>
          <p className="m-0 mt-2.5 text-[17px] leading-normal text-ink-3">We found an invitation linked to your email.</p>
          <button
            type="button"
            onClick={() => setNoSolicitor(false)}
            aria-pressed={!noSolicitor}
            className={`mt-6 rounded-[22px] bg-paper p-5 text-left ${!noSolicitor ? "border-2 border-teal" : "border-[1.5px] border-line-strong"}`}
          >
            <div className="flex items-center gap-3.5">
              <Avatar initials={sol.initials} color="#5B2E57" size={56} />
              <div>
                <div className="text-lg font-semibold">{sol.name}</div>
                <div className="text-[15px] text-ink-3">
                  {state.firm.name}, {state.firm.town}
                </div>
              </div>
              {!noSolicitor && <PiCheckCircleFill aria-hidden className="ml-auto text-[28px] text-teal" />}
            </div>
            <p className="m-0 mt-3.5 text-[15px] leading-normal text-ink-2">{solFirst} will see what you add here and keep you updated as she works.</p>
          </button>
          <button
            type="button"
            onClick={() => setNoSolicitor(true)}
            aria-pressed={noSolicitor}
            className={`mt-3 rounded-[20px] p-[18px] text-left text-base font-medium text-ink-2 ${noSolicitor ? "border-2 border-teal bg-paper" : "border-[1.5px] border-line-strong"}`}
          >
            I don&apos;t have a solicitor yet
          </button>
          {noSolicitor && (
            <p className="m-0 mt-3 rounded-[16px] bg-amber-tint p-4 text-[15px] leading-normal text-amber-ink">
              Waymark works through your solicitor, so you&apos;ll need one to continue. If this invitation reached you by mistake, you can simply close this page.
            </p>
          )}
          <button
            type="button"
            disabled={noSolicitor}
            onClick={() => {
              completeOnboarding({ deceasedName: name, relationship: rel });
              next();
            }}
            className={`${primary} mt-auto`}
          >
            That&apos;s right
          </button>
        </div>
      )}

      {step === 4 && (
        <>
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(175deg,#FBF6EE 0%,#FCE6C9 55%,#F8CDB8 100%)" }} />
          <div className="relative flex flex-1 flex-col px-7 pb-[34px] pt-[60px]">
            <div className="grid size-[72px] animate-rise place-items-center rounded-full bg-teal text-[32px] text-white">
              <PiCheckBold aria-hidden />
            </div>
            <h2 className="m-0 mt-7 font-serif text-[36px] font-normal leading-[1.12]">Thank you, {firstName(me.name)}. That&apos;s the hardest part.</h2>
            <p className="m-0 mt-3.5 text-[17px] leading-normal text-ink-2">
              We&apos;ve set up a path for {name.split(" ")[0]}&apos;s estate. You&apos;ll only ever see one thing to do at a time.
            </p>
            <Link href="/portal" className={`${primary} mt-auto flex items-center justify-center gap-2.5 no-underline`}>
              See your path <PiArrowRightBold aria-hidden />
            </Link>
            {mode === "demo" && (
            <button type="button" onClick={() => setStep(0)} className="mt-2.5 h-12 border-0 bg-transparent text-[15px] font-semibold text-ink-3">
              Start the demo again
            </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
