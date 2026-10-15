"use client";

import { useState, type ReactNode } from "react";
import { PiPlusBold, PiTrash } from "react-icons/pi";
import { Field, Sheet } from "@/components/ui/Sheet";
import { btn, input } from "@/components/ui/primitives";
import { TAX_CATEGORY_LABEL, isChattels, taxCategoryOf } from "@/lib/iht";
import { parseMoney } from "@/lib/format";
import { useActions } from "@/lib/store";
import type { Asset, AssetTax, Estate, IntestacyFamilyRecord, IntestacyPerson, LifetimeGiftRecord, TaxCategory, TaxProfile } from "@/lib/types";
import { formatPounds, isValidDate } from "@/rules/util";

/**
 * Forms behind the IHT tab. Each sheet mounts its form only while open, so the
 * form starts from the current record every time it's opened.
 */

const select = `${input} pr-10`;
const check = "size-5 flex-none accent-teal";

function pctToBp(s: string): number | null {
  const t = s.trim().replace(/%$/, "");
  if (!t) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp <= 10000 ? bp : null;
}
const bpToPct = (bp: number) => (bp % 100 === 0 ? String(bp / 100) : (bp / 100).toFixed(2));
const penceToInput = (p?: number | null) => (p === undefined || p === null ? "" : (p / 100).toFixed(p % 100 ? 2 : 0));

