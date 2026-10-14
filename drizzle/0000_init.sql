CREATE TYPE "public"."actor_type" AS ENUM('staff', 'family', 'system', 'ai', 'support');--> statement-breakpoint
CREATE TYPE "public"."added_by" AS ENUM('firm', 'family');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'sms', 'post');--> statement-breakpoint
CREATE TYPE "public"."document_icon" AS ENUM('scroll', 'envelope', 'receipt', 'certificate', 'file', 'bank', 'house');--> statement-breakpoint
CREATE TYPE "public"."document_state" AS ENUM('needed', 'checking', 'accepted', 'held');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('review', 'sent', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."estate_status" AS ENUM('active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('review', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."firm_role" AS ENUM('firm_admin', 'partner', 'fee_earner', 'paralegal');--> statement-breakpoint
CREATE TYPE "public"."gift_kind" AS ENUM('specific', 'pecuniary', 'residuary', 'life_interest');--> statement-breakpoint
CREATE TYPE "public"."holding_kind" AS ENUM('property', 'bank', 'savings', 'bonds', 'pension', 'investment', 'credit', 'utility', 'other');--> statement-breakpoint
CREATE TYPE "public"."holding_state" AS ENUM('not_notified', 'awaiting', 'estimate', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."idv_status" AS ENUM('not_started', 'pending', 'passed', 'failed', 'referred');--> statement-breakpoint
CREATE TYPE "public"."institution_kind" AS ENUM('bank', 'building_society', 'pension', 'insurer', 'registrar', 'utility', 'hmrc', 'registry', 'land_registry', 'dwp', 'creditor', 'other');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('receipt', 'payment', 'transfer', 'interim_distribution', 'final_distribution');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'civil_partner', 'widowed', 'divorced', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."message_side" AS ENUM('client', 'firm');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."milestone_key" AS ENUM('registered', 'gathered', 'valued', 'iht', 'grant', 'collected', 'distributed');--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('executor', 'co_executor', 'beneficiary', 'attorney', 'other');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'clean', 'infected', 'unscanned', 'error');--> statement-breakpoint
CREATE TYPE "public"."service_level" AS ENUM('full_admin', 'grant_only');--> statement-breakpoint
CREATE TYPE "public"."task_owner_kind" AS ENUM('firm', 'family', 'third');--> statement-breakpoint
CREATE TYPE "public"."third_party_category" AS ENUM('bank', 'hmrc', 'registry', 'other');--> statement-breakpoint
CREATE TYPE "public"."tone" AS ENUM('teal', 'coral', 'amber', 'plum', 'neutral');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp with time zone,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid,
	"seq" bigint DEFAULT 0 NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ai" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text DEFAULT '' NOT NULL,
	"hash" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_update" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tone" "tone" DEFAULT 'coral' NOT NULL,
	"is_milestone" boolean DEFAULT false NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"hint" text,
	"icon" "document_icon" DEFAULT 'file' NOT NULL,
	"state" "document_state" NOT NULL,
	"copies" integer,
	"file_id" uuid,
	"file_name" text,
	"uploaded_by_party_id" uuid,
	"uploaded_by_membership_id" uuid,
	"uploaded_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text DEFAULT 'letter' NOT NULL,
	"title" text NOT NULL,
	"to_label" text NOT NULL,
	"re" text NOT NULL,
	"body" jsonb NOT NULL,
	"sign_off" text NOT NULL,
	"sources" text NOT NULL,
	"status" "draft_status" DEFAULT 'review' NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"task_id" uuid,
	"client_update" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text
);
--> statement-breakpoint
CREATE TABLE "estate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"slug" text NOT NULL,
	"deceased_full_name" text NOT NULL,
	"deceased_first_name" text NOT NULL,
	"deceased_short_name" text NOT NULL,
	"deceased_aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"date_of_birth" date,
	"date_of_death" date,
	"place_of_death" text,
	"marital_status" "marital_status",
	"service_level" "service_level" DEFAULT 'full_admin' NOT NULL,
	"status" "estate_status" DEFAULT 'active' NOT NULL,
	"fee_earner_id" uuid,
	"funeral_estimate_pence" bigint DEFAULT 0 NOT NULL,
	"fee_estimate_pence" bigint,
	"today_step" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_party" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"user_id" text,
	"role" "party_role" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"full_name" text NOT NULL,
	"initials" text NOT NULL,
	"color" text DEFAULT '#E3A13A' NOT NULL,
	"email" text,
	"phone" text,
	"relationship" text,
	"detail" text,
	"idv_status" "idv_status" DEFAULT 'not_started' NOT NULL,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"key" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"document_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"fields" jsonb NOT NULL,
	"holding_id" uuid,
	"status" "extraction_status" DEFAULT 'review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file_object" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid,
	"uploaded_by" text,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"scan_status" "scan_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_object_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "firm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"town" text,
	"sra_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firm_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "holding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"institution_id" uuid,
	"institution_label" text DEFAULT '' NOT NULL,
	"kind" "holding_kind" NOT NULL,
	"name" text NOT NULL,
	"client_name" text,
	"reference" text,
	"joint_share_bp" integer,
	"state" "holding_state" NOT NULL,
	"value_pence" bigint,
	"liability" boolean DEFAULT false NOT NULL,
	"added_by" "added_by" NOT NULL,
	"next_action" text,
	"next_action_on" date,
	"evidence_document_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "institution_kind" NOT NULL,
	"bereavement_email" text,
	"bereavement_address" text,
	"phone" text,
	"typical_response_days" integer,
	"small_estate_threshold_pence" bigint,
	"accepts_dns" boolean,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"firm_id" uuid,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "job_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"holding_id" uuid,
	"kind" "ledger_kind" NOT NULL,
	"amount_pence" bigint NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text NOT NULL,
	"evidence_document_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "firm_role" NOT NULL,
	"title" text,
	"initials" text NOT NULL,
	"color" text DEFAULT '#0E5F5B' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"side" "message_side" NOT NULL,
	"author_membership_id" uuid,
	"author_party_id" uuid,
	"body" text NOT NULL,
	"attachment_name" text,
	"file_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" "milestone_key" NOT NULL,
	"reached_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missing_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_label" text NOT NULL,
	"action_kind" text NOT NULL,
	"tone" "tone" DEFAULT 'amber' NOT NULL,
	"resolved_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"body" text NOT NULL,
	"author_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid,
	"channel" "channel" DEFAULT 'email' NOT NULL,
	"to_address" text NOT NULL,
	"subject" text,
	"text_body" text NOT NULL,
	"html_body" text,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"owner_kind" "task_owner_kind" NOT NULL,
	"owner_membership_id" uuid,
	"owner_party_id" uuid,
	"owner_label" text,
	"third_party_category" "third_party_category",
	"institution_id" uuid,
	"due_on" date,
	"done_at" timestamp with time zone,
	"done_by" text,
	"source_rule" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "will" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"dated_on" date NOT NULL,
	"original_held" boolean DEFAULT false NOT NULL,
	"location" text,
	"codicils" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "will_gift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"will_id" uuid NOT NULL,
	"kind" "gift_kind" NOT NULL,
	"beneficiary_party_id" uuid,
	"description" text NOT NULL,
	"amount_pence" bigint,
	"share_bp" integer,
	"substitution" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_update" ADD CONSTRAINT "client_update_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_update" ADD CONSTRAINT "client_update_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_file_id_file_object_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_object"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_party_id_estate_party_id_fk" FOREIGN KEY ("uploaded_by_party_id") REFERENCES "public"."estate_party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_uploaded_by_membership_id_membership_id_fk" FOREIGN KEY ("uploaded_by_membership_id") REFERENCES "public"."membership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate" ADD CONSTRAINT "estate_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate" ADD CONSTRAINT "estate_fee_earner_id_membership_id_fk" FOREIGN KEY ("fee_earner_id") REFERENCES "public"."membership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_party" ADD CONSTRAINT "estate_party_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_party" ADD CONSTRAINT "estate_party_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_party" ADD CONSTRAINT "estate_party_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_staff" ADD CONSTRAINT "estate_staff_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_staff" ADD CONSTRAINT "estate_staff_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_staff" ADD CONSTRAINT "estate_staff_membership_id_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction" ADD CONSTRAINT "extraction_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction" ADD CONSTRAINT "extraction_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction" ADD CONSTRAINT "extraction_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction" ADD CONSTRAINT "extraction_holding_id_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_object" ADD CONSTRAINT "file_object_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_object" ADD CONSTRAINT "file_object_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_object" ADD CONSTRAINT "file_object_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_holding_id_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_author_membership_id_membership_id_fk" FOREIGN KEY ("author_membership_id") REFERENCES "public"."membership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_author_party_id_estate_party_id_fk" FOREIGN KEY ("author_party_id") REFERENCES "public"."estate_party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_file_id_file_object_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_object"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missing_item" ADD CONSTRAINT "missing_item_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missing_item" ADD CONSTRAINT "missing_item_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_author_membership_id_membership_id_fk" FOREIGN KEY ("author_membership_id") REFERENCES "public"."membership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_message" ADD CONSTRAINT "outbound_message_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_owner_membership_id_membership_id_fk" FOREIGN KEY ("owner_membership_id") REFERENCES "public"."membership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_owner_party_id_estate_party_id_fk" FOREIGN KEY ("owner_party_id") REFERENCES "public"."estate_party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "will" ADD CONSTRAINT "will_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "will" ADD CONSTRAINT "will_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "will_gift" ADD CONSTRAINT "will_gift_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "will_gift" ADD CONSTRAINT "will_gift_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "will_gift" ADD CONSTRAINT "will_gift_will_id_will_id_fk" FOREIGN KEY ("will_id") REFERENCES "public"."will"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "will_gift" ADD CONSTRAINT "will_gift_beneficiary_party_id_estate_party_id_fk" FOREIGN KEY ("beneficiary_party_id") REFERENCES "public"."estate_party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_user" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credential" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_user" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_user" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_event_firm_seq" ON "audit_event" USING btree ("firm_id","seq");--> statement-breakpoint
CREATE INDEX "audit_event_estate" ON "audit_event" USING btree ("estate_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_update_key" ON "client_update" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "client_update_estate" ON "client_update" USING btree ("estate_id","posted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "document_key" ON "document" USING btree ("estate_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_key" ON "draft" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "draft_review" ON "draft" USING btree ("firm_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "estate_firm_ref" ON "estate" USING btree ("firm_id","ref");--> statement-breakpoint
CREATE UNIQUE INDEX "estate_firm_slug" ON "estate" USING btree ("firm_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "estate_party_key" ON "estate_party" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "estate_party_estate" ON "estate_party" USING btree ("estate_id");--> statement-breakpoint
CREATE INDEX "estate_party_user" ON "estate_party" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "estate_party_email" ON "estate_party" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "estate_staff_key" ON "estate_staff" USING btree ("estate_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "estate_staff_member" ON "estate_staff" USING btree ("estate_id","membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_key" ON "extraction" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "file_object_estate" ON "file_object" USING btree ("estate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holding_key" ON "holding" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "holding_estate" ON "holding" USING btree ("estate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_name" ON "institution" USING btree ("name");--> statement-breakpoint
CREATE INDEX "job_due" ON "job" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "ledger_entry_estate" ON "ledger_entry" USING btree ("estate_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_firm_user" ON "membership" USING btree ("firm_id","user_id");--> statement-breakpoint
CREATE INDEX "membership_user" ON "membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_key" ON "message" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "message_estate" ON "message" USING btree ("estate_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_estate_key" ON "milestone" USING btree ("estate_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "missing_item_key" ON "missing_item" USING btree ("estate_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "note_key" ON "note" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "outbound_message_to" ON "outbound_message" USING btree ("to_address","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_key" ON "task" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "task_estate_open" ON "task" USING btree ("estate_id","done_at");--> statement-breakpoint
CREATE UNIQUE INDEX "will_estate" ON "will" USING btree ("estate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "will_gift_key" ON "will_gift" USING btree ("estate_id","key");