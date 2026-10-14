"use client";

import { Fragment, useState } from "react";
import {
  PiArrowRightBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCheckBold,
  PiCheckCircleFill,
  PiCopy,
  PiPaperPlaneRightFill,
  PiPencilSimple,
  PiSparkleFill,
} from "react-icons/pi";
import { btn } from "@/components/ui/primitives";
import { TONE_DOT } from "@/lib/stages";
import { estateSummary } from "@/lib/selectors";
import { firmAnswer } from "@/lib/assistant";
import { useActions } from "@/lib/store";
import type { DemoState, Draft, Estate } from "@/lib/types";
import { uploadedLabel } from "@/lib/format";

export type AiTab = "draft" | "extract" | "missing" | "summary";
const TABS: { id: AiTab; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "extract", label: "Extract" },
  { id: "missing", label: "Missing" },
  { id: "summary", label: "Summary" },
];

const dashedPill = "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-plum px-[11px] py-[5px] text-[12.5px] font-semibold text-plum";

/** Render [[highlighted]] spans in a paragraph. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[[") ? (
          <mark key={i} className="rounded-[4px] bg-amber-tint px-[3px] text-ink" title="Extracted by the assistant from a source document">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function DraftView({ estate, focusId }: { estate: Estate; focusId?: string }) {
  const { approveDraft, editDraft, discardDraft } = useActions();
  const review = estate.drafts.filter((d) => d.status === "review");
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [justSent, setJustSent] = useState<Draft | null>(null);

  // Jump to a draft linked from elsewhere (adjusting state during render, not in an effect).
  const [seenFocus, setSeenFocus] = useState<string | undefined>(undefined);
  if (focusId !== seenFocus) {
    setSeenFocus(focusId);
    const i = focusId ? review.findIndex((x) => x.id === focusId) : -1;
    if (i >= 0) setIdx(i);
  }

  const d = review[Math.min(idx, review.length - 1)];
  const sent = estate.drafts.filter((x) => x.status === "sent");

  if (!d) {
    return (
      <div className="flex flex-col gap-3">
        {justSent ? (
          <div className="flex items-start gap-3 rounded-[16px] bg-teal-tint p-4 text-teal-text">
            <PiCheckCircleFill aria-hidden className="mt-0.5 flex-none text-xl text-teal" />
            <p className="m-0 text-sm leading-normal">
              <b>{justSent.title} sent.</b> Logged in the audit trail
              {justSent.clientUpdate ? " and the family has a plain-English update in their portal." : "."}
            </p>
          </div>
        ) : (
          <p className="m-0 rounded-[16px] border border-plum-border bg-paper p-4 text-sm leading-normal text-plum-deep">
            No drafts waiting for review on this estate. Ask for one below, or use the Missing tab.
          </p>
        )}
        {sent.length > 0 && (
          <div className="text-[13px] text-muted">
            <div className="mb-1.5 font-semibold uppercase tracking-[0.05em] text-plum">Sent from drafts</div>
            {sent.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-1">
                <PiCheckBold aria-hidden className="text-teal" /> {s.title} · to {s.to}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function startEdit() {
    setText(d.body.join("\n\n"));
    setEditing(true);
  }
  function saveEdit() {
    editDraft(estate.id, d.id, text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean));
    setEditing(false);
  }
  function approve() {
    if (editing) saveEdit();
    setJustSent(d);
    approveDraft(estate.id, d.id);
    setIdx(0);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className={dashedPill}>Draft · needs your review</span>
        {review.length > 1 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <button type="button" aria-label="Previous draft" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="grid size-7 place-items-center rounded-full hover:bg-plum-tint disabled:opacity-40">
              <PiCaretLeftBold aria-hidden />
            </button>
            {idx + 1} of {review.length} drafts
            <button type="button" aria-label="Next draft" disabled={idx >= review.length - 1} onClick={() => setIdx((i) => i + 1)} className="grid size-7 place-items-center rounded-full hover:bg-plum-tint disabled:opacity-40">
              <PiCaretRightBold aria-hidden />
            </button>
          </span>
        )}
      </div>
      <article className="rounded-[18px] border border-plum-border bg-paper p-[18px] text-sm leading-[1.55] text-ink" aria-label={`Draft: ${d.title}`}>
        <div className="text-[13px] font-semibold text-muted">
          To: {d.to} · Re: {d.re}
        </div>
        {editing ? (
          <>
            <label htmlFor={`edit-${d.id}`} className="sr-only">
              Edit letter
            </label>
            <textarea
              id={`edit-${d.id}`}
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\[\[|\]\]/g, ""))}
              rows={10}
              className="mt-3 w-full resize-y rounded-[12px] border-[1.5px] border-plum-line bg-cream p-3 text-sm leading-[1.55] focus:outline-2 focus:outline-offset-2 focus:outline-plum"
            />
          </>
        ) : (
          d.body.map((p, i) => (
            <p key={i} className={`m-0 ${i === 0 ? "mt-3" : "mt-2"}`}>
              <Highlighted text={p} />
            </p>
          ))
        )}
        <p className="m-0 mt-2 whitespace-pre-line">{d.signOff}</p>
      </article>
      <div className="text-[12.5px] leading-[1.45] text-plum">
        <b>Sources:</b> {d.sources}
      </div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        {editing ? (
          <button type="button" onClick={saveEdit} className={`${btn.plumOutline} h-11 text-sm`}>
            <PiCheckBold aria-hidden /> Save edits
          </button>
        ) : (
          <button type="button" onClick={startEdit} className={`${btn.plumOutline} h-11 text-sm`}>
            <PiPencilSimple aria-hidden /> Edit
          </button>
        )}
        <button type="button" onClick={approve} className={`${btn.primary} h-11 text-sm`}>
          <PiCheckBold aria-hidden /> Approve &amp; send
        </button>
      </div>
      <button type="button" onClick={() => discardDraft(estate.id, d.id)} className="self-center text-[13px] font-semibold text-muted underline-offset-4 hover:text-coral-ink hover:underline">
        Discard draft
      </button>
    </div>
  );
}

/** "Photo from Sarah · yesterday 21:05" from the document's upload record. */
function provenance(estate: Estate, documentId: string): string {
  const doc = estate.documents.find((d) => d.id === documentId);
  if (!doc?.uploadedAt) return "Uploaded document";
  const who = estate.parties.find((p) => p.id === doc.uploadedBy);
  const kind = /\.(jpe?g|png|heic|webp)$/i.test(doc.fileName ?? "") ? "Photo" : "File";
  return `${kind} from ${who ? who.name.split(" ")[0] : "the family"} · ${uploadedLabel(doc.uploadedAt)}`;
}