function Check({ checked, onChange, children, hint }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; hint?: string }) {
  return (
    <label className="flex items-start gap-3 text-[15px]">
      <input type="checkbox" className={`${check} mt-0.5`} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-semibold">{children}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Actions({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <button type="submit" className={btn.primaryLg}>
        {label}
      </button>
      <button type="button" className="h-11 text-[15px] font-semibold text-teal" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

// ── Allowances and elections ────────────────────────────────────────────────

export function ProfileSheet({ open, onClose, estate, profile }: { open: boolean; onClose: () => void; estate: Estate; profile: TaxProfile }) {
  return (
    <Sheet open={open} onClose={onClose} title="Allowances and elections" wide>
      <ProfileForm estate={estate} profile={profile} onDone={onClose} />
    </Sheet>
  );
}

function ProfileForm({ estate, profile, onDone }: { estate: Estate; profile: TaxProfile; onDone: () => void }) {
  const { updateTaxProfile } = useActions();
  const [resident, setResident] = useState(profile.longTermUkResident);
  const [capped, setCapped] = useState(profile.spouseExemptionLimited);
  const [spouseName, setSpouseName] = useState(profile.predeceasedSpouse?.name ?? "");
  const [spouseDied, setSpouseDied] = useState(profile.predeceasedSpouse?.diedOn ?? "");
  const [nrb, setNrb] = useState(bpToPct(profile.transferredNrbBp));
  const [rnrb, setRnrb] = useState(bpToPct(profile.transferredRnrbBp));
  const [downOn, setDownOn] = useState(profile.downsizing?.disposedOn ?? "");
  const [downValue, setDownValue] = useState(penceToInput(profile.downsizing?.formerResidenceValuePence));
  const [relief, setRelief] = useState(penceToInput(profile.reliefAllowanceTransferredPence));
  const [benham, setBenham] = useState(profile.residueBenham);
  const [merge, setMerge] = useState(profile.mergeCharityComponents);
  const [tried, setTried] = useState(false);

  const dod = estate.deceased.dateOfDeath;
  const nrbBp = pctToBp(nrb);
  const rnrbBp = pctToBp(rnrb);
  const downValuePence = downValue.trim() ? parseMoney(downValue) : null;
  const reliefPence = relief.trim() ? parseMoney(relief) : null;
  const errors = {
    nrb: nrbBp === null ? "Enter a percentage from 0 to 100" : "",
    rnrb: rnrbBp === null ? "Enter a percentage from 0 to 100" : "",
    spouseDied: spouseDied && (!isValidDate(spouseDied) || (dod && spouseDied > dod)) ? "Enter a date before this death" : "",
    spouseName: !spouseName.trim() && (spouseDied || (nrbBp ?? 0) > 0 || (rnrbBp ?? 0) > 0) ? "Name the spouse whose allowances are transferred" : "",
    downOn: (downOn || downValue.trim()) && (!isValidDate(downOn) || (dod && downOn > dod)) ? "Enter the date the former home was sold or given away" : "",
    downValue: (downOn || downValue.trim()) && downValuePence === null ? "Enter the former home's value when it was sold or given away" : "",
    relief: relief.trim() && reliefPence === null ? "Enter an amount like 2,500,000" : "",
  };
  const invalid = Object.values(errors).some(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (invalid) return;
    updateTaxProfile(estate.id, {
      longTermUkResident: resident,
      spouseExemptionLimited: capped,
      transferredNrbBp: nrbBp ?? 0,
      transferredRnrbBp: rnrbBp ?? 0,
      predeceasedSpouse: spouseName.trim() ? { name: spouseName.trim(), ...(spouseDied ? { diedOn: spouseDied } : {}) } : null,
      downsizing: downOn && downValuePence !== null ? { disposedOn: downOn, formerResidenceValuePence: downValuePence } : null,
      reliefAllowanceTransferredPence: reliefPence,
      residueBenham: benham,
      mergeCharityComponents: merge,
    });
    onDone();
  }

  const err = (k: keyof typeof errors) => (tried ? errors[k] : "");
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Check checked={resident} onChange={setResident} hint="UK resident for at least 10 of the 20 tax years before death (UK-domiciled, for deaths before 6 April 2025).">
        Long-term UK resident
      </Check>
      <Check checked={capped} onChange={setCapped} hint="Caps the spouse exemption at the nil-rate band.">
        The spouse or civil partner is not a long-term UK resident
      </Check>

      <fieldset className="m-0 flex flex-col gap-4 rounded-[18px] border border-line p-4">
        <legend className="px-1 text-[15px] font-semibold">Predeceased spouse or civil partner</legend>
        <Field label="Name" error={err("spouseName")}>
          <input className={input} value={spouseName} onChange={(e) => setSpouseName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Date of death" error={err("spouseDied")}>
          <input type="date" className={input} value={spouseDied} onChange={(e) => setSpouseDied(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nil-rate band transferred" hint="Unused share, 0 to 100" error={err("nrb")} prefix="%">
            <input className={`${input} pl-9`} inputMode="decimal" value={nrb} onChange={(e) => setNrb(e.target.value)} />
          </Field>
          <Field label="Residence band transferred" hint="Unused share, 0 to 100" error={err("rnrb")} prefix="%">
            <input className={`${input} pl-9`} inputMode="decimal" value={rnrb} onChange={(e) => setRnrb(e.target.value)} />
          </Field>
        </div>
        <Field label="100% relief allowance transferred" hint="The spouse's unused business and agricultural relief allowance. Leave blank if none." error={err("relief")} prefix="£">
          <input className={`${input} pl-8`} inputMode="decimal" value={relief} onChange={(e) => setRelief(e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-4 rounded-[18px] border border-line p-4">
        <legend className="px-1 text-[15px] font-semibold">Downsizing</legend>
        <p className="m-0 text-sm text-muted">A former home sold or given away on or after 8 July 2015. Leave blank if none.</p>
        <Field label="Date sold or given away" error={err("downOn")}>
          <input type="date" className={input} value={downOn} onChange={(e) => setDownOn(e.target.value)} />
        </Field>
        <Field label="Its value then" error={err("downValue")} prefix="£">
          <input className={`${input} pl-8`} inputMode="decimal" value={downValue} onChange={(e) => setDownValue(e.target.value)} />
        </Field>
      </fieldset>

      <Check checked={benham} onChange={setBenham} hint="Not calculated yet: the engine flags it and shows the usual basis.">
        The will divides residue so each beneficiary gets an equal amount after tax (Re Benham)
      </Check>
      <Check checked={merge} onChange={setMerge} hint="An election to merge components for the 36% charity rate. Must be made within 2 years of death.">
        Merge components for the 36% rate
      </Check>
      <Actions label="Save" onCancel={onDone} />
    </form>
  );
}

// ── Lifetime gifts ──────────────────────────────────────────────────────────

export function GiftSheet({ open, onClose, estate }: { open: boolean; onClose: () => void; estate: Estate }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add a lifetime gift" wide>
      <GiftForm estate={estate} onDone={onClose} />
    </Sheet>
  );
}

type ReliefChoice = "" | "business:full" | "business:half" | "agricultural:full" | "agricultural:half";

function GiftForm({ estate, onDone }: { estate: Estate; onDone: () => void }) {
  const { addLifetimeGift } = useActions();
  const family = estate.parties.filter((p) => !p.staffId);
  const [description, setDescription] = useState("");
  const [madeOn, setMadeOn] = useState("");
  const [value, setValue] = useState("");
  const [recipient, setRecipient] = useState(family[0]?.id ?? "");
  const [otherName, setOtherName] = useState("");
  const [otherCategory, setOtherCategory] = useState<TaxCategory>("other");
  const [form, setForm] = useState<LifetimeGiftRecord["form"]>("outright");
  const [taxPaid, setTaxPaid] = useState("");
  const [smallGift, setSmallGift] = useState(false);
  const [wedding, setWedding] = useState<"" | "child" | "grandchild" | "other">("");
  const [normal, setNormal] = useState(false);
  const [relief, setRelief] = useState<ReliefChoice>("");
  const [stillQualifies, setStillQualifies] = useState(true);
  const [tried, setTried] = useState(false);

  const dod = estate.deceased.dateOfDeath;
  const valuePence = parseMoney(value);
  const taxPaidPence = taxPaid.trim() ? parseMoney(taxPaid) : null;
  const errors = {
    description: !description.trim() ? "Describe the gift" : "",
    madeOn: !isValidDate(madeOn) ? "Enter the date of the gift" : dod && madeOn >= dod ? "The gift must be before the date of death" : "",
    value: valuePence === null || valuePence <= 0 ? "Enter the value when it was given" : "",
    otherName: recipient === "" && !otherName.trim() ? "Name who received it" : "",
    taxPaid: taxPaid.trim() && taxPaidPence === null ? "Enter an amount, or leave blank" : "",
  };
  const invalid = Object.values(errors).some(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (invalid) return;
    const party = family.find((p) => p.id === recipient);
    const [kind, rate] = relief ? (relief.split(":") as ["business" | "agricultural", "full" | "half"]) : [];
    addLifetimeGift(estate.id, {
      description: description.trim(),
      madeOn,
      valuePence: valuePence!,
      ...(party ? { recipientPartyId: party.id, recipientName: party.name } : { recipientName: otherName.trim() }),
      recipientCategory: party ? taxCategoryOf(party).category : otherCategory,
      form,
      ...(form === "trust" && taxPaidPence ? { lifetimeTaxPaidPence: taxPaidPence } : {}),
      ...(smallGift ? { smallGift: true } : {}),
      ...(wedding ? { weddingGift: wedding } : {}),
      ...(normal ? { normalExpenditure: true } : {}),
      ...(kind && rate ? { relief: { kind, rate, stillQualifiesAtDeath: stillQualifies } } : {}),
    });
    onDone();
  }

  const err = (k: keyof typeof errors) => (tried ? errors[k] : "");
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="What was given" error={err("description")}>
        <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="For example, cash towards a house deposit" autoComplete="off" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date given" error={err("madeOn")}>
          <input type="date" className={input} value={madeOn} onChange={(e) => setMadeOn(e.target.value)} />
        </Field>
        <Field label="Value when given" error={err("value")} prefix="£">
          <input className={`${input} pl-8`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </div>
      <Field label="Given to" hint={recipient ? "Treated by the category set under Beneficiaries for IHT." : undefined}>
        <select className={select} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
          {family.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="">Someone else</option>
        </select>
      </Field>
      {recipient === "" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Their name" error={err("otherName")}>
            <input className={input} value={otherName} onChange={(e) => setOtherName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Treated as">
            <select className={select} value={otherCategory} onChange={(e) => setOtherCategory(e.target.value as TaxCategory)}>
              {(Object.keys(TAX_CATEGORY_LABEL) as TaxCategory[]).map((c) => (
                <option key={c} value={c}>
                  {TAX_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 text-[15px] font-semibold">How was it given?</legend>
        <div className="flex flex-wrap gap-2">
          {(["outright", "trust"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={form === f}
              onClick={() => setForm(f)}
              className={`h-11 rounded-full px-4 text-[15px] ${form === f ? "bg-teal font-semibold text-white" : "border-[1.5px] border-line-strong font-medium text-ink hover:bg-cream"}`}
            >
              {f === "outright" ? "Outright" : "Into a trust"}
            </button>
          ))}
        </div>
      </fieldset>
      {form === "trust" && (
        <Field label="Lifetime tax paid on it" hint="Tax paid when it went into trust. Leave blank if none." error={err("taxPaid")} prefix="£">
          <input className={`${input} pl-8`} inputMode="decimal" value={taxPaid} onChange={(e) => setTaxPaid(e.target.value)} />
        </Field>
      )}
      <fieldset className="m-0 flex flex-col gap-3 rounded-[18px] border border-line p-4">
        <legend className="px-1 text-[15px] font-semibold">Exemptions</legend>
        <Check checked={smallGift} onChange={setSmallGift} hint="£250 or less to one person in the tax year, with nothing else to them.">
          Small gift
        </Check>
        <Check checked={normal} onChange={setNormal} hint="Regular, out of income, and left enough to live on. Raises a point for a solicitor to confirm.">
          Normal expenditure out of income
        </Check>
        <Field label="Wedding or civil partnership gift">
          <select className={select} value={wedding} onChange={(e) => setWedding(e.target.value as typeof wedding)}>
            <option value="">No</option>
            <option value="child">To a child (up to £5,000)</option>
            <option value="grandchild">To a grandchild (up to £2,500)</option>
            <option value="other">To anyone else (up to £1,000)</option>
          </select>
        </Field>
      </fieldset>
      <Field label="Business or agricultural relief">
        <select className={select} value={relief} onChange={(e) => setRelief(e.target.value as ReliefChoice)}>
          <option value="">None</option>
          <option value="business:full">Business relief, 100% rate</option>
          <option value="business:half">Business relief, 50% rate</option>
          <option value="agricultural:full">Agricultural relief, 100% rate</option>
          <option value="agricultural:half">Agricultural relief, 50% rate</option>
        </select>
      </Field>
      {relief && (
        <Check checked={stillQualifies} onChange={setStillQualifies} hint="The recipient still owned it, and it still qualified, at the date of death.">
          Still qualifies at death
        </Check>
      )}
      <Actions label="Add gift" onCancel={onDone} />
    </form>
  );
}

// ── Earlier estates (quick succession relief) ───────────────────────────────

export function PriorTransferSheet({ open, onClose, estate }: { open: boolean; onClose: () => void; estate: Estate }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add an earlier estate" wide>
      <PriorTransferForm estate={estate} onDone={onClose} />
    </Sheet>
  );
}

function PriorTransferForm({ estate, onDone }: { estate: Estate; onDone: () => void }) {
  const { addPriorTransfer } = useActions();
  const [label, setLabel] = useState("");
  const [on, setOn] = useState("");
  const [net, setNet] = useState("");
  const [gross, setGross] = useState("");
  const [tax, setTax] = useState("");
  const [tried, setTried] = useState(false);
  const dod = estate.deceased.dateOfDeath;
  const netP = parseMoney(net);
  const grossP = parseMoney(gross);
  const taxP = parseMoney(tax);
  const errors = {
    label: !label.trim() ? "Whose estate was it?" : "",
    on: !isValidDate(on) ? "Enter the date of that death or gift" : dod && on >= dod ? "Must be before this death" : "",
    net: netP === null || netP <= 0 ? "Enter what the deceased inherited" : "",
    gross: grossP === null || grossP <= 0 ? "Enter the chargeable transfer on that estate" : netP !== null && grossP < netP ? "Can't be less than the amount inherited" : "",
    tax: taxP === null ? "Enter the tax paid on that estate" : grossP !== null && taxP > grossP ? "Can't be more than the transfer" : "",
  };
  const invalid = Object.values(errors).some(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (invalid) return;
    addPriorTransfer(estate.id, { label: label.trim(), transferOn: on, netIncreasePence: netP!, grossTransferPence: grossP!, taxPaidPence: taxP! });
    onDone();
  }

  const err = (k: keyof typeof errors) => (tried ? errors[k] : "");
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="m-0 text-sm text-muted">An estate (or gift) the deceased inherited from in the 5 years before death that paid Inheritance Tax. Take the figures from that estate&apos;s IHT account.</p>
      <Field label="Whose estate" error={err("label")}>
        <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example, estate of Joan Mehta" autoComplete="off" />
      </Field>
      <Field label="Date of that death or gift" error={err("on")}>
        <input type="date" className={input} value={on} onChange={(e) => setOn(e.target.value)} />
      </Field>
      <Field label="What the deceased inherited" hint="The increase in their estate, after tax." error={err("net")} prefix="£">
        <input className={`${input} pl-8`} inputMode="decimal" value={net} onChange={(e) => setNet(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Chargeable transfer" error={err("gross")} prefix="£">
          <input className={`${input} pl-8`} inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} />
        </Field>
        <Field label="Tax paid on it" error={err("tax")} prefix="£">
          <input className={`${input} pl-8`} inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
        </Field>
      </div>
      <Actions label="Add" onCancel={onDone} />
    </form>
  );
}

// ── Family for the intestacy rules ──────────────────────────────────────────

const EMPTY_FAMILY: IntestacyFamilyRecord = { issue: [], parents: [], siblingsWhole: [], siblingsHalf: [], grandparents: [], auntsUnclesWhole: [], auntsUnclesHalf: [] };

type PersonRow = { key: string; name: string; alive: boolean; descendants: string; kept: IntestacyPerson[] };
let rowSeq = 0;
const toRows = (ps: IntestacyPerson[]): PersonRow[] =>
  ps.map((p) => ({ key: `r${rowSeq++}`, name: p.name, alive: p.alive, descendants: (p.descendants ?? []).map((d) => d.name).join(", "), kept: p.descendants ?? [] }));
const splitNames = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
function fromRows(rows: PersonRow[]): IntestacyPerson[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const p: IntestacyPerson = { name: r.name.trim(), alive: r.alive };
      if (!r.alive) {
        // Keep anything already recorded about a named descendant (their own children, whether alive).
        const ds = splitNames(r.descendants).map((n) => r.kept.find((k) => k.name === n) ?? { name: n, alive: true });
        if (ds.length) p.descendants = ds;
      }
      return p;
    });
}

function PeopleList({ legend, hint, rows, onChange }: { legend: string; hint?: string; rows: PersonRow[]; onChange: (rows: PersonRow[]) => void }) {
  const set = (key: string, patch: Partial<PersonRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-[18px] border border-line p-4">
      <legend className="px-1 text-[15px] font-semibold">{legend}</legend>
      {hint && <p className="m-0 text-sm text-muted">{hint}</p>}
      {rows.map((r, i) => (
        <div key={r.key} className="flex flex-col gap-2 rounded-[14px] bg-cream p-3">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`${r.key}-name`}>
              {legend}: name {i + 1}
            </label>
            <input id={`${r.key}-name`} className={`${input} h-11 bg-paper`} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Name" autoComplete="off" />
            <button type="button" className="grid size-11 flex-none place-items-center rounded-full text-muted hover:bg-line-soft hover:text-coral-ink" onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.name || "this person"}`}>
              <PiTrash aria-hidden />
            </button>
          </div>
          <label className="flex items-center gap-2 text-[14px] font-medium">
            <input type="checkbox" className={check} checked={!r.alive} onChange={(e) => set(r.key, { alive: !e.target.checked })} />
            Died before the deceased
          </label>
          {!r.alive && (
            <Field label="Their children, who take their share" hint="Names separated by commas. Leave blank if none.">
              <input className={`${input} h-11 bg-paper`} value={r.descendants} onChange={(e) => set(r.key, { descendants: e.target.value })} autoComplete="off" />
            </Field>
          )}
        </div>
      ))}
      <button type="button" className={`${btn.secondary} h-10 self-start text-[14px]`} onClick={() => onChange([...rows, { key: `r${rowSeq++}`, name: "", alive: true, descendants: "", kept: [] }])}>
        <PiPlusBold aria-hidden /> Add
      </button>
    </fieldset>
  );
}

export function FamilySheet({ open, onClose, estate, profile }: { open: boolean; onClose: () => void; estate: Estate; profile: TaxProfile }) {
  return (
    <Sheet open={open} onClose={onClose} title="Family for the intestacy rules" wide>
      <FamilyForm estate={estate} family={profile.intestacyFamily ?? EMPTY_FAMILY} onDone={onClose} />
    </Sheet>
  );
}

function FamilyForm({ estate, family, onDone }: { estate: Estate; family: IntestacyFamilyRecord; onDone: () => void }) {
  const { setIntestacyFamily } = useActions();
  const [spouse, setSpouse] = useState(family.spouseName ?? "");
  const [issue, setIssue] = useState(() => toRows(family.issue));
  const [parents, setParents] = useState(family.parents.join(", "));
  const [sibW, setSibW] = useState(() => toRows(family.siblingsWhole));
  const [sibH, setSibH] = useState(() => toRows(family.siblingsHalf));
  const [grand, setGrand] = useState(family.grandparents.join(", "));
  const [auW, setAuW] = useState(() => toRows(family.auntsUnclesWhole));
  const [auH, setAuH] = useState(() => toRows(family.auntsUnclesHalf));
  const hasIssue = issue.some((r) => r.name.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setIntestacyFamily(estate.id, {
      ...(spouse.trim() ? { spouseName: spouse.trim() } : {}),
      issue: fromRows(issue),
      parents: splitNames(parents),
      siblingsWhole: fromRows(sibW),
      siblingsHalf: fromRows(sibH),
      grandparents: splitNames(grand),
      auntsUnclesWhole: fromRows(auW),
      auntsUnclesHalf: fromRows(auH),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="m-0 text-sm text-muted">Living relatives at the date of death, under the rules for England and Wales. Only the nearest class that has someone in it inherits, so you can stop once you&apos;ve found one.</p>
      <Field label="Spouse or civil partner" hint="Married or in a civil partnership at death. Leave blank if none.">
        <input className={input} value={spouse} onChange={(e) => setSpouse(e.target.value)} autoComplete="off" />
      </Field>
      <PeopleList legend="Children" hint="Including adopted children. A child who died first is represented by their own children." rows={issue} onChange={setIssue} />
      {!hasIssue && !spouse.trim() && (
        <>
          <Field label="Parents" hint="Names separated by commas.">
            <input className={input} value={parents} onChange={(e) => setParents(e.target.value)} autoComplete="off" />
          </Field>
          <PeopleList legend="Brothers and sisters (same two parents)" rows={sibW} onChange={setSibW} />
          <PeopleList legend="Half brothers and sisters" rows={sibH} onChange={setSibH} />
          <Field label="Grandparents" hint="Names separated by commas.">
            <input className={input} value={grand} onChange={(e) => setGrand(e.target.value)} autoComplete="off" />
          </Field>
          <PeopleList legend="Aunts and uncles (whole blood)" rows={auW} onChange={setAuW} />
          <PeopleList legend="Half aunts and uncles" rows={auH} onChange={setAuH} />
        </>
      )}
      {!hasIssue && spouse.trim() && <p className="m-0 rounded-[14px] bg-teal-tint p-3 text-sm text-teal-deep">With a spouse and no children, the spouse inherits everything.</p>}
      <Actions label="Save family" onCancel={onDone} />
    </form>
  );
}

// ── How a holding is treated ────────────────────────────────────────────────

/** Short chips describing a holding's IHT treatment, for the holdings list. */
export function describeTreatment(estate: Estate, a: Asset): string[] {
  const t = a.tax ?? {};
  const name = (id?: string) => estate.parties.find((p) => p.id === id)?.name.split(" ")[0];
  const chips: string[] = [];
  if (a.liability) {
    const on = estate.assets.find((x) => x.id === t.securedOnAssetId);
    if (on) chips.push(`Secured on ${on.clientName ?? on.name}`);
    if (t.deductible === false) chips.push("Not deductible");
    return chips;
  }
  if (t.qualifyingResidence) chips.push("Home for RNRB");
  if (t.ownership === "joint_tenancy") chips.push(t.survivorPartyId ? `Joint → ${name(t.survivorPartyId) ?? "survivor"}` : "Joint tenancy");
  if (t.ownership === "tenancy_in_common") chips.push("Tenants in common");
  if (t.relief) chips.push(`${t.relief.kind === "business" ? "BPR" : "APR"} ${t.relief.rate === "full" ? "100%" : "50%"}`);
  if (a.kind === "pension" || t.pension) {
    const p = t.pension ?? "unused_fund";
    const label = p === "unused_fund" ? "Unused pension" : p === "death_in_service" ? "Death in service" : "Dependant's pension";
    chips.push(t.pensionRecipientPartyId ? `${label} → ${name(t.pensionRecipientPartyId) ?? "beneficiary"}` : label);
  }
  if (t.foreign) chips.push("Foreign");
  if (isChattels(a)) chips.push("Personal chattels");
  return chips;
}

export function HoldingTaxSheet({ open, onClose, estate, assetId }: { open: boolean; onClose: () => void; estate: Estate; assetId?: string }) {
  const asset = estate.assets.find((a) => a.id === assetId);
  return (
    <Sheet open={open && !!asset} onClose={onClose} title={asset ? (asset.clientName ?? asset.name) : "Holding"} wide>
      {asset && <HoldingForm estate={estate} asset={asset} onDone={onClose} />}
    </Sheet>
  );
}

function HoldingForm({ estate, asset, onDone }: { estate: Estate; asset: Asset; onDone: () => void }) {
  const { setAssetTax } = useActions();
  const t = asset.tax ?? {};
  const family = estate.parties.filter((p) => !p.staffId);
  const [ownership, setOwnership] = useState<NonNullable<AssetTax["ownership"]>>(t.ownership ?? "sole");
  const [survivor, setSurvivor] = useState(t.survivorPartyId ?? "");
  const [home, setHome] = useState(Boolean(t.qualifyingResidence));
  const [relief, setRelief] = useState<ReliefChoice>(t.relief ? `${t.relief.kind}:${t.relief.rate}` : "");
  const [pension, setPension] = useState<NonNullable<AssetTax["pension"]>>(t.pension ?? "unused_fund");
  const [pensionTo, setPensionTo] = useState(t.pensionRecipientPartyId ?? "");
  const [foreign, setForeign] = useState(Boolean(t.foreign));
  const [securedOn, setSecuredOn] = useState(t.securedOnAssetId ?? "");
  const [deductible, setDeductible] = useState(t.deductible !== false);
  const isPension = asset.kind === "pension";
  const otherHome = estate.assets.find((a) => a.id !== asset.id && a.tax?.qualifyingResidence);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const tax: AssetTax = {};
    if (asset.liability) {
      if (securedOn) tax.securedOnAssetId = securedOn;
      if (!deductible) tax.deductible = false;
    } else {
      if (!isPension && ownership !== "sole") tax.ownership = ownership;
      if (!isPension && ownership === "joint_tenancy" && survivor) tax.survivorPartyId = survivor;
      if (asset.kind === "property" && home) tax.qualifyingResidence = true;
      if (relief) {
        const [kind, rate] = relief.split(":") as ["business" | "agricultural", "full" | "half"];
        tax.relief = { kind, rate };
      }
      if (isPension) {
        tax.pension = pension;
        if (pensionTo) tax.pensionRecipientPartyId = pensionTo;
      }
      if (foreign) tax.foreign = true;
    }
    setAssetTax(estate.id, asset.id, tax);
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="m-0 text-sm text-muted">
        {asset.valuePence === null ? "Not valued yet." : `${asset.liability ? "Owed" : "Value at death"}: ${formatPounds(asset.valuePence)}.`} How it&apos;s treated for Inheritance Tax.
      </p>
      {asset.liability ? (
        <>
          <Field label="Secured on" hint="A mortgage or loan secured on a holding is deducted from that holding first.">
            <select className={select} value={securedOn} onChange={(e) => setSecuredOn(e.target.value)}>
              <option value="">Not secured</option>
              {estate.assets
                .filter((a) => !a.liability)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.clientName ?? a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Check checked={deductible} onChange={setDeductible} hint="Untick for a debt that can't be deducted, such as one not repaid from the estate or owed to someone who received a gift from the deceased.">
            Deductible
          </Check>
        </>
      ) : (
        <>
          {isPension ? (
            <>
              <Field label="Type of benefit" hint="Unused pension funds are in the estate for deaths from 6 April 2027.">
                <select className={select} value={pension} onChange={(e) => setPension(e.target.value as typeof pension)}>
                  <option value="unused_fund">Unused pension fund or lump sum</option>
                  <option value="death_in_service">Death-in-service benefit (not taxed)</option>
                  <option value="dependants_scheme_pension">Dependant&apos;s scheme pension (not taxed)</option>
                </select>
              </Field>
              <Field label="Paid to">
                <select className={select} value={pensionTo} onChange={(e) => setPensionTo(e.target.value)}>
                  <option value="">Not known yet</option>
                  {family.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Ownership" hint="For shared ownership, enter the value of the deceased's share.">
                <select className={select} value={ownership} onChange={(e) => setOwnership(e.target.value as typeof ownership)}>
                  <option value="sole">Owned alone</option>
                  <option value="joint_tenancy">Joint tenants (passes to the survivor)</option>
                  <option value="tenancy_in_common">Tenants in common (share passes under the will)</option>
                </select>
              </Field>
              {ownership === "joint_tenancy" && (
                <Field label="Survivor">
                  <select className={select} value={survivor} onChange={(e) => setSurvivor(e.target.value)}>
                    <option value="">Not recorded</option>
                    {family.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {asset.kind === "property" && (
                <Check checked={home} onChange={setHome} hint={otherHome ? `Replaces ${otherHome.clientName ?? otherHome.name}: only one home can be nominated.` : "The home that counts for the residence nil-rate band."}>
                  The deceased&apos;s home
                </Check>
              )}
            </>
          )}
          <Field label="Business or agricultural relief">
            <select className={select} value={relief} onChange={(e) => setRelief(e.target.value as ReliefChoice)}>
              <option value="">None</option>
              <option value="business:full">Business relief, 100% rate</option>
              <option value="business:half">Business relief, 50% rate</option>
              <option value="agricultural:full">Agricultural relief, 100% rate</option>
              <option value="agricultural:half">Agricultural relief, 50% rate</option>
            </select>
          </Field>
          <Check checked={foreign} onChange={setForeign}>
            Outside the UK
          </Check>
        </>
      )}
      <Actions label="Save" onCancel={onDone} />
    </form>
  );
}
