import { sql } from "drizzle-orm";
import {
  bigserial,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Waymark application tables (milestone 1).
 *
 * Every tenant table carries `firm_id`. Row-level security policies, roles,
 * grants and triggers live in hand-written SQL migrations (see `drizzle/`),
 * because they must be exact and are not expressible in Drizzle.
 */

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const firmRole = pgEnum("firm_role", ["firm_admin", "partner", "fee_earner", "paralegal"]);
export const partyRole = pgEnum("party_role", ["executor", "co_executor", "beneficiary", "attorney", "other"]);
export const serviceLevel = pgEnum("service_level", ["full_admin", "grant_only"]);
export const estateStatus = pgEnum("estate_status", ["active", "closed", "archived"]);
export const scanStatus = pgEnum("scan_status", ["pending", "clean", "infected", "unscanned", "error"]);
export const actorType = pgEnum("actor_type", ["staff", "family", "system", "ai", "support"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "done", "failed", "dead"]);
export const channel = pgEnum("channel", ["email", "sms", "post"]);
export const messageStatus = pgEnum("message_status", ["queued", "sent", "failed"]);
export const maritalStatus = pgEnum("marital_status", ["single", "married", "civil_partner", "widowed", "divorced", "unknown"]);
export const milestoneKey = pgEnum("milestone_key", ["registered", "gathered", "valued", "iht", "grant", "collected", "distributed"]);
export const giftKind = pgEnum("gift_kind", ["specific", "pecuniary", "residuary", "life_interest"]);
export const institutionKind = pgEnum("institution_kind", [
  "bank",
  "building_society",
  "pension",
  "insurer",
  "registrar",
  "utility",
  "hmrc",
  "registry",
  "land_registry",
  "dwp",
  "creditor",
  "other",
]);
export const holdingKind = pgEnum("holding_kind", ["property", "bank", "savings", "bonds", "pension", "investment", "credit", "utility", "other"]);
export const holdingState = pgEnum("holding_state", ["not_notified", "awaiting", "estimate", "confirmed"]);
export const addedBy = pgEnum("added_by", ["firm", "family"]);
export const ledgerKind = pgEnum("ledger_kind", ["receipt", "payment", "transfer", "interim_distribution", "final_distribution"]);
export const taskOwnerKind = pgEnum("task_owner_kind", ["firm", "family", "third"]);
export const thirdPartyCategory = pgEnum("third_party_category", ["bank", "hmrc", "registry", "other"]);
export const documentState = pgEnum("document_state", ["needed", "checking", "accepted", "held"]);
export const documentIcon = pgEnum("document_icon", ["scroll", "envelope", "receipt", "certificate", "file", "bank", "house"]);
export const draftStatus = pgEnum("draft_status", ["review", "sent", "discarded"]);
export const extractionStatus = pgEnum("extraction_status", ["review", "accepted"]);
export const messageSide = pgEnum("message_side", ["client", "firm"]);
export const tone = pgEnum("tone", ["teal", "coral", "amber", "plum", "neutral"]);
export const idvStatus = pgEnum("idv_status", ["not_started", "pending", "passed", "failed", "referred"]);

export const firm = pgTable("firm", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  town: text("town"),
  sraNumber: text("sra_number"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** A staff member's role at a firm. Auth identity lives in `user`. */
export const membership = pgTable(
  "membership",
  {
    id: id(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: firmRole("role").notNull(),
    title: text("title"), // "Partner", "Paralegal"
    initials: text("initials").notNull(),
    color: text("color").notNull().default("#0E5F5B"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("membership_firm_user").on(t.firmId, t.userId), index("membership_user").on(t.userId)],
);

export const estate = pgTable(
  "estate",
  {
    id: id(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "cascade" }),
    ref: text("ref").notNull(),
    /** Stable key used in URLs and by the screens (e.g. "ellis"). */
    slug: text("slug").notNull(),
    deceasedFullName: text("deceased_full_name").notNull(),
    deceasedFirstName: text("deceased_first_name").notNull(),
    deceasedShortName: text("deceased_short_name").notNull(),
    deceasedAliases: text("deceased_aliases").array().notNull().default(sql`'{}'::text[]`),
    dateOfBirth: date("date_of_birth"),
    dateOfDeath: date("date_of_death"),
    placeOfDeath: text("place_of_death"),
    maritalStatus: maritalStatus("marital_status"),
    serviceLevel: serviceLevel("service_level").notNull().default("full_admin"),
    status: estateStatus("status").notNull().default("active"),
    feeEarnerId: uuid("fee_earner_id").references(() => membership.id, { onDelete: "set null" }),
    funeralEstimatePence: bigint("funeral_estimate_pence", { mode: "number" }).notNull().default(0),
    feeEstimatePence: bigint("fee_estimate_pence", { mode: "number" }),
    /** Guided "today's step" content for the portal (replaced by the ranked step queue in M5). */
    todayStep: jsonb("today_step"),
    version: integer("version").notNull().default(1),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("estate_firm_ref").on(t.firmId, t.ref), uniqueIndex("estate_firm_slug").on(t.firmId, t.slug)],
);

/** People connected to an estate. `user_id` is set once they accept a portal invite. */
export const estateParty = pgTable(
  "estate_party",
  {
    id: id(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "cascade" }),
    estateId: uuid("estate_id")
      .notNull()
      .references(() => estate.id, { onDelete: "cascade" }),
    /** Stable key the screens use (e.g. "p_sarah"). */
    key: text("key").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    role: partyRole("role").notNull(),
    /** The executor the firm deals with day to day (the portal's main user). */
    isPrimary: boolean("is_primary").notNull().default(false),
    fullName: text("full_name").notNull(),
    initials: text("initials").notNull(),
    color: text("color").notNull().default("#E3A13A"),
    email: text("email"),
    phone: text("phone"),
    relationship: text("relationship"),
    detail: text("detail"),
    idvStatus: idvStatus("idv_status").notNull().default("not_started"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("estate_party_key").on(t.estateId, t.key),
    index("estate_party_estate").on(t.estateId),
    index("estate_party_user").on(t.userId),
    index("estate_party_email").on(t.email),
  ],
);

/** Firm staff working on an estate (fee earner, paralegal), shown alongside the family as parties. */
export const estateStaff = pgTable(
  "estate_staff",
  {
    id: id(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "cascade" }),
    estateId: uuid("estate_id")
      .notNull()
      .references(() => estate.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => membership.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("estate_staff_key").on(t.estateId, t.key), uniqueIndex("estate_staff_member").on(t.estateId, t.membershipId)],
);

export const fileObject = pgTable(
  "file_object",
  {
    id: id(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "cascade" }),
    estateId: uuid("estate_id").references(() => estate.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull().unique(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    scanStatus: scanStatus("scan_status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("file_object_estate").on(t.estateId)],
);

/**
 * Append-only, hash-chained audit log. `seq`, `prev_hash` and `hash` are set
 * by a trigger; UPDATE and DELETE are rejected. See drizzle/0001_security.sql.
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firm.id, { onDelete: "restrict" }),
    estateId: uuid("estate_id"),
    seq: bigint("seq", { mode: "number" }).notNull().default(0),
    actorType: actorType("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    /** For AI actions: model, prompt and output. */
    ai: jsonb("ai"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    prevHash: text("prev_hash").notNull().default(""),
    hash: text("hash").notNull().default(""),
  },
  (t) => [uniqueIndex("audit_event_firm_seq").on(t.firmId, t.seq), index("audit_event_estate").on(t.estateId, t.id)],
);

export const job = pgTable(
  "job",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    firmId: uuid("firm_id").references(() => firm.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().default({}),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    status: jobStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    dedupeKey: text("dedupe_key").unique(),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("job_due").on(t.status, t.runAt)],
);

export const outboundMessage = pgTable(
  "outbound_message",
  {
    id: id(),
    firmId: uuid("firm_id").references(() => firm.id, { onDelete: "cascade" }),
    channel: channel("channel").notNull().default("email"),
    toAddress: text("to_address").notNull(),
    subject: text("subject"),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body"),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: messageStatus("status").notNull().default("queued"),
    error: text("error"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("outbound_message_to").on(t.toAddress, t.createdAt)],
);

// ── Milestone 2: the estate record ─────────────────────────────────────────
// Every row carries firm_id + estate_id for row-level security, and a `key`:
// the stable id the screens use (unique per estate). Dates are real dates;
// display strings ("Today", "Fri") are derived in the app.

const tenantCols = () => ({
  id: id(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firm.id, { onDelete: "cascade" }),
  estateId: uuid("estate_id")
    .notNull()
    .references(() => estate.id, { onDelete: "cascade" }),
});
const keyed = () => ({ ...tenantCols(), key: text("key").notNull() });
const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Stage is derived from these: the first milestone not yet reached. */
export const milestone = pgTable(
  "milestone",
  { ...tenantCols(), key: milestoneKey("key").notNull(), reachedOn: date("reached_on").notNull(), createdAt: createdAt() },
  (t) => [uniqueIndex("milestone_estate_key").on(t.estateId, t.key)],
);

export const will = pgTable(
  "will",
  {
    ...tenantCols(),
    datedOn: date("dated_on").notNull(),
    originalHeld: boolean("original_held").notNull().default(false),
    location: text("location"),
    codicils: integer("codicils").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("will_estate").on(t.estateId)],
);

export const willGift = pgTable(
  "will_gift",
  {
    ...keyed(),
    willId: uuid("will_id")
      .notNull()
      .references(() => will.id, { onDelete: "cascade" }),
    kind: giftKind("kind").notNull(),
    beneficiaryPartyId: uuid("beneficiary_party_id").references(() => estateParty.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amountPence: bigint("amount_pence", { mode: "number" }),
    /** Share of residue in basis points (10000 = 100%). */
    shareBp: integer("share_bp"),
    substitution: text("substitution"),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("will_gift_key").on(t.estateId, t.key)],
);

/**
 * Shared directory of banks, pension schemes, insurers, registrars and
 * agencies (not tenant data). Seeded entries stay `verified = false` until a
 * firm confirms them; the Transaction Engine (M4) fills this out.
 */
export const institution = pgTable(
  "institution",
  {
    id: id(),
    name: text("name").notNull(),
    kind: institutionKind("kind").notNull(),
    bereavementEmail: text("bereavement_email"),
    bereavementAddress: text("bereavement_address"),
    phone: text("phone"),
    typicalResponseDays: integer("typical_response_days"),
    smallEstateThresholdPence: bigint("small_estate_threshold_pence", { mode: "number" }),
    acceptsDns: boolean("accepts_dns"),
    verified: boolean("verified").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("institution_name").on(t.name)],
);

/** An asset or liability at an institution. */
export const holding = pgTable(
  "holding",
  {
    ...keyed(),
    institutionId: uuid("institution_id").references(() => institution.id, { onDelete: "set null" }),
    /** Institution as recorded (free text until linked to the directory). */
    institutionLabel: text("institution_label").notNull().default(""),
    kind: holdingKind("kind").notNull(),
    name: text("name").notNull(),
    clientName: text("client_name"),
    reference: text("reference"),
    /** Deceased's share of a jointly held asset, basis points (null = sole). */
    jointShareBp: integer("joint_share_bp"),
    state: holdingState("state").notNull(),
    /** Value at date of death in pence; null when not known. */
    valuePence: bigint("value_pence", { mode: "number" }),
    liability: boolean("liability").notNull().default(false),
    addedBy: addedBy("added_by").notNull(),
    nextAction: text("next_action"),
    nextActionOn: date("next_action_on"),
    evidenceDocumentId: uuid("evidence_document_id"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("holding_key").on(t.estateId, t.key), index("holding_estate").on(t.estateId)],
);

/**
 * Estate account: what moved, linked to holdings and evidence. Waymark records
 * movements; the firm's client account holds the money.
 */
export const ledgerEntry = pgTable(
  "ledger_entry",
  {
    ...tenantCols(),
    holdingId: uuid("holding_id").references(() => holding.id, { onDelete: "set null" }),
    kind: ledgerKind("kind").notNull(),
    amountPence: bigint("amount_pence", { mode: "number" }).notNull(),
    occurredOn: date("occurred_on").notNull(),
    description: text("description").notNull(),
    evidenceDocumentId: uuid("evidence_document_id"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_entry_estate").on(t.estateId, t.occurredOn)],
);

export const task = pgTable(
  "task",
  {
    ...keyed(),
    title: text("title").notNull(),
    ownerKind: taskOwnerKind("owner_kind").notNull(),
    ownerMembershipId: uuid("owner_membership_id").references(() => membership.id, { onDelete: "set null" }),
    ownerPartyId: uuid("owner_party_id").references(() => estateParty.id, { onDelete: "set null" }),
    ownerLabel: text("owner_label"),
    thirdPartyCategory: thirdPartyCategory("third_party_category"),
    institutionId: uuid("institution_id").references(() => institution.id, { onDelete: "set null" }),
    dueOn: date("due_on"),
    doneAt: ts("done_at"),
    doneBy: text("done_by"),
    sourceRule: text("source_rule"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("task_key").on(t.estateId, t.key), index("task_estate_open").on(t.estateId, t.doneAt)],
);

export const document = pgTable(
  "document",
  {
    ...keyed(),
    name: text("name").notNull(),
    hint: text("hint"),
    icon: documentIcon("icon").notNull().default("file"),
    state: documentState("state").notNull(),
    copies: integer("copies"),
    fileId: uuid("file_id").references(() => fileObject.id, { onDelete: "set null" }),
    fileName: text("file_name"),
    uploadedByPartyId: uuid("uploaded_by_party_id").references(() => estateParty.id, { onDelete: "set null" }),
    uploadedByMembershipId: uuid("uploaded_by_membership_id").references(() => membership.id, { onDelete: "set null" }),
    uploadedAt: ts("uploaded_at"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("document_key").on(t.estateId, t.key)],
);

export const extraction = pgTable(
  "extraction",
  {
    ...keyed(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    /** [{ key, value, confidence, note }] as returned by the extractor. */
    fields: jsonb("fields").notNull(),
    holdingId: uuid("holding_id").references(() => holding.id, { onDelete: "set null" }),
    status: extractionStatus("status").notNull().default("review"),
    createdAt: createdAt(),
    decidedAt: ts("decided_at"),
  },
  (t) => [uniqueIndex("extraction_key").on(t.estateId, t.key)],
);

export const draft = pgTable(
  "draft",
  {
    ...keyed(),
    kind: text("kind").notNull().default("letter"),
    title: text("title").notNull(),
    toLabel: text("to_label").notNull(),
    re: text("re").notNull(),
    /** Paragraphs; [[text]] marks values pulled from evidence. */
    body: jsonb("body").notNull(),
    signOff: text("sign_off").notNull(),
    sources: text("sources").notNull(),
    status: draftStatus("status").notNull().default("review"),
    edited: boolean("edited").notNull().default(false),
    taskId: uuid("task_id").references(() => task.id, { onDelete: "set null" }),
    /** { title, body } posted to the family when sent. */
    clientUpdate: jsonb("client_update"),
    createdAt: createdAt(),
    decidedAt: ts("decided_at"),
    decidedBy: text("decided_by"),
  },
  (t) => [uniqueIndex("draft_key").on(t.estateId, t.key), index("draft_review").on(t.firmId, t.status)],
);

export const missingItem = pgTable(
  "missing_item",
  {
    ...keyed(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionLabel: text("action_label").notNull(),
    actionKind: text("action_kind").notNull(),
    tone: tone("tone").notNull().default("amber"),
    resolvedAt: ts("resolved_at"),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("missing_item_key").on(t.estateId, t.key)],
);

export const message = pgTable(
  "message",
  {
    ...keyed(),
    side: messageSide("side").notNull(),
    authorMembershipId: uuid("author_membership_id").references(() => membership.id, { onDelete: "set null" }),
    authorPartyId: uuid("author_party_id").references(() => estateParty.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    attachmentName: text("attachment_name"),
    fileId: uuid("file_id").references(() => fileObject.id, { onDelete: "set null" }),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("message_key").on(t.estateId, t.key), index("message_estate").on(t.estateId, t.sentAt)],
);

/** Plain-English updates shown to the family. */
export const clientUpdate = pgTable(
  "client_update",
  {
    ...keyed(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    tone: tone("tone").notNull().default("coral"),
    isMilestone: boolean("is_milestone").notNull().default(false),
    postedAt: ts("posted_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("client_update_key").on(t.estateId, t.key), index("client_update_estate").on(t.estateId, t.postedAt)],
);

export const note = pgTable(
  "note",
  {
    ...keyed(),
    body: text("body").notNull(),
    authorMembershipId: uuid("author_membership_id").references(() => membership.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("note_key").on(t.estateId, t.key)],
);
