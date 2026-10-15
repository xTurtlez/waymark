"use client";

import { useMemo, useState } from "react";
import {
  PiArrowSquareOut,
  PiCheckCircleFill,
  PiDownloadSimple,
  PiInfo,
  PiPencilSimple,
  PiPlusBold,
  PiPrinter,
  PiWarningCircle,
} from "react-icons/pi";
import { EmptyNote, SectionCard, btn, input } from "@/components/ui/primitives";
import { DEFAULT_TAX_PROFILE, TAX_CATEGORY_LABEL, ihtFor, taxCategoryOf, type IhtView } from "@/lib/iht";
import { fullDay, stampLabel } from "@/lib/format";
import { staffById } from "@/lib/selectors";
import { useActions } from "@/lib/store";
import type { DemoState, Estate, TaxCategory, TaxProfile } from "@/lib/types";
import { formatBp, formatPounds } from "@/rules/util";
import type { Flag, IhtResult, Line, LineSection } from "@/rules/types";
import { FamilySheet, GiftSheet, HoldingTaxSheet, PriorTransferSheet, ProfileSheet, describeTreatment } from "./IhtSheets";

const SECTION_TITLE: Record<LineSection, string> = {
  estate: "The estate",
  reliefs: "Reliefs",
  exemptions: "Exemptions",
  gifts: "Gifts in the 7 years before death",
  allowances: "Allowances",
  tax: "Tax",
  reporting: "Reporting and payment",
};
const SECTION_ORDER: LineSection[] = ["estate", "reliefs", "exemptions", "gifts", "allowances", "tax", "reporting"];

const ROUTE_LABEL: Record<IhtResult["reporting"]["route"], string> = {
  iht400: "Full account (IHT400)",
  excepted_low_value: "Excepted estate",
  excepted_exempt: "Excepted estate (exempt)",
  iht205: "Excepted estate (IHT205)",
};

/** The engine writes ISO dates; show them the way people read them. */
const readable = (s: string) => s.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => fullDay(d));

function amountText(l: Line): string {
  if (l.amountPence === undefined) return "";
  const v = formatPounds(l.amountPence);
  return l.op === "less" ? `− ${v}` : v;
}

/** CSV of the breakdown, for the file or for checking in a spreadsheet. */
function toCsv(estate: Estate, r: IhtResult): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["Section", "Item", "Amount (£)", "Detail", "Source"]];
  for (const section of SECTION_ORDER) {
    for (const l of r.lines.filter((x) => x.section === section)) {
      const amount = l.amountPence === undefined ? "" : ((l.op === "less" ? -1 : 1) * l.amountPence / 100).toFixed(2);
      rows.push([SECTION_TITLE[section], l.label, amount, l.detail ?? "", l.source?.url ?? ""]);
    }
  }
  rows.push([], ["Points for a solicitor"], ...r.flags.map((f) => [f.level, f.message, "", "", f.source?.url ?? ""]));
  return [`${q(`IHT calculation: estate of ${estate.deceased.fullName} (${estate.ref}), date of death ${r.dateOfDeath}`)}`, ...rows.map((row) => row.map((c) => q(String(c))).join(","))].join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "teal" | "coral" | "amber" | "paper" }) {
  const bg = { teal: "bg-teal-tint text-teal-deep", coral: "bg-coral-tint text-coral-deep", amber: "bg-amber-tint text-amber-ink", paper: "border border-line bg-paper" }[tone];
  const lab = { teal: "text-teal", coral: "text-coral-ink", amber: "text-amber-ink", paper: "text-muted" }[tone];
  return (
    <div className={`rounded-[20px] p-4 ${bg}`}>
      <div className={`text-[13px] font-semibold ${lab}`}>{label}</div>
      <div className="mt-1 font-serif text-[24px] font-medium leading-tight">{value}</div>
      {sub && <div className="mt-1 text-[13px] leading-snug opacity-80">{sub}</div>}
    </div>
  );
}