function ExtractView({ estate }: { estate: Estate }) {
  const { acceptExtraction } = useActions();
  const x = estate.extractions.find((e) => e.status === "review");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const accepted = estate.extractions.filter((e) => e.status === "accepted");

  if (!x) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 rounded-[16px] border border-plum-border bg-paper p-4 text-sm leading-normal text-plum-deep">
          Nothing new to read. When the family uploads a statement or letter, the assistant pulls out the key fields here for you to check.
        </p>
        {accepted.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-[13px] text-muted">
            <PiCheckBold aria-hidden className="text-teal" /> {a.fileName} reviewed and added to assets
          </div>
        ))}
      </div>
    );
  }
  const needsCheck = x.fields.filter((f) => f.confidence === "check");
  const ready = needsCheck.every((f) => checked[f.key]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-[16px] border border-plum-border bg-paper p-3">
        <div className="scan-warm h-16 w-[52px] flex-none rounded-[8px]" aria-hidden />
        <div>
          <div className="text-sm font-semibold">{x.fileName}</div>
          <div className="text-[12.5px] text-muted">{provenance(estate, x.documentId)}</div>
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.05em] text-plum">Extracted fields · check each</div>
      {x.fields.map((f) => {
        const high = f.confidence === "high";
        return (
          <div key={f.key} className={`flex items-center justify-between gap-2.5 rounded-[12px] border bg-paper px-3 py-2.5 ${high ? "border-plum-border" : "border-amber-line"}`}>
            <div>
              <div className="text-xs text-muted">{f.key}</div>
              <div className="text-[14.5px] font-semibold">{f.value}</div>
            </div>
            {f.confidence === "check" ? (
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold text-amber-ink">
                <input type="checkbox" className="size-4 accent-teal" checked={!!checked[f.key]} onChange={(e) => setChecked((c) => ({ ...c, [f.key]: e.target.checked }))} />
                {checked[f.key] ? "Checked" : f.note ?? "Check"}
              </label>
            ) : (
              <span className={`whitespace-nowrap text-[11.5px] font-semibold ${high ? "text-teal" : "text-amber-ink"}`}>{high ? "High" : "Medium"}</span>
            )}
          </div>
        );
      })}
      <button type="button" disabled={!ready} onClick={() => acceptExtraction(estate.id, x.id)} className={`${btn.primary} h-11 text-sm`}>
        Review &amp; add to assets
      </button>
      {!ready && <p className="m-0 text-center text-xs text-muted">Tick the flagged field once you&apos;ve compared it with the image.</p>}
    </div>
  );
}

