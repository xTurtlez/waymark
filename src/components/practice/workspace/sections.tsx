"use client";

import { useState } from "react";
import { PiCheckBold, PiPaperclip, PiPaperPlaneRightFill, PiPlusBold } from "react-icons/pi";
import { ASSET_ICON, ASSET_STATE_TONE, DOC_FIRM, DOC_ICON } from "@/components/shared/assetMeta";
import { Avatar, EmptyNote, SectionCard, btn, input } from "@/components/ui/primitives";
import { TONE_CHIP } from "@/lib/stages";
import { actor, ihtPosition, partyById, staffById, firstName } from "@/lib/selectors";
import { useActions } from "@/lib/store";
import { money, signedMoney } from "@/lib/format";
import type { DemoState, Estate, Task, TaskOwner } from "@/lib/types";

/* ───────────── Tasks ───────────── */

function ownerChip(state: DemoState, estate: Estate, t: Task): { label: string; cls: string } {
  if (t.done) return { label: "Done", cls: "bg-line-soft text-muted" };
  const o = t.owner;
  if (o.kind === "firm") return { label: firstName(staffById(state, o.staffId)?.name ?? "Firm"), cls: TONE_CHIP.teal };
  if (o.kind === "family") return { label: firstName(partyById(estate, o.partyId)?.name ?? "Family"), cls: TONE_CHIP.amber };
  return { label: o.label, cls: TONE_CHIP.plum };
}

