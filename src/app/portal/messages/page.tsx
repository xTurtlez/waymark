"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PiArrowBendUpRight, PiFileText, PiInfoFill, PiPaperclip, PiPaperPlaneRightFill, PiSparkleFill } from "react-icons/pi";
import { BottomNav, PortalBrand } from "@/components/portal/PortalShell";
import { Avatar } from "@/components/ui/primitives";
import { CLIENT_SUGGESTIONS, clientAnswer } from "@/lib/assistant";
import { feeEarner, firstName } from "@/lib/selectors";
import { useActions, useClientEstate, useDemo } from "@/lib/store";
import { dayHeading, isoDay, timeLabel } from "@/lib/format";

type Mode = "solicitor" | "ai";

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <Messages />
    </Suspense>
  );
}

function Messages() {
  const params = useSearchParams();
  const state = useDemo();
  const estate = useClientEstate();
  const { sendMessage } = useActions();
  const sol = feeEarner(state, estate);
  const solFirst = firstName(sol.name);
  const [mode, setMode] = useState<Mode>("solicitor");
  // Prefill from "I'm not sure which banks she used" on Today's step.
  const [text, setText] = useState(() =>
    params.get("compose") === "banks"
      ? `I'm not sure which banks ${estate.deceased.firstName === "Margaret" ? "Mum" : estate.deceased.firstName} used. Could you help me find out?`
      : "",
  );
  const qa = (q: string) => {
    const r = clientAnswer(q, state, estate);
    return { q, a: r.paragraphs, handoff: r.handoff };
  };
  const [ai, setAi] = useState<{ q: string; a: string[]; handoff: boolean }[]>(() => [{ ...qa("IHT400"), q: 'What does "IHT400" mean?' }]);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [estate.messages.length, ai.length, mode]);

  function send(e?: React.FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t && !attachment) return;
    if (mode === "solicitor") {
      sendMessage(estate.id, "client", t || "Here's a document.", attachment ?? undefined);
      setSentNote(true);
    } else {
      setAi((list) => [...list, qa(t)]);
    }
    setText("");
    setAttachment(null);
  }

  function ask(q: string) {
    setAi((list) => [...list, qa(q)]);
  }

  function handoff(q: string) {
    setMode("solicitor");
    setText(`${q.replace(/\?$/, "")}, for ${estate.deceased.firstName}'s estate?`);
  }

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-line bg-cream px-5 pb-3 pt-5">
        <PortalBrand className="mb-4" />
        <div role="tablist" aria-label="Who to talk to" className="grid grid-cols-2 gap-1 rounded-[16px] bg-line-soft p-1">
          <button
            role="tab"
            type="button"
            aria-selected={mode === "solicitor"}
            onClick={() => setMode("solicitor")}
            className={`flex h-11 items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold text-ink ${mode === "solicitor" ? "bg-paper" : ""}`}
          >
            <Avatar initials={sol.initials} color="#5B2E57" size={24} />
            {solFirst}
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={mode === "ai"}
            onClick={() => setMode("ai")}
            className={`flex h-11 items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold text-ink ${mode === "ai" ? "bg-paper" : ""}`}
          >
            <PiSparkleFill aria-hidden className="text-plum" /> Ask Waymark
          </button>
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4" aria-live="polite">
        {mode === "solicitor" ? (
          <>
            {estate.messages.map((m, i) => {
              const showDay = i === 0 || isoDay(estate.messages[i - 1].sentAt) !== isoDay(m.sentAt);
              const mine = m.from === "client";
              return (
                <div key={m.id} className="flex flex-col gap-3">
                  {showDay && <div className="text-center text-xs font-semibold text-muted">{dayHeading(m.sentAt)}</div>}
                  <div className={`max-w-[84%] px-4 py-3.5 text-base leading-[1.45] ${mine ? "self-end rounded-[22px_22px_6px_22px] bg-teal text-paper" : "self-start rounded-[22px_22px_22px_6px] border border-line bg-paper"}`}>
                    {m.text}
                    <div className={`mt-1.5 text-xs ${mine ? "text-[#B9D6D0]" : "text-muted"}`}>
                      {mine ? timeLabel(m.sentAt) : `${solFirst} · ${timeLabel(m.sentAt)}`}
                    </div>
                  </div>
                  {m.attachment && (
                    <div className={`flex items-center gap-2.5 rounded-[16px] bg-plum-tint px-3.5 py-2.5 text-sm font-semibold text-plum ${mine ? "self-end" : "self-start"}`}>
                      <PiFileText aria-hidden className="text-xl" /> {m.attachment}
                    </div>
                  )}
                </div>
              );
            })}
            {sentNote && <p className="m-0 text-center text-[13px] text-muted">Sent. {solFirst} usually replies within a working day.</p>}
          </>
        ) : (
          <>
            <div className="flex gap-2.5 rounded-[16px] bg-plum-tint px-3.5 py-3 text-sm leading-[1.45] text-plum-deep">
              <PiInfoFill aria-hidden className="mt-px flex-none text-lg text-plum" />
              <span>
                <b>General guidance, not legal advice.</b> For anything about {estate.deceased.firstName}&apos;s estate specifically, {solFirst} has the final word.
              </span>
            </div>
            {ai.map((t, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="max-w-[80%] self-end rounded-[22px_22px_6px_22px] bg-teal px-4 py-3.5 text-base leading-[1.45] text-paper">{t.q}</div>
                <div className="max-w-[90%] rounded-[22px_22px_22px_6px] border-[1.5px] border-dashed border-plum-line bg-paper p-4 text-base leading-normal">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-plum">
                    <PiSparkleFill aria-hidden /> Waymark assistant
                  </div>
                  {t.a.map((p, j) => (
                    <p key={j} className="m-0 mt-2">
                      {p}
                    </p>
                  ))}
                  <button
                    type="button"
                    onClick={() => handoff(t.q)}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-line-soft text-[15px] font-semibold text-plum hover:bg-line"
                  >
                    <PiArrowBendUpRight aria-hidden /> Ask {solFirst} about {estate.deceased.firstName}&apos;s
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {CLIENT_SUGGESTIONS.filter((s) => !ai.some((t) => t.q === s)).map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border-[1.5px] border-line-strong px-3.5 py-2.5 text-sm font-medium hover:bg-paper">
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        <div ref={endRef} />
      </main>

      <form onSubmit={send} className="sticky bottom-0 z-10 border-t border-line bg-paper px-4 pb-3 pt-3">
        {attachment && (
          <div className="mb-2 flex items-center justify-between rounded-[12px] bg-plum-tint px-3 py-2 text-[13px] font-semibold text-plum">
            <span className="flex items-center gap-1.5">
              <PiPaperclip aria-hidden /> {attachment}
            </span>
            <button type="button" onClick={() => setAttachment(null)} className="text-plum underline">
              Remove
            </button>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          {mode === "solicitor" && (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a file" className="grid size-[46px] flex-none place-items-center rounded-full bg-line-soft text-xl hover:bg-line">
                <PiPaperclip aria-hidden />
              </button>
              <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachment(f.name); e.target.value = ""; }} />
            </>
          )}
          <label htmlFor="composer" className="sr-only">
            {mode === "ai" ? "Ask a question" : `Write to ${solFirst}`}
          </label>
          <input
            id="composer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "ai" ? "Ask anything, in your own words" : `Write to ${solFirst}`}
            className="h-[46px] min-w-0 flex-1 rounded-full border border-line bg-cream px-4 text-base outline-none placeholder:text-muted focus:border-teal focus:outline-2 focus:outline-offset-2 focus:outline-teal"
          />
          <button aria-label="Send" className="grid size-[46px] flex-none place-items-center rounded-full bg-teal text-xl text-white hover:bg-teal-hover">
            <PiPaperPlaneRightFill aria-hidden />
          </button>
        </div>
      </form>
      <BottomNav />
    </>
  );
}
