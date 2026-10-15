import type {
  Asset,
  AssetKind,
  AssetTax,
  DemoState,
  Draft,
  Estate,
  IntestacyFamilyRecord,
  ISODate,
  LifetimeGiftRecord,
  MissingItem,
  PriorTransferRecord,
  TaskOwner,
  TaxCategory,
  TaxProfile,
} from "./types";
import { DEFAULT_TAX_PROFILE, TAX_CATEGORY_LABEL } from "./iht";
import { deriveState } from "./derive";
import { freshSeed } from "./seed";
import { addDays, fullDay, isoDay, nowIso, uid } from "./format";
import { clientParty, feeEarner, firstName } from "./selectors";

/**
 * The state machine for both sides of the product. The demo build runs it in
 * the browser; the live build runs it on the server inside an RLS-scoped
 * transaction and saves the changed rows (src/server/estate-store.ts).
 * Timestamps come from the clock at the moment the action runs, and derived
 * fields (stage, waiting-on, attention) are recomputed after every action.
 */

export type Action =
  | { type: "hydrate"; state: DemoState }
  | { type: "reset" }
  | { type: "toggleTask"; estateId: string; taskId: string }
  | { type: "addTask"; estateId: string; title: string; owner: TaskOwner; dueOn: ISODate | null }
  | { type: "editDraft"; estateId: string; draftId: string; body: string[] }
  | { type: "approveDraft"; estateId: string; draftId: string }
  | { type: "discardDraft"; estateId: string; draftId: string }
  | { type: "resolveMissing"; estateId: string; missingId: string }
  | { type: "acceptExtraction"; estateId: string; extractionId: string }
  | { type: "markDocChecked"; estateId: string; docId: string }
  | { type: "uploadDocument"; estateId: string; docId?: string; name: string; fileName: string; fileId?: string }
  | { type: "addAsset"; estateId: string; by: "firm" | "family"; kind: AssetKind; name: string; institution: string; valuePence: number | null; liability: boolean }
  | { type: "sendMessage"; estateId: string; from: "client" | "firm"; text: string; attachment?: string }
  | { type: "addNote"; estateId: string; text: string }
  | { type: "createEstate"; id: string; deceasedName: string; clientName: string; clientEmail: string; feeEarnerId: string }
  | { type: "completeOnboarding"; deceasedName: string; relationship: string }
  // Inheritance tax inputs (milestone 3). Staff only.
  | { type: "updateTaxProfile"; estateId: string; patch: TaxProfilePatch }
  | { type: "setPartyTaxCategory"; estateId: string; partyId: string; category: TaxCategory | null }
  | { type: "setAssetTax"; estateId: string; assetId: string; tax: AssetTax }
  | { type: "setWillGiftTax"; estateId: string; giftId: string; assetId: string | null; bearsOwnTax: boolean }
  | { type: "addLifetimeGift"; estateId: string; gift: Omit<LifetimeGiftRecord, "id" | "voided"> }
  | { type: "voidLifetimeGift"; estateId: string; giftId: string }
  | { type: "addPriorTransfer"; estateId: string; transfer: Omit<PriorTransferRecord, "id" | "voided"> }
  | { type: "voidPriorTransfer"; estateId: string; transferId: string }
  | { type: "setIntestacyFamily"; estateId: string; family: IntestacyFamilyRecord | null }
  | { type: "confirmIhtFlag"; estateId: string; code: string; message: string };

/** Fields of the tax profile set from the IHT tab. `null` clears an optional value. */
export interface TaxProfilePatch {
  longTermUkResident?: boolean;
  spouseExemptionLimited?: boolean;
  transferredNrbBp?: number;
  transferredRnrbBp?: number;
  predeceasedSpouse?: { name: string; diedOn?: ISODate } | null;
  downsizing?: { disposedOn: ISODate; formerResidenceValuePence: number } | null;
  reliefAllowanceTransferredPence?: number | null;
  residueBenham?: boolean;
  mergeCharityComponents?: boolean;
}

function taxOf(e: Estate): TaxProfile {
  if (!e.tax) e.tax = structuredClone(DEFAULT_TAX_PROFILE);
  return e.tax;
}

