/**
 * Waymark domain model as the screens see it.
 *
 * The live build stores this in normalised Postgres tables (src/db/schema) and
 * assembles it per request (src/server/estate-store.ts); the demo build keeps
 * it in the browser. Rules shared by both:
 * - Money is integer pence.
 * - Dates are ISO strings: `ISODate` ("2026-10-16") for calendar days,
 *   `ISOTime` ("2026-10-10T07:02:00.000Z") for moments. Display strings such as
 *   "Today" or "Fri" are derived at render time (src/lib/format.ts).
 * - Stage, waiting-on, the blocker line, attention and days open are derived
 *   (src/lib/derive.ts), never stored.
 */

export type ISODate = string;
export type ISOTime = string;

export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Milestones that complete each stage, in order. Stage = first one not yet reached. */
export const MILESTONES = ["registered", "gathered", "valued", "iht", "grant", "collected", "distributed"] as const;
export type MilestoneKey = (typeof MILESTONES)[number];

/** Who an estate (or item) is currently waiting on. Drives colour everywhere. */
export type WaitingOn = "family" | "bank" | "hmrc" | "registry" | "none";
/** Third parties grouped the way the dashboard reports them. */
export type ThirdPartyCategory = "bank" | "hmrc" | "registry" | "other";

export type Tone = "teal" | "coral" | "amber" | "plum" | "neutral";

/** How a recipient is treated for inheritance tax (src/rules). */
export type TaxCategory = "spouse" | "charity" | "lineal_descendant" | "other";

export interface Firm {
  id: string;
  name: string; // "Ellis & Rowe Solicitors"
  shortName: string; // "Ellis & Rowe"
  town: string;
}

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  role: string; // job title shown in the UI: "Partner", "Paralegal"
  color: string; // avatar background (hex)
}

export type TaskOwner =
  | { kind: "firm"; staffId: string }
  | { kind: "family"; partyId: string }
  | { kind: "third"; label: string; category: ThirdPartyCategory };

export interface Task {
  id: string;
  title: string;
  owner: TaskOwner;
  dueOn: ISODate | null;
  done: boolean;
  doneAt?: ISOTime;
  createdAt: ISOTime;
  /** Rule that created it (statutory steps, M2+). */
  sourceRule?: string;
}

export type AssetKind = "property" | "bank" | "savings" | "bonds" | "pension" | "investment" | "credit" | "utility" | "other";

/** not_notified → awaiting (institution told, waiting on figures) → estimate → confirmed. */
export type AssetState = "confirmed" | "awaiting" | "estimate" | "not_notified";

/** An asset or liability ("holding"). Display statuses are derived (see derive.ts). */
export interface Asset {
  id: string;
  kind: AssetKind;
  name: string; // "12 Elm Road, Bath" / "Current account"
  clientName?: string; // friendlier name for the portal: "Barclays current account"
  institution: string;
  reference?: string; // account or policy reference
  state: AssetState;
  valuePence: number | null; // value at date of death; null = not known
  liability: boolean;
  addedBy: "firm" | "family";
  /** Next dated step, e.g. a booked valuation. */
  nextActionOn?: ISODate;
  nextAction?: "valuation";
  /** Inheritance tax treatment (firm-set). */
  tax?: AssetTax;
}

export interface AssetTax {
  ownership?: "sole" | "joint_tenancy" | "tenancy_in_common";
  /** Joint tenancy: the party who takes the deceased's share by survivorship. */
  survivorPartyId?: string;
  /** The home nominated for the residence nil-rate band. */
  qualifyingResidence?: boolean;
  relief?: { kind: "business" | "agricultural"; rate: "full" | "half" };
  pension?: "unused_fund" | "death_in_service" | "dependants_scheme_pension";
  pensionRecipientPartyId?: string;
  foreign?: boolean;
  /** A liability secured on another holding (e.g. a mortgage on the home). */
  securedOnAssetId?: string;
  /** False for a debt that can't be deducted. Default true. */
  deductible?: boolean;
}

export type DocState = "needed" | "checking" | "accepted" | "held";
export type DocIcon = "scroll" | "envelope" | "receipt" | "certificate" | "file" | "bank" | "house";

export interface EstateDocument {
  id: string;
  name: string;
  hint?: string; // portal hint: "Any recent one will do"
  icon: DocIcon;
  state: DocState;
  copies?: number;
  uploadedBy?: string; // party or staff id
  uploadedAt?: ISOTime;
  fileName?: string;
  fileId?: string; // live: stored file
}

export type PartyRole = "executor" | "co_executor" | "beneficiary" | "attorney" | "other" | "solicitor" | "paralegal";

export interface Party {
  id: string;
  name: string;
  initials: string;
  role: PartyRole;
  relationship?: string; // "daughter"
  detail?: string; // "Canada"
  email?: string;
  color: string;
  portalStatus?: "active" | "invited" | "not_invited";
  staffId?: string;
  /** IHT treatment of gifts to this person; unset = worked out from the relationship. */
  taxCategory?: TaxCategory;
}

export interface AuditEntry {
  id: string;
  at: ISOTime;
  actor: string; // staff id, party id, "ai" or "system"
  text: string;
}

export interface Note {
  id: string;
  text: string;
  author: string; // staff id
  at: ISOTime;
}

export type DraftStatus = "review" | "sent" | "discarded";

export interface Draft {
  id: string;
  kind: "letter" | "email";
  title: string; // "Chaser to Barclays"
  to: string; // "Barclays Bereavement Services"
  re: string; // "Mrs M A Ellis, a/c ending 2291"
  /** Paragraphs. Text wrapped in [[double brackets]] is highlighted as AI-extracted. */
  body: string[];
  signOff: string;
  sources: string;
  status: DraftStatus;
  edited?: boolean;
  createdAt: ISOTime;
  decidedAt?: ISOTime;
  taskId?: string; // task completed when sent
  /** Plain-English update posted to the family when the draft is sent. */
  clientUpdate?: { title: string; body: string };
}

