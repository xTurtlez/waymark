"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PiCaretRight, PiEye } from "react-icons/pi";
import { AssistantPanel, type AiTab } from "@/components/practice/workspace/AssistantPanel";
import { AuditCard, DocumentsCard, IhtCard, LedgerCard, MessagesCard, NotesCard, PartiesCard, TasksCard } from "@/components/practice/workspace/sections";
import { AddAssetSheet } from "@/components/shared/AddAssetSheet";
import { STAGES, segState } from "@/lib/stages";
import { clientParty, feeEarner, firstName } from "@/lib/selectors";
import { useDemo, useEstate } from "@/lib/store";

type Tab = "overview" | "parties" | "assets" | "liabilities" | "documents" | "tasks" | "iht" | "notes" | "audit" | "messages";

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function EstateWorkspace() {
  const params = useSearchParams();
  const id = params.get("id") ?? undefined;
  const state = useDemo();
  const estate = useEstate(id);
  const [addOpen, setAddOpen] = useState(false);

  // Deep links: ?id=<estate>&ai=draft&draft=<id>&tab=<tab>. Re-read whenever the
  // query string changes (adjusting state during render, not in an effect).
  const qs = params.toString();
  const fromQuery = () => {
    const ai = params.get("ai");
    return {
      tab: (params.get("tab") as Tab | null) ?? "overview",
      ai: (ai === "draft" || ai === "extract" || ai === "missing" || ai === "summary" ? ai : "draft") as AiTab,
      draft: params.get("draft") ?? undefined,
    };
  };
  const [tab, setTab] = useState<Tab>(() => fromQuery().tab);
  const [aiTab, setAiTab] = useState<AiTab>(() => fromQuery().ai);
  const [focusDraft, setFocusDraft] = useState<string | undefined>(() => fromQuery().draft);
  const [seenQs, setSeenQs] = useState(qs);
  if (qs !== seenQs) {
    const q = fromQuery();
    setSeenQs(qs);
    setTab(q.tab);
    setAiTab(q.ai);
    setFocusDraft(q.draft);
  }

  if (!estate) {
    return (
      <main className="p-10">
        <p className="text-lg">That estate could not be found.</p>
        <Link href="/practice" className="font-semibold text-teal">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const earner = feeEarner(state, estate);
  const client = clientParty(estate);
  const isPortalEstate = estate.id === state.currentClientEstateId;

  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "parties", label: "Parties", n: estate.parties.length },
    { id: "assets", label: "Assets", n: estate.assets.filter((a) => !a.liability).length },
    { id: "liabilities", label: "Liabilities", n: estate.assets.filter((a) => a.liability).length },
    { id: "documents", label: "Documents", n: estate.documents.filter((d) => d.state !== "needed").length },
    { id: "tasks", label: "Tasks", n: estate.tasks.filter((t) => !t.done).length },
    { id: "iht", label: "IHT" },
    { id: "notes", label: "Notes" },
    { id: "audit", label: "Audit trail" },
    { id: "messages", label: "Messages", n: estate.messages.length },
  ];

  const meta = [
    estate.ref,
    estate.deceased.dateOfDeath ? `Died ${formatDate(estate.deceased.dateOfDeath)}${estate.deceased.placeOfDeath ? `, ${estate.deceased.placeOfDeath}` : ""}` : "Date of death not yet recorded",
    estate.deceased.willDated ? `Will dated ${estate.deceased.willDated}` : null,
    `${estate.daysOpen} days open`,
    `Fee earner ${earner.name}`,
  ].filter(Boolean) as string[];

  return (
    <div className="grid min-h-screen xl:grid-cols-[minmax(0,1fr)_400px]">
      <main className="flex min-w-0 flex-col gap-[22px] px-[clamp(16px,2.5vw,32px)] pb-9 pt-7">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-medium text-muted">
          <Link href="/practice" className="text-muted no-underline hover:text-ink">
            Estates
          </Link>
          <PiCaretRight aria-hidden />
          <span className="text-ink" aria-current="page">
            {estate.deceased.shortName}
          </span>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-[min(100%,360px)] flex-1">
            <h1 className="m-0 font-serif text-[clamp(28px,3vw,36px)] font-normal leading-[1.1] tracking-[-0.015em]">Estate of {estate.deceased.fullName}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-3">
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {estate.attention && <span className="inline-flex items-center rounded-full bg-coral px-3.5 py-2 text-[13px] font-semibold text-white">Needs attention</span>}
            {isPortalEstate && (
              <Link href="/portal" className="inline-flex h-[42px] items-center gap-2 rounded-[12px] border border-line-strong bg-paper px-4 text-sm font-semibold text-ink no-underline hover:bg-cream">
                <PiEye aria-hidden /> View as {firstName(client.name)}
              </Link>
            )}
          </div>
        </header>

        <section aria-label="Stage" className="rounded-[20px] border border-line bg-paper px-[22px] py-[18px]">
          <ol className="m-0 grid list-none grid-cols-7 gap-1.5 p-0">
            {STAGES.map((s, i) => {
              const st = segState(i, estate.stage);
              return (
                <li key={s.long} aria-current={st === "now" ? "step" : undefined}>
                  <div className={`h-2 rounded-full ${st === "done" ? "bg-teal" : st === "now" ? "bg-coral" : "bg-line"}`} />
                  <div className={`mt-2 hidden text-[12.5px] font-semibold leading-[1.3] sm:block ${st === "now" ? "text-coral-ink" : st === "done" ? "text-teal" : "text-muted"}`}>
                    {i + 1}. {s.workspace}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="m-0 mt-2 text-[13px] font-semibold text-coral-ink sm:hidden">
            Stage {estate.stage + 1}: {STAGES[estate.stage].workspace}
          </p>
        </section>

        <nav aria-label="Estate sections" className="-mx-1 overflow-x-auto">
          <div role="tablist" className="flex min-w-max gap-1 border-b border-line px-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px flex items-center gap-1.5 border-b-[2.5px] px-3.5 py-2.5 text-sm font-semibold ${tab === t.id ? "border-teal text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t.label}
                {t.n ? <span className="h-5 min-w-5 rounded-full bg-line-soft px-1.5 text-center text-[11px] font-bold leading-5 text-ink">{t.n}</span> : null}
              </button>
            ))}
          </div>
        </nav>

        {tab === "overview" && (
          <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-[18px]">
              <TasksCard state={state} estate={estate} limit={6} />
              <LedgerCard estate={estate} />
              <AuditCard state={state} estate={estate} limit={5} />
            </div>
            <div className="flex min-w-0 flex-col gap-[18px]">
              <IhtCard estate={estate} />
              <PartiesCard estate={estate} />
              <DocumentsCard estate={estate} />
              <NotesCard state={state} estate={estate} />
            </div>
          </div>
        )}
        {tab === "parties" && <PartiesCard estate={estate} />}
        {tab === "assets" && <LedgerCard estate={estate} filter="assets" title="Assets" onAdd={() => setAddOpen(true)} />}
        {tab === "liabilities" && <LedgerCard estate={estate} filter="liabilities" title="Liabilities" onAdd={() => setAddOpen(true)} />}
        {tab === "documents" && <DocumentsCard estate={estate} full />}
        {tab === "tasks" && <TasksCard state={state} estate={estate} />}
        {tab === "iht" && (
          <div className="grid items-start gap-[18px] lg:grid-cols-2">
            <IhtCard estate={estate} expanded />
            <LedgerCard estate={estate} />
          </div>
        )}
        {tab === "notes" && <NotesCard state={state} estate={estate} full />}
        {tab === "audit" && <AuditCard state={state} estate={estate} />}
        {tab === "messages" && <MessagesCard state={state} estate={estate} />}
      </main>

      <AssistantPanel state={state} estate={estate} initialTab={aiTab} focusDraftId={focusDraft} />

      <AddAssetSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        estateId={estate.id}
        by="firm"
        defaultKind={tab === "liabilities" ? "credit" : "bank"}
        ownerName={estate.deceased.firstName}
        solicitorName={firstName(earner.name)}
      />
    </div>
  );
}