const pounds = (p: number) => `£${(p / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

function describePatch(p: TaxProfilePatch): string {
  const parts: string[] = [];
  if (p.longTermUkResident !== undefined) parts.push(p.longTermUkResident ? "long-term UK resident" : "not a long-term UK resident");
  if (p.spouseExemptionLimited !== undefined) parts.push(p.spouseExemptionLimited ? "spouse exemption capped (spouse not UK resident)" : "spouse exemption unlimited");
  if (p.transferredNrbBp !== undefined) parts.push(`transferred nil-rate band ${p.transferredNrbBp / 100}%`);
  if (p.transferredRnrbBp !== undefined) parts.push(`transferred residence nil-rate band ${p.transferredRnrbBp / 100}%`);
  if (p.predeceasedSpouse !== undefined) parts.push(p.predeceasedSpouse ? `predeceased spouse ${p.predeceasedSpouse.name}` : "predeceased spouse removed");
  if (p.downsizing !== undefined) parts.push(p.downsizing ? `former home ${pounds(p.downsizing.formerResidenceValuePence)} sold or given ${p.downsizing.disposedOn}` : "downsizing removed");
  if (p.reliefAllowanceTransferredPence !== undefined) parts.push(p.reliefAllowanceTransferredPence === null ? "transferred relief allowance removed" : `relief allowance transferred ${pounds(p.reliefAllowanceTransferredPence)}`);
  if (p.residueBenham !== undefined) parts.push(p.residueBenham ? "residue divided on the Benham basis" : "residue divided on the usual basis");
  if (p.mergeCharityComponents !== undefined) parts.push(p.mergeCharityComponents ? "election to merge components for the 36% rate" : "no merge election");
  return parts.join("; ");
}

function withEstate(state: DemoState, id: string, fn: (e: Estate, s: DemoState) => void): DemoState {
  const next = structuredClone(state);
  const e = next.estates.find((x) => x.id === id);
  if (e) fn(e, next);
  return next;
}

function audit(e: Estate, actorId: string, text: string) {
  e.audit.unshift({ id: uid("au"), at: nowIso(), actor: actorId, text });
}

function postUpdate(e: Estate, title: string, body: string, tone: "teal" | "coral" | "amber" | "plum" = "coral") {
  e.updates.unshift({ id: uid("u"), at: nowIso(), title, body, tone });
}

function completeTask(e: Estate, taskId: string | undefined) {
  const t = taskId ? e.tasks.find((x) => x.id === taskId) : undefined;
  if (t && !t.done) {
    t.done = true;
    t.doneAt = nowIso();
  }
}

function avivaDraft(e: Estate, s: DemoState): Draft {
  const sol = feeEarner(s, e);
  const dod = e.deceased.dateOfDeath ? `, who died on [[${fullDay(e.deceased.dateOfDeath)}]]` : "";
  return {
    id: uid("dr"),
    kind: "letter",
    title: "Notification to Aviva",
    to: "Aviva Bereavement Team",
    re: `${e.deceased.fullName}, pension`,
    body: [
      "Dear Sir or Madam,",
      `We act for the executor of the late ${e.deceased.fullName}${dod}. Her Barclays statements show a monthly pension credit from Aviva.`,
      "Please could you confirm the policy details, any lump sum or death benefit payable, and any overpayment since the date of death. A certified copy of the death certificate is enclosed.",
    ],
    signOff: `Yours faithfully,\n${s.firm.name}`,
    sources: "Barclays statement (monthly credit) · death certificate. Highlighted date pulled from certificate.",
    status: "review",
    createdAt: nowIso(),
    taskId: e.tasks.find((t) => /aviva/i.test(t.title) && t.owner.kind === "firm" && !t.done)?.id,
    clientUpdate: {
      title: `We've told Aviva about ${e.deceased.firstName}'s pension`,
      body: `${firstName(sol.name)} has asked for the policy details. Pension companies usually reply in 3 to 4 weeks.`,
    },
  };
}

function core(state: DemoState, a: Action): DemoState {
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "reset":
      return freshSeed();

    case "toggleTask":
      return withEstate(state, a.estateId, (e, s) => {
        const t = e.tasks.find((x) => x.id === a.taskId);
        if (!t) return;
        t.done = !t.done;
        t.doneAt = t.done ? nowIso() : undefined;
        audit(e, s.currentStaffId, `${firstName(s.staff.find((m) => m.id === s.currentStaffId)?.name ?? "")} ${t.done ? "completed" : "reopened"} “${t.title}”`);
      });

    case "addTask":
      return withEstate(state, a.estateId, (e, s) => {
        e.tasks.unshift({ id: uid("t"), title: a.title, owner: a.owner, dueOn: a.dueOn, done: false, createdAt: nowIso() });
        audit(e, s.currentStaffId, `Task added: ${a.title}`);
      });

    case "editDraft":
      return withEstate(state, a.estateId, (e) => {
        const d = e.drafts.find((x) => x.id === a.draftId);
        if (d && d.status === "review") {
          d.body = a.body;
          d.edited = true;
        }
      });

    case "approveDraft":
      return withEstate(state, a.estateId, (e, s) => {
        const d = e.drafts.find((x) => x.id === a.draftId);
        if (!d || d.status !== "review") return;
        d.status = "sent";
        d.decidedAt = nowIso();
        const me = s.staff.find((m) => m.id === s.currentStaffId);
        audit(e, s.currentStaffId, `${firstName(me?.name ?? "")} approved and sent ${d.title.toLowerCase()} (AI draft${d.edited ? ", edited before sending" : ""})`);
        completeTask(e, d.taskId);
        if (d.clientUpdate) postUpdate(e, d.clientUpdate.title, d.clientUpdate.body);
      });

    case "discardDraft":
      return withEstate(state, a.estateId, (e, s) => {
        const d = e.drafts.find((x) => x.id === a.draftId);
        if (!d || d.status !== "review") return;
        d.status = "discarded";
        d.decidedAt = nowIso();
        audit(e, s.currentStaffId, `Discarded AI draft: ${d.title}`);
      });

    case "resolveMissing":
      return withEstate(state, a.estateId, (e, s) => {
        const m: MissingItem | undefined = e.missing.find((x) => x.id === a.missingId);
        if (!m || m.resolved) return;
        m.resolved = true;
        const client = clientParty(e);
        const sol = feeEarner(s, e);
        switch (m.actionKind) {
          case "draft-aviva": {
            const d = avivaDraft(e, s);
            e.drafts.unshift(d);
            audit(e, "ai", `Assistant drafted ${d.title.toLowerCase()}. Awaiting review.`);
            break;
          }
          case "remind-family": {
            e.messages.push({
              id: uid("msg"),
              from: "firm",
              authorId: sol.id,
              sentAt: nowIso(),
              text: `Hi ${firstName(client.name)}, when you have a moment, could you add the funeral invoice? A photo is fine. I'll ask the bank to pay it directly.`,
            });
            audit(e, s.currentStaffId, `Reminder sent to ${client.name}: ${m.title.toLowerCase()}`);
            break;
          }
          case "request":
            audit(e, s.currentStaffId, `Requested title register from HM Land Registry (${m.title})`);
            break;
          case "id-check":
            audit(e, s.currentStaffId, `ID check request sent to ${m.title.replace(" ID", "")}`);
            break;
        }
      });

    case "acceptExtraction":
      return withEstate(state, a.estateId, (e, s) => {
        const x = e.extractions.find((y) => y.id === a.extractionId);
        if (!x || x.status !== "review") return;
        x.status = "accepted";
        const bal = x.fields.find((f) => /balance/i.test(f.key));
        const asset = e.assets.find((y) => y.id === x.assetId);
        if (asset) {
          if (bal) {
            const n = parseFloat(bal.value.replace(/[£,]/g, ""));
            if (!Number.isNaN(n)) asset.valuePence = Math.round(n * 100);
          }
          asset.state = "confirmed";
        }
        const doc = e.documents.find((d) => d.id === x.documentId);
        if (doc) doc.state = "accepted";
        const t = e.tasks.find((y) => !y.done && /check/i.test(y.title) && doc && y.title.includes(doc.name));
        completeTask(e, t?.id);
        const client = clientParty(e);
        audit(e, s.currentStaffId, `Reviewed extracted fields from ${x.fileName} and updated assets`);
        postUpdate(e, `Your ${doc?.name ?? "document"} has been checked`, `Thank you, ${firstName(client.name)}. Nothing more needed from you on this one.`, "amber");
      });

    case "markDocChecked":
      return withEstate(state, a.estateId, (e, s) => {
        const doc = e.documents.find((d) => d.id === a.docId);
        if (!doc || doc.state !== "checking") return;
        doc.state = "accepted";
        const client = clientParty(e);
        const me = s.staff.find((m) => m.id === s.currentStaffId);
        audit(e, s.currentStaffId, `${firstName(me?.name ?? "")} marked ${doc.name} as checked`);
        for (const t of e.tasks) if (!t.done && t.title.includes(doc.name) && t.owner.kind === "firm") completeTask(e, t.id);
        postUpdate(e, `Your ${doc.name} has been checked`, `Thank you, ${firstName(client.name)}. Nothing more needed from you on this one.`, "amber");
      });

    case "uploadDocument":
      return withEstate(state, a.estateId, (e) => {
        const client = clientParty(e);
        let doc = a.docId ? e.documents.find((d) => d.id === a.docId) : undefined;
        if (!doc) {
          doc = { id: uid("d"), name: a.name, icon: "file", state: "checking" };
          e.documents.push(doc);
        }
        doc.state = "checking";
        doc.fileName = a.fileName;
        doc.fileId = a.fileId;
        doc.uploadedBy = client.id;
        doc.uploadedAt = nowIso();
        for (const t of e.tasks) {
          if (!t.done && t.owner.kind === "family" && (t.title.toLowerCase().includes(doc.name.toLowerCase()) || doc.name.toLowerCase().includes(t.title.toLowerCase().replace(/^find /, "")))) {
            completeTask(e, t.id);
          }
        }
        e.tasks.unshift({ id: uid("t"), title: `Check ${doc.name} from ${firstName(client.name)}`, owner: { kind: "firm", staffId: e.feeEarnerId }, dueOn: isoDay(), done: false, createdAt: nowIso() });
        audit(e, client.id, `${firstName(client.name)} uploaded ${a.fileName}`);
      });

    case "addAsset":
      return withEstate(state, a.estateId, (e, s) => {
        const asset: Asset = {
          id: uid("a"),
          kind: a.kind,
          name: a.name,
          clientName: a.name,
          institution: a.institution,
          state: a.by === "firm" ? "confirmed" : "estimate",
          valuePence: a.valuePence,
          liability: a.liability,
          addedBy: a.by,
        };
        e.assets.push(asset);
        const who = a.by === "family" ? clientParty(e) : undefined;
        audit(e, who?.id ?? s.currentStaffId, `${who ? firstName(who.name) : "Firm"} added ${a.liability ? "liability" : "asset"}: ${a.name}${a.institution ? ` (${a.institution})` : ""}`);
        if (a.by === "family" && (a.kind === "bank" || a.kind === "savings")) {
          e.tasks.unshift({
            id: uid("t"),
            title: `Write to ${a.institution || a.name} for date-of-death balance`,
            owner: { kind: "firm", staffId: e.feeEarnerId },
            dueOn: addDays(isoDay(), 7),
            done: false,
            createdAt: nowIso(),
          });
        }
      });

    case "sendMessage":
      return withEstate(state, a.estateId, (e, s) => {
        const authorId = a.from === "client" ? e.clientPartyId : s.currentStaffId;
        e.messages.push({ id: uid("msg"), from: a.from, authorId, sentAt: nowIso(), text: a.text, attachment: a.attachment });
      });

    case "addNote":
      return withEstate(state, a.estateId, (e, s) => {
        e.notes.unshift({ id: uid("n"), text: a.text, author: s.currentStaffId, at: nowIso() });
      });

    case "createEstate": {
      const next = structuredClone(state);
      const [first] = a.deceasedName.trim().split(/\s+/);
      const parts = a.clientName.trim().split(/\s+/);
      const clientId = `p_${a.id}_client`;
      const now = nowIso();
      const est = {
        id: a.id,
        ref: `HRT-${String(431 + next.estates.length).padStart(4, "0")}`,
        deceased: { firstName: first, fullName: a.deceasedName.trim(), shortName: a.deceasedName.trim(), dateOfDeath: null },
        serviceLevel: "full_admin",
        openedAt: now,
        milestones: {},
        feeEarnerId: a.feeEarnerId,
        clientPartyId: clientId,
        funeralEstimatePence: 0,
        parties: [
          { id: clientId, name: a.clientName.trim(), initials: ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase(), role: "executor", email: a.clientEmail, color: "#E3A13A", portalStatus: "invited" },
        ],
        tasks: [
          { id: uid("t"), title: "Welcome call with the executor", owner: { kind: "firm", staffId: a.feeEarnerId }, dueOn: addDays(isoDay(), 5), done: false, createdAt: now },
          { id: uid("t"), title: "Accept portal invitation", owner: { kind: "family", partyId: clientId }, dueOn: addDays(isoDay(), 7), done: false, createdAt: now },
        ],
        assets: [],
        documents: [
          { id: uid("d"), name: "Death certificate", hint: "A photo of the certificate is fine", icon: "certificate", state: "needed" },
          { id: uid("d"), name: "The will", hint: "Or tell us where it's kept", icon: "scroll", state: "needed" },
        ],
        audit: [],
        notes: [],
        drafts: [],
        extractions: [],
        missing: [],
        messages: [],
        updates: [],
      } as unknown as Estate;
      audit(est, next.currentStaffId, `Estate opened. Portal invitation sent to ${a.clientEmail}`);
      next.estates.push(est);
      return next;
    }

    case "updateTaxProfile":
      return withEstate(state, a.estateId, (e, s) => {
        const t = taxOf(e);
        const p = a.patch;
        if (p.longTermUkResident !== undefined) t.longTermUkResident = p.longTermUkResident;
        if (p.spouseExemptionLimited !== undefined) t.spouseExemptionLimited = p.spouseExemptionLimited;
        if (p.transferredNrbBp !== undefined) t.transferredNrbBp = p.transferredNrbBp;
        if (p.transferredRnrbBp !== undefined) t.transferredRnrbBp = p.transferredRnrbBp;
        if (p.predeceasedSpouse !== undefined) t.predeceasedSpouse = p.predeceasedSpouse ?? undefined;
        if (p.downsizing !== undefined) t.downsizing = p.downsizing ?? undefined;
        if (p.reliefAllowanceTransferredPence !== undefined) t.reliefAllowanceTransferredPence = p.reliefAllowanceTransferredPence ?? undefined;
        if (p.residueBenham !== undefined) t.residueBenham = p.residueBenham;
        if (p.mergeCharityComponents !== undefined) t.mergeCharityComponents = p.mergeCharityComponents;
        audit(e, s.currentStaffId, `IHT details updated: ${describePatch(p)}`);
      });

    case "setPartyTaxCategory":
      return withEstate(state, a.estateId, (e, s) => {
        const p = e.parties.find((x) => x.id === a.partyId && !x.staffId);
        if (!p) return;
        p.taxCategory = a.category ?? undefined;
        audit(e, s.currentStaffId, `${p.name} recorded for IHT as: ${a.category ? TAX_CATEGORY_LABEL[a.category].toLowerCase() : "worked out from relationship"}`);
      });

    case "setAssetTax":
      return withEstate(state, a.estateId, (e, s) => {
        const asset = e.assets.find((x) => x.id === a.assetId);
        if (!asset) return;
        const tax: AssetTax = {};
        const t = a.tax;
        if (t.ownership && t.ownership !== "sole") tax.ownership = t.ownership;
        if (t.ownership === "joint_tenancy" && t.survivorPartyId) tax.survivorPartyId = t.survivorPartyId;
        if (t.qualifyingResidence) {
          tax.qualifyingResidence = true;
          // Only one home can be nominated.
          for (const other of e.assets) if (other !== asset && other.tax?.qualifyingResidence) other.tax.qualifyingResidence = undefined;
        }
        if (t.relief) tax.relief = t.relief;
        if (t.pension) tax.pension = t.pension;
        if (t.pensionRecipientPartyId) tax.pensionRecipientPartyId = t.pensionRecipientPartyId;
        if (t.foreign) tax.foreign = true;
        if (t.securedOnAssetId) tax.securedOnAssetId = t.securedOnAssetId;
        if (t.deductible === false) tax.deductible = false;
        asset.tax = Object.keys(tax).length ? tax : undefined;
        audit(e, s.currentStaffId, `IHT treatment of ${asset.name} updated`);
      });

    case "setWillGiftTax":
      return withEstate(state, a.estateId, (e, s) => {
        const g = e.will?.gifts.find((x) => x.id === a.giftId);
        if (!g) return;
        if (a.assetId !== null && !e.assets.some((x) => x.id === a.assetId && !x.liability)) return;
        g.assetId = a.assetId ?? undefined;
        g.bearsOwnTax = a.bearsOwnTax || undefined;
        audit(e, s.currentStaffId, `Will gift "${g.description}" ${a.assetId ? `linked to ${e.assets.find((x) => x.id === a.assetId)!.name}` : "unlinked"}${a.bearsOwnTax ? ", bearing its own tax" : ""}`);
      });

    case "addLifetimeGift":
      return withEstate(state, a.estateId, (e, s) => {
        const t = taxOf(e);
        t.gifts.push({ ...a.gift, id: uid("lg") });
        t.gifts.sort((x, y) => (x.madeOn < y.madeOn ? -1 : x.madeOn > y.madeOn ? 1 : 0));
        audit(e, s.currentStaffId, `Lifetime gift recorded: ${a.gift.description}, ${pounds(a.gift.valuePence)} on ${a.gift.madeOn}`);
      });

    case "voidLifetimeGift":
      return withEstate(state, a.estateId, (e, s) => {
        const g = e.tax?.gifts.find((x) => x.id === a.giftId);
        if (!g || g.voided) return;
        g.voided = true;
        audit(e, s.currentStaffId, `Lifetime gift withdrawn: ${g.description}`);
      });

    case "addPriorTransfer":
      return withEstate(state, a.estateId, (e, s) => {
        taxOf(e).priorTransfers.push({ ...a.transfer, id: uid("qsr") });
        audit(e, s.currentStaffId, `Earlier estate recorded for quick succession relief: ${a.transfer.label}`);
      });

    case "voidPriorTransfer":
      return withEstate(state, a.estateId, (e, s) => {
        const p = e.tax?.priorTransfers.find((x) => x.id === a.transferId);
        if (!p || p.voided) return;
        p.voided = true;
        audit(e, s.currentStaffId, `Earlier estate withdrawn: ${p.label}`);
      });

    case "setIntestacyFamily":
      return withEstate(state, a.estateId, (e, s) => {
        taxOf(e).intestacyFamily = a.family ?? undefined;
        audit(e, s.currentStaffId, a.family ? "Family recorded for the intestacy rules" : "Intestacy family removed");
      });

    case "confirmIhtFlag":
      return withEstate(state, a.estateId, (e, s) => {
        const me = s.staff.find((m) => m.id === s.currentStaffId);
        taxOf(e).confirmations[a.code] = { by: s.currentStaffId, at: nowIso(), message: a.message };
        audit(e, s.currentStaffId, `${me?.name ?? "A solicitor"} confirmed: ${a.message}`);
      });

    case "completeOnboarding": {
      const next = structuredClone(state);
      next.onboarded = true;
      const e = next.estates.find((x) => x.id === next.currentClientEstateId);
      if (e) {
        const client = clientParty(e);
        audit(e, client.id, `${firstName(client.name)} completed portal setup (relationship: ${a.relationship.toLowerCase()})`);
      }
      return next;
    }
  }
}

/** Apply an action, then recompute derived fields (stage, waiting-on, attention, days open). */
export function reducer(state: DemoState, a: Action): DemoState {
  const next = core(state, a);
  return next === state ? state : deriveState(next);
}