export interface ExtractedField {
  key: string;
  value: string;
  confidence: "high" | "medium" | "check";
  note?: string; // "Check: low light"
}

export interface Extraction {
  id: string;
  documentId: string;
  fileName: string;
  fields: ExtractedField[];
  assetId?: string; // asset to update on accept
  status: "review" | "accepted";
}

export interface MissingItem {
  id: string;
  title: string;
  body: string;
  action: string;
  actionKind: "draft-aviva" | "remind-family" | "request" | "id-check";
  tone: Tone;
  resolved?: boolean;
}

export interface Message {
  id: string;
  from: "client" | "firm";
  authorId: string;
  text: string;
  sentAt: ISOTime;
  attachment?: string;
}

export interface ClientUpdate {
  id: string;
  at: ISOTime;
  title: string;
  body: string;
  tone: Tone;
  milestone?: boolean;
}

export interface WillGift {
  id: string;
  kind: "specific" | "pecuniary" | "residuary" | "life_interest";
  beneficiaryPartyId?: string;
  description: string;
  amountPence?: number;
  /** Share of residue in basis points (10000 = 100%). */
  shareBp?: number;
  substitution?: string;
  /** Specific gift: the holding it gives. */
  assetId?: string;
  /** The gift bears its own IHT; otherwise it passes free of tax. */
  bearsOwnTax?: boolean;
}

export interface Will {
  dated: ISODate;
  originalHeld: boolean;
  location?: string;
  codicils: number;
  gifts: WillGift[];
}

export interface LifetimeGiftRecord {
  id: string;
  madeOn: ISODate;
  valuePence: number;
  description: string;
  recipientPartyId?: string;
  recipientName?: string;
  recipientCategory: TaxCategory;
  form: "outright" | "trust";
  lifetimeTaxPaidPence?: number;
  smallGift?: boolean;
  weddingGift?: "child" | "grandchild" | "other";
  normalExpenditure?: boolean;
  relief?: { kind: "business" | "agricultural"; rate: "full" | "half"; stillQualifiesAtDeath: boolean };
  voided?: boolean;
}

export interface PriorTransferRecord {
  id: string;
  label: string;
  transferOn: ISODate;
  netIncreasePence: number;
  grossTransferPence: number;
  taxPaidPence: number;
  voided?: boolean;
}

export interface IntestacyPerson {
  name: string;
  alive: boolean;
  descendants?: IntestacyPerson[];
}

export interface IntestacyFamilyRecord {
  spouseName?: string;
  issue: IntestacyPerson[];
  parents: string[];
  siblingsWhole: IntestacyPerson[];
  siblingsHalf: IntestacyPerson[];
  grandparents: string[];
  auntsUnclesWhole: IntestacyPerson[];
  auntsUnclesHalf: IntestacyPerson[];
}

/** The estate's inheritance tax facts (firm-only; families never receive this). */
export interface TaxProfile {
  longTermUkResident: boolean;
  spouseExemptionLimited: boolean;
  transferredNrbBp: number;
  transferredRnrbBp: number;
  predeceasedSpouse?: { name: string; diedOn?: ISODate };
  downsizing?: { disposedOn: ISODate; formerResidenceValuePence: number };
  reliefAllowanceTransferredPence?: number;
  residueBenham: boolean;
  mergeCharityComponents: boolean;
  intestacyFamily?: IntestacyFamilyRecord;
  /** Solicitor confirmations of rules-engine flags, by flag code. `message` is the wording confirmed. */
  confirmations: Record<string, { by: string; at: ISOTime; message: string }>;
  gifts: LifetimeGiftRecord[];
  priorTransfers: PriorTransferRecord[];
}

/** Values computed from the stored record (see derive.ts). Present on every estate the screens receive. */
export interface EstateDerived {
  stage: StageIndex;
  daysOpen: number;
  waitingOn: WaitingOn;
  blocker: string;
  attention: boolean;
}

export interface Estate extends EstateDerived {
  id: string;
  ref: string;
  deceased: {
    firstName: string;
    fullName: string;
    shortName: string; // "Margaret Ellis"
    aliases?: string[];
    dateOfBirth?: ISODate;
    dateOfDeath: ISODate | null;
    placeOfDeath?: string;
    maritalStatus?: "single" | "married" | "civil_partner" | "widowed" | "divorced" | "unknown";
  };
  serviceLevel: "full_admin" | "grant_only";
  openedAt: ISOTime;
  /** Date each stage's milestone was reached (stage is derived from these). */
  milestones: Partial<Record<MilestoneKey, ISODate>>;
  will?: Will;
  feeEarnerId: string;
  clientPartyId: string;
  funeralEstimatePence: number;
  parties: Party[];
  tasks: Task[];
  assets: Asset[];
  documents: EstateDocument[];
  audit: AuditEntry[];
  notes: Note[];
  drafts: Draft[];
  extractions: Extraction[];
  missing: MissingItem[];
  messages: Message[];
  updates: ClientUpdate[];
  /** IHT inputs. Firm-only: absent in the portal. */
  tax?: TaxProfile;
  todayStep?: {
    title: string;
    stepTitle: string;
    body: string;
    why: string;
    needs: string[];
    minutes: number;
  };
}

export interface DemoState {
  version: number;
  firm: Firm;
  staff: StaffMember[];
  currentStaffId: string;
  currentClientEstateId: string;
  onboarded: boolean;
  estates: Estate[];
}
