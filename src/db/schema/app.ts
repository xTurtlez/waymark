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
    /** Stable key used by the v1 screens and URLs (e.g. "ellis"). */
    slug: text("slug").notNull(),
    deceasedFullName: text("deceased_full_name").notNull(),
    dateOfDeath: date("date_of_death"),
    serviceLevel: serviceLevel("service_level").notNull().default("full_admin"),
    status: estateStatus("status").notNull().default("active"),
    feeEarnerId: uuid("fee_earner_id").references(() => membership.id, { onDelete: "set null" }),
    /**
     * Milestone 1 only: the remainder of the v1 estate record (tasks, assets,
     * drafts, messages...). Milestone 2 replaces this with normalised tables.
     */
    workspace: jsonb("workspace").notNull(),
    version: integer("version").notNull().default(1),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
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
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    role: partyRole("role").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    relationship: text("relationship"),
    /** Key of the matching party inside the M1 workspace JSON (e.g. "p_sarah"). */
    workspaceKey: text("workspace_key"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("estate_party_estate").on(t.estateId), index("estate_party_user").on(t.userId), index("estate_party_email").on(t.email)],
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
    /** Workspace document this file belongs to (M1), e.g. "d_funeral". */
    documentKey: text("document_key"),
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
