/**
 * Waymark domain model.
 *
 * These types are deliberately shaped like database rows so the demo store in
 * `store.tsx` can later be swapped for a real API without touching the UI.
 * Money is always stored in pence (integers).
 */

export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Who an estate (or item) is currently waiting on. Drives colour everywhere. */
export type WaitingOn = "family" | "bank" | "hmrc" | "registry" | "none";

export type Tone = "teal" | "coral" | "amber" | "plum" | "neutral";

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
  role: string; // "Partner", "Paralegal"
  color: string; // avatar background (hex)
}

export type TaskOwner =
  | { kind: "firm"; staffId: string }
  | { kind: "family"; partyId: string }
  | { kind: "third"; label: string };

export interface Task {
  id: string;
  title: string;
  owner: TaskOwner;
  due: string; // display label for now: "Today", "Fri", "Overdue"
  overdue?: boolean;
  done: boolean;
  doneOn?: string;
}

export type AssetKind =
  | "property"
  | "bank"
  | "savings"
  | "bonds"
  | "pension"
  | "investment"
  | "credit"
  | "utility"
  | "other";

export type AssetState = "confirmed" | "awaiting" | "estimate" | "not_notified";

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string; // "12 Elm Road, Bath" / "Current account"
  clientName?: string; // friendlier name for the portal: "Barclays current account"
  institution: string;
  state: AssetState;
  firmStatus: string; // "Valuation 15 Oct"
  clientStatus: string; // "Valuation on 15 Oct"
  valuePence: number | null; // null = TBC
  liability: boolean;
  addedBy: "firm" | "family";
}

export type DocState = "needed" | "checking" | "accepted" | "held";

export interface EstateDocument {
  id: string;
  name: string;
  hint?: string; // portal hint: "Any recent one will do"
  icon: "scroll" | "envelope" | "receipt" | "certificate" | "file" | "bank" | "house";
  state: DocState;
  copies?: number;
  uploadedBy?: string; // party or staff id
  uploadedAt?: string; // display label
  fileName?: string;
}

export type PartyRole = "executor" | "beneficiary" | "solicitor" | "paralegal";

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
}

export interface AuditEntry {
  id: string;
  at: string; // "10 Oct 07:02"
  actor: string; // staff id, party id, or "ai"
  text: string;
}

export interface Note {
  id: string;
  text: string;
  author: string; // staff id
  at: string;
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
  createdAt: string;
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
  from: string; // "Photo from Sarah · yesterday 21:05"
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
  at: string; // "10:12"
  day: string; // "Tuesday"
  attachment?: string;
}

export interface ClientUpdate {
  id: string;
  when: string; // "Today", "6 October"
  title: string;
  body: string;
  tone: Tone;
  milestone?: boolean;
}

export interface Estate {
  id: string;
  ref: string;
  deceased: {
    firstName: string;
    fullName: string;
    shortName: string; // "Margaret Ellis"
    dateOfDeath: string; // ISO date
    placeOfDeath?: string;
    willDated?: string;
  };
  stage: StageIndex;
  daysOpen: number;
  feeEarnerId: string;
  clientPartyId: string;
  waitingOn: WaitingOn;
  blocker: string; // one-line headline
  attention: boolean;
  typicalDuration?: string; // "9 to 12 months"
  monthsIn?: number;
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