export function TasksCard({ state, estate, limit }: { state: DemoState; estate: Estate; limit?: number }) {
  const { toggleTask, addTask } = useActions();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("me");
  const sorted = [...estate.tasks].sort((a, b) => Number(a.done) - Number(b.done));
  const list = limit ? sorted.slice(0, limit) : sorted;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    let o: TaskOwner = { kind: "firm", staffId: state.currentStaffId };
    if (owner === "client") o = { kind: "family", partyId: estate.clientPartyId };
    else if (owner.startsWith("s_")) o = { kind: "firm", staffId: owner };
    addTask(estate.id, title.trim(), o);
    setTitle("");
    setAdding(false);
  }

  return (
    <SectionCard
      title="Tasks"
      action={
        <button type="button" onClick={() => setAdding((v) => !v)} className="text-[13px] font-semibold text-teal hover:text-teal-hover">
          {adding ? "Cancel" : "+ Add task"}
        </button>
      }
    >
      {adding && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="new-task">
            Task
          </label>
          <input id="new-task" autoFocus className={`${input} h-11 min-w-[200px] flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
          <select aria-label="Assign to" className={`${input} h-11 w-auto`} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="me">Me</option>
            {state.staff
              .filter((s) => s.id !== state.currentStaffId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            <option value="client">{partyById(estate, estate.clientPartyId)?.name} (family)</option>
          </select>
          <button className={`${btn.primary} h-11 text-sm`}>Add</button>
        </form>
      )}
      <ul className="m-0 mt-3 flex list-none flex-col p-0">
        {list.map((t) => {
          const chip = ownerChip(state, estate, t);
          return (
            <li key={t.id} className="grid grid-cols-[22px_1fr_auto_auto] items-center gap-3 border-t border-line-soft py-[11px]">
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                aria-label={t.done ? `Reopen: ${t.title}` : `Mark done: ${t.title}`}
                onClick={() => toggleTask(estate.id, t.id)}
                className={`grid size-5 place-items-center rounded-[6px] text-xs text-white ${t.done ? "bg-teal" : "border-[1.5px] border-line-strong bg-white hover:border-teal"}`}
              >
                {t.done && <PiCheckBold aria-hidden />}
              </button>
              <span className={`text-[14.5px] font-medium ${t.done ? "text-muted line-through decoration-line-strong" : "text-ink"}`}>{t.title}</span>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
              <span className={`w-14 text-right text-[13px] font-medium ${t.overdue && !t.done ? "text-coral-ink" : "text-muted"}`}>{t.done ? t.doneOn ?? "" : t.due}</span>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <EmptyNote>No tasks yet.</EmptyNote>}
    </SectionCard>
  );
}

/* ───────────── Assets & liabilities ───────────── */

export function LedgerCard({
  estate,
  filter = "all",
  title = "Assets & liabilities",
  onAdd,
}: {
  estate: Estate;
  filter?: "all" | "assets" | "liabilities";
  title?: string;
  onAdd?: () => void;
}) {
  const rows = estate.assets.filter((a) => (filter === "all" ? true : filter === "assets" ? !a.liability : a.liability));
  return (
    <SectionCard
      title={title}
      action={
        onAdd ? (
          <button type="button" onClick={onAdd} className="text-[13px] font-semibold text-teal hover:text-teal-hover">
            + Add
          </button>
        ) : (
          <span className="text-[13px] text-muted">Values at date of death</span>
        )
      }
    >
      <div className="mt-2.5 overflow-x-auto text-sm">
        <div role="table" aria-label={title} className="min-w-[400px]">
          <div role="row" className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_84px] gap-2.5 py-2 text-[12.5px] font-semibold text-muted">
            <span role="columnheader">Item</span>
            <span role="columnheader">Institution</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className="text-right">
              Value
            </span>
          </div>
          {rows.map((a) => {
            const Icon = ASSET_ICON[a.kind];
            return (
              <div role="row" key={a.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_84px] items-center gap-2.5 border-t border-line-soft py-2.5">
                <span role="cell" className="flex min-w-0 items-center gap-2.5 font-medium">
                  <Icon aria-hidden className={`flex-none text-lg ${a.liability ? "text-coral-ink" : "text-teal"}`} />
                  <span className="min-w-0">{a.name}</span>
                </span>
                <span role="cell" className="min-w-0 text-ink-3">
                  {a.institution}
                </span>
                <span role="cell" className="min-w-0">
                  <span className={`inline-block max-w-full truncate rounded-full px-[9px] py-[3px] align-middle text-xs font-semibold ${TONE_CHIP[ASSET_STATE_TONE[a.state]]}`}>{a.firmStatus}</span>
                </span>
                <span role="cell" className={`text-right font-semibold tabular-nums ${a.liability ? "text-coral-ink" : "text-ink"}`}>
                  {signedMoney(a.valuePence, a.liability)}
                </span>
              </div>
            );
          })}
        </div>
        {rows.length === 0 && <EmptyNote>Nothing recorded yet.</EmptyNote>}
      </div>
    </SectionCard>
  );
}

/* ───────────── Audit trail ───────────── */

export function AuditCard({ state, estate, limit }: { state: DemoState; estate: Estate; limit?: number }) {
  const list = limit ? estate.audit.slice(0, limit) : estate.audit;
  return (
    <SectionCard title="Audit trail" action={<span className="text-[13px] text-muted">Immutable · {estate.audit.length} entries</span>}>
      <ol className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0 text-[13.5px] leading-[1.4]">
        {list.map((a) => {
          const who = actor(state, estate, a.actor);
          return (
            <li key={a.id} className="grid grid-cols-[96px_28px_1fr] items-start gap-2.5 sm:grid-cols-[110px_28px_1fr]">
              <span className="pt-[3px] font-mono text-[12.5px] text-muted">{a.at}</span>
              <span title={who.name}>
                <Avatar initials={who.initials} color={who.color} size={24} />
              </span>
              <span>{a.text}</span>
            </li>
          );
        })}
      </ol>
      {list.length === 0 && <EmptyNote>No activity yet.</EmptyNote>}
    </SectionCard>
  );
}

/* ───────────── IHT ───────────── */

export function IhtCard({ estate, expanded }: { estate: Estate; expanded?: boolean }) {
  const iht = ihtPosition(estate);
  const over = iht.headroom < 0;
  return (
    <SectionCard title="IHT position" tone="teal" action={<span className="rounded-full bg-paper px-[9px] py-[3px] text-xs font-semibold text-teal">Estimate</span>}>
      <dl className="m-0 mt-3.5 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt>Gross estate</dt>
          <dd className="m-0 font-bold">{money(iht.gross)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Debts &amp; funeral</dt>
          <dd className="m-0 font-bold">− {money(iht.debts)}</dd>
        </div>
        <div className="flex justify-between border-t border-teal/20 pt-2">
          <dt>Net estate</dt>
          <dd className="m-0 font-bold">{money(iht.net)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{iht.hasHome ? "Nil-rate band + RNRB" : "Nil-rate band"}</dt>
          <dd className="m-0 font-bold">{money(iht.allowance)}</dd>
        </div>
      </dl>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70" role="img" aria-label={`Net estate is ${iht.pct}% of the available allowance`}>
        <div className={`h-full rounded-full ${over ? "bg-coral" : "bg-teal"}`} style={{ width: `${iht.pct}%` }} />
      </div>
      <p className="m-0 mt-2.5 text-sm leading-[1.45]">
        {over ? (
          <>
            Estimated IHT <b>{money(iht.taxDue)}</b> at 40% on {money(-iht.headroom)} over the threshold.
          </>
        ) : (
          <>No IHT expected. Headroom {money(iht.headroom)}.</>
        )}{" "}
        {iht.hasHome && `RNRB depends on home passing to ${firstName(partyById(estate, estate.clientPartyId)?.name ?? "a direct descendant")}; confirm with the will.`}
      </p>
      {expanded && (
        <div className="mt-4 rounded-[14px] bg-paper/70 p-4 text-sm leading-relaxed text-teal-text">
          <p className="m-0">
            Thresholds used: nil-rate band £325,000{iht.hasHome ? ", residence nil-rate band £175,000" : ""}. Transferable allowances from a late spouse, lifetime gifts in the last 7 years, and reliefs (BPR/APR) are not yet included.
          </p>
          <p className="m-0 mt-2">Values marked estimate or TBC are included at their current figure. Pensions shown as TBC are excluded.</p>
        </div>
      )}
    </SectionCard>
  );
}

/* ───────────── Parties ───────────── */

const ROLE_LABEL = { executor: "Executor", beneficiary: "Beneficiary", solicitor: "Solicitor", paralegal: "Paralegal" } as const;

export function PartiesCard({ estate }: { estate: Estate }) {
  return (
    <SectionCard title="Parties">
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {estate.parties.map((p) => {
          const open = estate.tasks.filter((t) => !t.done && t.owner.kind === "family" && t.owner.partyId === p.id).length;
          const status = open ? `${open} item${open > 1 ? "s" : ""} open` : p.portalStatus === "invited" ? "Invited" : "";
          return (
            <li key={p.id} className="flex items-center gap-3">
              <Avatar initials={p.initials} color={p.color} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold">{p.name}</div>
                <div className="text-[13px] text-muted">
                  {ROLE_LABEL[p.role]}
                  {p.relationship ? ` · ${p.relationship}` : ""}
                  {p.detail ? `${p.relationship ? ", " : " · "}${p.detail}` : ""}
                </div>
              </div>
              {status && <span className={`text-xs font-semibold ${open ? "text-amber-ink" : "text-muted"}`}>{status}</span>}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

/* ───────────── Documents ───────────── */

export function DocumentsCard({ estate, full }: { estate: Estate; full?: boolean }) {
  const { markDocChecked } = useActions();
  const order = { checking: 0, needed: 1, accepted: 2, held: 3 } as const;
  const docs = full ? [...estate.documents].sort((a, b) => order[a.state] - order[b.state]) : estate.documents.filter((d) => d.state !== "accepted" || d.copies).slice(0, 4);
  const files = estate.documents.filter((d) => d.state !== "needed").reduce((n, d) => n + (d.copies ?? 1), 0);
  return (
    <SectionCard title="Documents" action={<span className="text-[13px] text-muted">{files} files</span>}>
      <div className={`mt-3 grid gap-2 ${full ? "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]" : "grid-cols-2"}`}>
        {docs.map((d) => {
          const st = DOC_FIRM[d.state];
          const Icon = DOC_ICON[d.icon];
          return (
            <div key={d.id} className={`rounded-[14px] px-3 py-2.5 text-[13.5px] ${st.tile}`}>
              <div className="flex items-start gap-2">
                {full && <Icon aria-hidden className="mt-0.5 flex-none text-base text-ink-3" />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {d.name}
                    {d.copies ? ` ×${d.copies}` : ""}
                  </div>
                  <div className={`mt-0.5 text-xs font-semibold ${st.text}`}>{st.label}</div>
                  {full && d.uploadedAt && <div className="mt-1 text-xs text-muted">Added {d.uploadedAt}{d.fileName ? ` · ${d.fileName}` : ""}</div>}
                </div>
              </div>
              {full && d.state === "checking" && (
                <button type="button" onClick={() => markDocChecked(estate.id, d.id)} className={`${btn.primary} mt-2.5 h-9 w-full text-[13px]`}>
                  <PiCheckBold aria-hidden /> Mark checked
                </button>
              )}
            </div>
          );
        })}
      </div>
      {docs.length === 0 && <EmptyNote>No documents yet.</EmptyNote>}
    </SectionCard>
  );
}

/* ───────────── Notes ───────────── */

export function NotesCard({ state, estate, full }: { state: DemoState; estate: Estate; full?: boolean }) {
  const { addNote } = useActions();
  const [text, setText] = useState("");
  const list = full ? estate.notes : estate.notes.slice(0, 1);
  return (
    <SectionCard title="Notes" tone="amber">
      {list.map((n) => (
        <p key={n.id} className="m-0 mt-2.5 text-sm leading-normal text-ink-2">
          {n.text} — {staffById(state, n.author)?.initials}, {n.at}
        </p>
      ))}
      {list.length === 0 && <p className="m-0 mt-2.5 text-sm text-muted">No notes yet.</p>}
      {full && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addNote(estate.id, text.trim());
            setText("");
          }}
          className="mt-4 flex flex-col gap-2"
        >
          <label htmlFor="note" className="sr-only">
            New note
          </label>
          <textarea id="note" rows={3} className={`${input} h-auto py-3`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a file note" />
          <button className={`${btn.primary} h-11 self-start text-sm`}>
            <PiPlusBold aria-hidden /> Add note
          </button>
        </form>
      )}
    </SectionCard>
  );
}

/* ───────────── Messages (firm side) ───────────── */

export function MessagesCard({ state, estate }: { state: DemoState; estate: Estate }) {
  const { sendMessage } = useActions();
  const [text, setText] = useState("");
  const client = partyById(estate, estate.clientPartyId);
  let lastDay = "";
  return (
    <SectionCard title={`Messages with ${client?.name ?? "the family"}`} action={<span className="text-[13px] text-muted">Shown in their portal</span>}>
      <div className="mt-4 flex flex-col gap-3">
        {estate.messages.map((m) => {
          const showDay = m.day !== lastDay;
          lastDay = m.day;
          const mine = m.from === "firm";
          const who = actor(state, estate, m.authorId);
          return (
            <div key={m.id} className="flex flex-col gap-2">
              {showDay && <div className="text-center text-xs font-semibold text-muted">{m.day}</div>}
              <div className={`max-w-[80%] rounded-[18px] px-4 py-3 text-[15px] leading-[1.45] ${mine ? "self-end rounded-br-[6px] bg-teal text-paper" : "self-start rounded-bl-[6px] border border-line bg-cream"}`}>
                {m.text}
                {m.attachment && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-semibold ${mine ? "bg-white/15" : "bg-plum-tint text-plum"}`}>
                    <PiPaperclip aria-hidden /> {m.attachment}
                  </div>
                )}
                <div className={`mt-1.5 text-xs ${mine ? "text-[#B9D6D0]" : "text-muted"}`}>
                  {firstName(who.name)} · {m.at}
                </div>
              </div>
            </div>
          );
        })}
        {estate.messages.length === 0 && <EmptyNote>No messages yet.</EmptyNote>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          sendMessage(estate.id, "firm", text.trim());
          setText("");
        }}
        className="mt-4 flex gap-2"
      >
        <label htmlFor="firm-msg" className="sr-only">
          Message
        </label>
        <input id="firm-msg" className={`${input} h-12`} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Write to ${client ? firstName(client.name) : "the family"}`} />
        <button aria-label="Send" className="grid size-12 flex-none place-items-center rounded-[14px] bg-teal text-xl text-white hover:bg-teal-hover">
          <PiPaperPlaneRightFill aria-hidden />
        </button>
      </form>
    </SectionCard>
  );
}