function MissingView({ estate }: { estate: Estate }) {
  const { resolveMissing } = useActions();
  if (estate.missing.length === 0) {
    return <p className="m-0 rounded-[16px] border border-plum-border bg-paper p-4 text-sm text-plum-deep">No gaps found against the will, bank letters and HMRC requirements.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-sm leading-normal text-plum-deep">Compared against the will, bank letters and HMRC requirements:</p>
      {estate.missing.map((m) => (
        <div key={m.id} className={`rounded-[16px] border border-plum-border bg-paper p-3.5 ${m.resolved ? "opacity-70" : ""}`}>
          <div className="flex items-center gap-2 text-[14.5px] font-semibold">
            <span className={`size-2 rounded-full ${m.resolved ? "bg-teal" : TONE_DOT[m.tone]}`} />
            {m.title}
          </div>
          <div className="mt-1 text-[13.5px] leading-[1.45] text-ink-3">{m.body}</div>
          {m.resolved ? (
            <div className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-teal">
              <PiCheckBold aria-hidden /> {m.actionKind === "draft-aviva" ? "Draft ready in the Draft tab" : "Done · logged in audit trail"}
            </div>
          ) : (
            <button type="button" onClick={() => resolveMissing(estate.id, m.id)} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal hover:text-teal-hover">
              {m.action} <PiArrowRightBold aria-hidden />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryView({ state, estate }: { state: DemoState; estate: Estate }) {
  const { addNote } = useActions();
  const [copied, setCopied] = useState(false);
  const parts = estateSummary(state, estate);
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-plum-border bg-paper p-[18px] text-[14.5px] leading-[1.6]">
      <span className={`${dashedPill} self-start`}>Generated summary · verify before sharing</span>
      {parts.map((p, i) => (
        <p key={i} className="m-0">
          {p.label && <b>{p.label}: </b>}
          {p.text}
        </p>
      ))}
      <button
        type="button"
        disabled={copied}
        onClick={() => {
          addNote(estate.id, `Assistant summary (verified): ${parts.map((p) => (p.label ? `${p.label}: ${p.text}` : p.text)).join(" ")}`);
          setCopied(true);
        }}
        className={`${btn.plumOutline} h-[42px] text-sm disabled:opacity-70`}
      >
        {copied ? (
          <>
            <PiCheckBold aria-hidden /> Added to file notes
          </>
        ) : (
          <>
            <PiCopy aria-hidden /> Copy to file note
          </>
        )}
      </button>
    </div>
  );
}

export function AssistantPanel({ state, estate, initialTab = "draft", focusDraftId }: { state: DemoState; estate: Estate; initialTab?: AiTab; focusDraftId?: string }) {
  const [tab, setTab] = useState<AiTab>(initialTab);
  const [q, setQ] = useState("");
  const [thread, setThread] = useState<{ q: string; a: string[] }[]>([]);

  // Follow the tab requested by a deep link.
  const [seenInitial, setSeenInitial] = useState(initialTab);
  if (initialTab !== seenInitial) {
    setSeenInitial(initialTab);
    setTab(initialTab);
  }

  // Jump to the Draft tab when a new draft appears (e.g. from the Missing tab).
  const reviewCount = estate.drafts.filter((d) => d.status === "review").length;
  const [prevCount, setPrevCount] = useState(reviewCount);
  if (reviewCount !== prevCount) {
    setPrevCount(reviewCount);
    if (reviewCount > prevCount) setTab("draft");
  }

  const counts: Partial<Record<AiTab, number>> = {
    draft: reviewCount,
    extract: estate.extractions.filter((x) => x.status === "review").length,
    missing: estate.missing.filter((m) => !m.resolved).length,
  };

  return (
    <aside aria-label="Assistant" className="flex flex-col gap-4 border-t border-plum-border bg-plum-wash px-[22px] pb-7 pt-6 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto xl:border-l xl:border-t-0">
      <div className="flex items-center justify-between">
        <h2 className="m-0 flex items-center gap-2 font-serif text-[22px] font-medium text-plum-deep">
          <PiSparkleFill aria-hidden className="text-xl text-plum" />
          Assistant
        </h2>
        <span className="text-xs font-semibold text-plum">{estate.deceased.shortName.split(" ").at(-1)} estate</span>
      </div>
      <div role="tablist" aria-label="Assistant tools" className="grid grid-cols-4 gap-1 rounded-[14px] bg-plum-tint p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative h-[38px] rounded-[10px] text-[13px] font-semibold text-plum-deep ${tab === t.id ? "bg-paper" : "hover:bg-paper/50"}`}
          >
            {t.label}
            {counts[t.id] ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-coral" aria-label={`${counts[t.id]} waiting`} /> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "draft" && <DraftView key={estate.id} estate={estate} focusId={focusDraftId} />}
        {tab === "extract" && <ExtractView estate={estate} />}
        {tab === "missing" && <MissingView estate={estate} />}
        {tab === "summary" && <SummaryView state={state} estate={estate} />}
      </div>

      {thread.length > 0 && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {thread.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="self-end rounded-[16px] rounded-br-[6px] bg-plum px-3.5 py-2.5 text-sm text-cream">{t.q}</div>
              <div className="rounded-[16px] rounded-bl-[6px] border-[1.5px] border-dashed border-plum-line bg-paper px-3.5 py-3 text-sm leading-normal">
                {t.a.map((p, j) => (
                  <p key={j} className={`m-0 ${j ? "mt-1.5" : ""}`}>
                    {p}
                  </p>
                ))}
                <div className="mt-2 text-[11.5px] font-semibold text-plum">Generated from the estate record · verify before relying on it</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          setThread((t) => [...t, { q: q.trim(), a: firmAnswer(q, state, estate) }]);
          setQ("");
        }}
        className="mt-auto flex h-12 items-center gap-2 rounded-[14px] border border-plum-border bg-paper pl-3.5 pr-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-plum"
      >
        <label htmlFor="ask-estate" className="sr-only">
          Ask about this estate
        </label>
        <input id="ask-estate" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this estate…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
        <button aria-label="Ask" className="grid size-9 flex-none place-items-center rounded-[10px] bg-plum text-white hover:bg-plum-deep">
          <PiPaperPlaneRightFill aria-hidden />
        </button>
      </form>
    </aside>
  );
}
