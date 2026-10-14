"use client";

import Link from "next/link";
import { useState } from "react";
import { PiCheckBold } from "react-icons/pi";
import { PracticePage } from "@/components/practice/PracticeShell";
import { TONE_CHIP } from "@/lib/stages";
import { firstName, partyById, staffById } from "@/lib/selectors";
import { useActions, useDemo } from "@/lib/store";
import { dayLabel, dueInfo } from "@/lib/format";

type Scope = "mine" | "firm" | "family" | "done";

export default function TasksPage() {
  const state = useDemo();
  const { toggleTask } = useActions();
  const [scope, setScope] = useState<Scope>("mine");

  const all = state.estates.flatMap((e) => e.tasks.map((t) => ({ e, t })));
  const pick = {
    mine: all.filter(({ t }) => !t.done && t.owner.kind === "firm" && t.owner.staffId === state.currentStaffId),
    firm: all.filter(({ t }) => !t.done && t.owner.kind !== "family"),
    family: all.filter(({ t }) => !t.done && t.owner.kind === "family"),
    done: all.filter(({ t }) => t.done),
  } satisfies Record<Scope, typeof all>;
  const list = [...pick[scope]].sort((a, b) => {
    if (scope === "done") return (b.t.doneAt ?? "") < (a.t.doneAt ?? "") ? -1 : 1;
    return (a.t.dueOn ?? "9999") < (b.t.dueOn ?? "9999") ? -1 : (a.t.dueOn ?? "9999") > (b.t.dueOn ?? "9999") ? 1 : 0;
  });

  const scopes: { id: Scope; label: string }[] = [
    { id: "mine", label: "Mine" },
    { id: "firm", label: "Whole firm" },
    { id: "family", label: "With families" },
    { id: "done", label: "Done" },
  ];

  return (
    <PracticePage eyebrow="Across every estate" title="Tasks">
      <div role="tablist" aria-label="Task scope" className="flex w-fit flex-wrap gap-1.5 rounded-[16px] bg-line-soft p-[5px]">
        {scopes.map((s) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={scope === s.id}
            onClick={() => setScope(s.id)}
            className={`flex h-10 items-center gap-2 rounded-[12px] px-4 text-sm font-semibold ${scope === s.id ? "bg-paper shadow-[0_1px_3px_rgba(43,33,28,.12)]" : "hover:bg-paper/50"}`}
          >
            {s.label} <span className="font-medium text-muted">{pick[s.id].length}</span>
          </button>
        ))}
      </div>
      <ul className="m-0 list-none overflow-hidden rounded-[22px] border border-line bg-paper p-0">
        {list.map(({ e, t }) => {
          const o = t.owner;
          const chip =
            o.kind === "firm"
              ? { label: firstName(staffById(state, o.staffId)?.name ?? ""), cls: TONE_CHIP.teal }
              : o.kind === "family"
                ? { label: firstName(partyById(e, o.partyId)?.name ?? ""), cls: TONE_CHIP.amber }
                : { label: o.label, cls: TONE_CHIP.plum };
          return (
            <li key={t.id} className="grid grid-cols-[22px_1fr_auto] items-center gap-3 border-t border-line-soft px-5 py-3.5 first:border-t-0 sm:grid-cols-[22px_1fr_auto_auto_64px]">
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                aria-label={t.done ? `Reopen: ${t.title}` : `Mark done: ${t.title}`}
                onClick={() => toggleTask(e.id, t.id)}
                className={`grid size-5 place-items-center rounded-[6px] text-xs text-white ${t.done ? "bg-teal" : "border-[1.5px] border-line-strong bg-white hover:border-teal"}`}
              >
                {t.done && <PiCheckBold aria-hidden />}
              </button>
              <div className="min-w-0">
                <div className={`text-[14.5px] font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</div>
                <Link href={`/practice/estate?id=${e.id}&tab=tasks`} className="text-[12.5px] text-muted no-underline hover:text-teal">
                  {e.deceased.shortName} · {e.ref}
                </Link>
              </div>
              <span className={`hidden whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${chip.cls}`}>{chip.label}</span>
              <span className={`text-right text-[13px] font-medium ${dueInfo(t.dueOn, t.done).overdue ? "text-coral-ink" : "text-muted"}`}>{t.done ? (t.doneAt ? dayLabel(t.doneAt) : "Done") : dueInfo(t.dueOn, t.done).label}</span>
            </li>
          );
        })}
        {list.length === 0 && <li className="p-8 text-center text-muted">Nothing here.</li>}
      </ul>
    </PracticePage>
  );
}