function Breakdown({ estate, result }: { estate: Estate; result: IhtResult }) {
  return (
    <SectionCard
      title="Calculation"
      action={
        <div className="flex gap-2 print:hidden">
          <button type="button" className={`${btn.secondary} h-9 text-[13px]`} onClick={() => download(`${estate.ref}-iht.csv`, toCsv(estate, result))}>
            <PiDownloadSimple aria-hidden /> CSV
          </button>
          <button type="button" className={`${btn.secondary} h-9 text-[13px]`} onClick={() => window.print()}>
            <PiPrinter aria-hidden /> Print
          </button>
        </div>
      }
    >
      <p className="m-0 mt-1 text-[13px] text-muted">
        Rules for a death on {fullDay(result.dateOfDeath)}. Every figure links to the rule it comes from.
      </p>
      {SECTION_ORDER.map((section) => {
        const ls = result.lines.filter((l) => l.section === section);
        if (!ls.length) return null;
        return (
          <section key={section} aria-label={SECTION_TITLE[section]} className="mt-4">
            <h4 className="m-0 mb-1 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">{SECTION_TITLE[section]}</h4>
            <ul className="m-0 list-none p-0">
              {ls.map((l) => (
                <li key={l.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2 ${l.op === "total" ? "border-t border-line" : "border-t border-line-soft first:border-t-0"}`}>
                  <div className="min-w-0">
                    <div className={`text-[14.5px] ${l.op === "total" ? "font-semibold" : "font-medium"}`}>{readable(l.label)}</div>
                    {l.detail && <div className="mt-0.5 text-[13px] leading-snug text-ink-3">{readable(l.detail)}</div>}
                    {l.source && (
                      <a href={l.source.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-teal no-underline hover:underline print:hidden">
                        {l.source.label} <PiArrowSquareOut aria-hidden />
                      </a>
                    )}
                  </div>
                  <div className={`whitespace-nowrap text-right tabular-nums ${l.op === "total" ? "font-bold" : l.op === "info" ? "text-muted" : "font-semibold"}`}>{amountText(l)}</div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </SectionCard>
  );
}

function WhoPays({ result }: { result: IhtResult }) {
  if (!result.attribution.length) return null;
  return (
    <SectionCard title="Who bears the tax">
      <ul className="m-0 mt-3 list-none p-0 text-sm">
        {result.attribution.map((a) => (
          <li key={`${a.bucket}:${a.refId}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 border-t border-line-soft py-2 first:border-t-0">
            <span className="font-medium">{a.label}</span>
            <span className="text-right text-[13px] tabular-nums text-muted">on {formatPounds(a.chargeablePence)}</span>
            <span className="w-28 text-right font-semibold tabular-nums">{formatPounds(a.taxPence)}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

const FLAG_STYLE: Record<Flag["level"], { badge: string; label: string; icon: typeof PiInfo }> = {
  confirm: { badge: "bg-coral-tint text-coral-ink", label: "Confirm", icon: PiWarningCircle },
  out_of_scope: { badge: "bg-amber-tint text-amber-ink", label: "Not calculated", icon: PiWarningCircle },
  info: { badge: "bg-line-soft text-ink-3", label: "Note", icon: PiInfo },
};

function Flags({ state, estate, result }: { state: DemoState; estate: Estate; result: IhtResult }) {
  const { confirmIhtFlag } = useActions();
  const confirmations = estate.tax?.confirmations ?? {};
  const order = { confirm: 0, out_of_scope: 1, info: 2 } as const;
  const flags = [...result.flags].sort((a, b) => order[a.level] - order[b.level]);
  return (
    <SectionCard title="Points for a solicitor" action={<span className="text-[13px] text-muted">{flags.length ? `${flags.length}` : "None"}</span>}>
      {!flags.length && <EmptyNote>Nothing needs a judgment call on these figures.</EmptyNote>}
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {flags.map((f) => {
          const st = FLAG_STYLE[f.level];
          const c = confirmations[f.code];
          const confirmed = c && c.message === f.message;
          return (
            <li key={f.code} className={`rounded-[16px] border p-3.5 ${confirmed ? "border-teal-line bg-paper" : "border-line bg-cream"}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${confirmed ? "bg-teal-tint text-teal" : st.badge}`}>{confirmed ? "Confirmed" : st.label}</span>
                <p className="m-0 text-[14px] leading-snug">{readable(f.message)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-0.5 text-[12.5px]">
                {f.source && (
                  <a href={f.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal no-underline hover:underline">
                    {f.source.label} <PiArrowSquareOut aria-hidden />
                  </a>
                )}
                {confirmed && (
                  <span className="inline-flex items-center gap-1 font-semibold text-teal">
                    <PiCheckCircleFill aria-hidden /> {staffById(state, c.by)?.name ?? "A solicitor"} · {stampLabel(c.at)}
                  </span>
                )}
                {f.level === "confirm" && !confirmed && (
                  <>
                    {c && <span className="font-semibold text-amber-ink">Changed since it was confirmed</span>}
                    <button type="button" className={`${btn.secondary} ml-auto h-9 text-[13px]`} onClick={() => confirmIhtFlag(estate.id, f.code, f.message)}>
                      <PiCheckCircleFill aria-hidden /> I&apos;ve checked this
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function Profile({ estate, profile, onEdit }: { estate: Estate; profile: TaxProfile; onEdit: () => void }) {
  const rows: [string, string][] = [
    ["Residence", profile.longTermUkResident ? "Long-term UK resident" : "Not a long-term UK resident"],
    ["Predeceased spouse", profile.predeceasedSpouse ? `${profile.predeceasedSpouse.name}${profile.predeceasedSpouse.diedOn ? `, died ${fullDay(profile.predeceasedSpouse.diedOn)}` : ""}` : "None recorded"],
    ["Transferred nil-rate band", formatBp(profile.transferredNrbBp)],
    ["Transferred residence nil-rate band", formatBp(profile.transferredRnrbBp)],
    ["Spouse exemption", profile.spouseExemptionLimited ? "Capped (spouse not UK resident)" : "Unlimited"],
    ["Former home (downsizing)", profile.downsizing ? `${formatPounds(profile.downsizing.formerResidenceValuePence)}, ${fullDay(profile.downsizing.disposedOn)}` : "None"],
    ["Relief allowance from a spouse", profile.reliefAllowanceTransferredPence ? formatPounds(profile.reliefAllowanceTransferredPence) : "None"],
    ["Residue divided", profile.residueBenham ? "Equally after tax (Benham)" : "Before tax (usual basis)"],
    ["36% rate components", profile.mergeCharityComponents ? "Merged by election" : "Tested separately"],
  ];
  return (
    <SectionCard
      title="Allowances and elections"
      action={
        <button type="button" className={`${btn.secondary} h-9 text-[13px] print:hidden`} onClick={onEdit} aria-label={`Edit IHT details for ${estate.deceased.shortName}`}>
          <PiPencilSimple aria-hidden /> Edit
        </button>
      }
    >
      <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className="m-0 text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

function Beneficiaries({ estate }: { estate: Estate }) {
  const { setPartyTaxCategory } = useActions();
  const family = estate.parties.filter((p) => !p.staffId);
  return (
    <SectionCard title="Beneficiaries for IHT">
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {family.map((p) => {
          const derived = taxCategoryOf({ ...p, taxCategory: undefined });
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[14.5px] font-semibold">{p.name}</div>
                <div className="text-[12.5px] text-muted">{p.relationship ?? p.role}</div>
              </div>
              <label className="sr-only" htmlFor={`taxcat-${p.id}`}>
                IHT treatment for {p.name}
              </label>
              <select
                id={`taxcat-${p.id}`}
                className={`${input} h-10 w-auto min-w-[220px] text-sm`}
                value={p.taxCategory ?? ""}
                onChange={(e) => setPartyTaxCategory(estate.id, p.id, (e.target.value || null) as TaxCategory | null)}
              >
                <option value="">From relationship: {TAX_CATEGORY_LABEL[derived.category]}</option>
                {(Object.keys(TAX_CATEGORY_LABEL) as TaxCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {TAX_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      {!family.length && <EmptyNote>No family members recorded.</EmptyNote>}
    </SectionCard>
  );
}

function Holdings({ estate, onEdit }: { estate: Estate; onEdit: (assetId: string) => void }) {
  return (
    <SectionCard title="How each holding is treated">
      <ul className="m-0 mt-3 list-none p-0">
        {estate.assets.map((a) => {
          const chips = describeTreatment(estate, a);
          return (
            <li key={a.id} className="flex items-start gap-3 border-t border-line-soft py-2.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium">{a.clientName ?? a.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${a.liability ? "bg-coral-tint text-coral-ink" : "bg-line-soft text-ink-3"}`}>
                    {a.valuePence === null ? "Not valued" : `${a.liability ? "− " : ""}${formatPounds(a.valuePence)}`}
                  </span>
                  {chips.map((c) => (
                    <span key={c} className="rounded-full bg-teal-tint px-2 py-0.5 text-[12px] font-semibold text-teal">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" className={`${btn.secondary} h-9 shrink-0 px-3 text-[13px] print:hidden`} onClick={() => onEdit(a.id)} aria-label={`Edit IHT treatment of ${a.name}`}>
                <PiPencilSimple aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {!estate.assets.length && <EmptyNote>No holdings recorded yet.</EmptyNote>}
    </SectionCard>
  );
}

function WillGifts({ estate }: { estate: Estate }) {
  const { setWillGiftTax } = useActions();
  const will = estate.will!;
  const assets = estate.assets.filter((a) => !a.liability);
  const nameOf = (id?: string) => estate.parties.find((p) => p.id === id)?.name ?? "No beneficiary recorded";
  return (
    <SectionCard title="The will" action={<span className="text-[13px] text-muted">Dated {fullDay(will.dated)}</span>}>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {will.gifts.map((g) => (
          <li key={g.id} className="rounded-[14px] bg-cream p-3">
            <div className="text-[14.5px] font-semibold">{g.description}</div>
            <div className="text-[12.5px] text-muted">
              {g.kind === "residuary" ? `Residue ${g.shareBp !== undefined ? formatBp(g.shareBp) : ""}` : g.kind === "pecuniary" ? `Legacy${g.amountPence ? ` of ${formatPounds(g.amountPence)}` : ""}` : g.kind === "life_interest" ? "Life interest" : "Specific gift"} to {nameOf(g.beneficiaryPartyId)}
            </div>
            {(g.kind === "specific" || g.kind === "pecuniary") && (
              <div className="mt-2 flex flex-wrap items-center gap-3 print:hidden">
                {g.kind === "specific" && (
                  <>
                    <label className="sr-only" htmlFor={`gift-asset-${g.id}`}>
                      Holding given by {g.description}
                    </label>
                    <select
                      id={`gift-asset-${g.id}`}
                      className={`${input} h-10 w-auto min-w-[200px] bg-paper text-sm`}
                      value={g.assetId ?? ""}
                      onChange={(e) => setWillGiftTax(estate.id, g.id, e.target.value || null, Boolean(g.bearsOwnTax))}
                    >
                      <option value="">Not linked to a holding</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.clientName ?? a.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label className="flex items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" className="size-4 accent-teal" checked={Boolean(g.bearsOwnTax)} onChange={(e) => setWillGiftTax(estate.id, g.id, g.assetId ?? null, e.target.checked)} />
                  Bears its own tax
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Intestacy({ view, profile, onEdit }: { view: IhtView; profile: TaxProfile; onEdit: () => void }) {
  return (
    <SectionCard
      title="No will: intestacy"
      action={
        <button type="button" className={`${btn.secondary} h-9 text-[13px] print:hidden`} onClick={onEdit}>
          <PiPencilSimple aria-hidden /> Family
        </button>
      }
    >
      {!profile.intestacyFamily && <EmptyNote>Record the family to see who inherits under the intestacy rules.</EmptyNote>}
      {view.intestacy && (
        <>
          <p className="m-0 mt-2 text-[13px] text-ink-3">Who inherits the estate after tax, under the rules for England and Wales.</p>
          <ul className="m-0 mt-2 list-none p-0 text-sm">
            {view.intestacy.shares.map((s) => (
              <li key={`${s.name}:${s.relationship}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t border-line-soft py-2 first:border-t-0">
                <span>
                  <span className="font-semibold">{s.name}</span>
                  <span className="block text-[12.5px] text-muted">
                    {s.relationship}
                    {s.basis === "statutory_trusts" ? " · on the statutory trusts" : ""}
                  </span>
                </span>
                <span className="text-right font-semibold tabular-nums">{formatPounds(s.amountPence)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

function Gifts({ estate, profile, result, onAdd }: { estate: Estate; profile: TaxProfile; result: IhtResult | null; onAdd: () => void }) {
  const { voidLifetimeGift } = useActions();
  const gifts = profile.gifts.filter((g) => !g.voided);
  return (
    <SectionCard
      title="Lifetime gifts"
      action={
        <button type="button" className={`${btn.secondary} h-9 text-[13px] print:hidden`} onClick={onAdd}>
          <PiPlusBold aria-hidden /> Add gift
        </button>
      }
    >
      {!gifts.length && <EmptyNote>No gifts recorded. Include gifts in the 7 years before death, and gifts into trust in the 14 years before.</EmptyNote>}
      <ul className="m-0 mt-3 list-none p-0">
        {gifts.map((g) => {
          const r = result?.gifts.find((x) => x.id === g.id);
          return (
            <li key={g.id} className="flex items-start gap-3 border-t border-line-soft py-2.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-medium">{g.description}</div>
                <div className="text-[12.5px] text-muted">
                  {fullDay(g.madeOn)} · {g.form === "trust" ? "into trust" : "outright"} · {formatPounds(g.valuePence)}
                </div>
                {r && (
                  <div className="mt-0.5 text-[12.5px] font-semibold text-ink-3">
                    {r.withinSevenYears ? `Chargeable ${formatPounds(r.chargeablePence)}${r.taxPence ? `, tax ${formatPounds(r.taxPence)}` : ", no tax"}` : r.chargeablePence ? "Over 7 years before death" : "Exempt"}
                  </div>
                )}
              </div>
              <button type="button" className="text-[13px] font-semibold text-muted underline-offset-4 hover:text-coral-ink hover:underline print:hidden" onClick={() => voidLifetimeGift(estate.id, g.id)}>
                Withdraw
              </button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function PriorTransfers({ estate, profile, onAdd }: { estate: Estate; profile: TaxProfile; onAdd: () => void }) {
  const { voidPriorTransfer } = useActions();
  const list = profile.priorTransfers.filter((p) => !p.voided);
  return (
    <SectionCard
      title="Earlier estates"
      action={
        <button type="button" className={`${btn.secondary} h-9 text-[13px] print:hidden`} onClick={onAdd}>
          <PiPlusBold aria-hidden /> Add
        </button>
      }
    >
      {!list.length && <EmptyNote>For quick succession relief: add an estate the deceased inherited from in the 5 years before death that paid IHT.</EmptyNote>}
      <ul className="m-0 mt-3 list-none p-0">
        {list.map((p) => (
          <li key={p.id} className="flex items-start gap-3 border-t border-line-soft py-2.5 first:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-medium">{p.label}</div>
              <div className="text-[12.5px] text-muted">
                {fullDay(p.transferOn)} · inherited {formatPounds(p.netIncreasePence)} · tax paid {formatPounds(p.taxPaidPence)}
              </div>
            </div>
            <button type="button" className="text-[13px] font-semibold text-muted underline-offset-4 hover:text-coral-ink hover:underline print:hidden" onClick={() => voidPriorTransfer(estate.id, p.id)}>
              Withdraw
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Transferable({ result }: { result: IhtResult }) {
  const t = result.transferable;
  return (
    <SectionCard title="For a surviving spouse" tone="teal">
      <p className="m-0 mt-2 text-sm leading-relaxed">
        Unused allowances that a spouse or civil partner&apos;s estate could claim later:
      </p>
      <dl className="m-0 mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">
        <dt>Nil-rate band</dt>
        <dd className="m-0 text-right font-bold">{formatBp(t.nilRateBandBp)}</dd>
        <dt>Residence nil-rate band</dt>
        <dd className="m-0 text-right font-bold">{formatBp(t.residenceNilRateBandBp)}</dd>
        {t.reliefAllowancePence !== null && (
          <>
            <dt>100% relief allowance</dt>
            <dd className="m-0 text-right font-bold">{formatPounds(t.reliefAllowancePence)}</dd>
          </>
        )}
      </dl>
    </SectionCard>
  );
}

export function IhtTab({ state, estate }: { state: DemoState; estate: Estate }) {
  const view = useMemo(() => ihtFor(estate), [estate]);
  const profile = estate.tax ?? DEFAULT_TAX_PROFILE;
  const [sheet, setSheet] = useState<null | { kind: "profile" } | { kind: "gift" } | { kind: "prior" } | { kind: "family" } | { kind: "holding"; assetId: string }>(null);
  const close = () => setSheet(null);
  const r = view.result;
  const open = r ? r.flags.filter((f) => f.level === "confirm" && profile.confirmations[f.code]?.message !== f.message).length : 0;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        {r ? (
          <>
            <Tile
              label="Inheritance Tax"
              value={r.totalTaxPence ? formatPounds(r.totalTaxPence) : "None expected"}
              sub={r.totalTaxPence ? (r.gifts.some((g) => g.taxPence) ? `Estate ${formatPounds(r.estate.taxPence)} + gifts ${formatPounds(r.totalTaxPence - r.estate.taxPence)}` : `${formatBp(r.estate.rateBp)} on ${formatPounds(r.estate.taxablePence)}`) : `Chargeable ${formatPounds(r.estate.chargeablePence)} within the bands`}
              tone={r.totalTaxPence ? "coral" : "teal"}
            />
            <Tile label="Reporting" value={ROUTE_LABEL[r.reporting.route]} sub={r.reporting.schedules.length ? `${r.reporting.schedules.length} schedules: ${r.reporting.schedules.map((s) => s.form).join(", ")}` : "No IHT400 needed"} tone="paper" />
            <Tile label="Payment" value={r.totalTaxPence ? fullDay(r.paymentDueOn) : "Nothing to pay"} sub={r.totalTaxPence ? "Due by the end of the sixth month after death" : undefined} tone="paper" />
            <Tile label="Solicitor checks" value={open ? `${open} to confirm` : "All confirmed"} sub={r.complete ? undefined : "Some of the estate isn't calculated"} tone={open || !r.complete ? "amber" : "teal"} />
          </>
        ) : (
          <Tile label="Inheritance Tax" value="Not calculated yet" sub="See what's needed below" tone="amber" />
        )}
      </div>

      {(view.gaps.length > 0 || view.assumptions.length > 0) && (
        <section aria-label="Before relying on these figures" className="rounded-[20px] border border-amber-line bg-amber-wash px-[22px] py-4">
          <h3 className="m-0 font-serif text-lg font-medium">Before relying on these figures</h3>
          <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-snug text-ink-2">
            {view.gaps.map((g) => (
              <li key={g.message} className={g.blocking ? "font-semibold" : undefined}>
                {g.message}
              </li>
            ))}
            {view.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          {r && <Breakdown estate={estate} result={r} />}
          {r && <WhoPays result={r} />}
          <Holdings estate={estate} onEdit={(assetId) => setSheet({ kind: "holding", assetId })} />
        </div>
        <div className="flex min-w-0 flex-col gap-[18px]">
          {r && <Flags state={state} estate={estate} result={r} />}
          <Profile estate={estate} profile={profile} onEdit={() => setSheet({ kind: "profile" })} />
          {estate.will ? <WillGifts estate={estate} /> : <Intestacy view={view} profile={profile} onEdit={() => setSheet({ kind: "family" })} />}
          <Beneficiaries estate={estate} />
          <Gifts estate={estate} profile={profile} result={r} onAdd={() => setSheet({ kind: "gift" })} />
          <PriorTransfers estate={estate} profile={profile} onAdd={() => setSheet({ kind: "prior" })} />
          {r && <Transferable result={r} />}
        </div>
      </div>

      <ProfileSheet open={sheet?.kind === "profile"} onClose={close} estate={estate} profile={profile} />
      <GiftSheet open={sheet?.kind === "gift"} onClose={close} estate={estate} />
      <PriorTransferSheet open={sheet?.kind === "prior"} onClose={close} estate={estate} />
      <FamilySheet open={sheet?.kind === "family"} onClose={close} estate={estate} profile={profile} />
      <HoldingTaxSheet open={sheet?.kind === "holding"} onClose={close} estate={estate} assetId={sheet?.kind === "holding" ? sheet.assetId : undefined} />
    </div>
  );
}
