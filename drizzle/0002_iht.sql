CREATE TYPE "public"."gift_form" AS ENUM('outright', 'trust');--> statement-breakpoint
CREATE TYPE "public"."ownership" AS ENUM('sole', 'joint_tenancy', 'tenancy_in_common');--> statement-breakpoint
CREATE TYPE "public"."pension_treatment" AS ENUM('unused_fund', 'death_in_service', 'dependants_scheme_pension');--> statement-breakpoint
CREATE TYPE "public"."relief_kind" AS ENUM('business', 'agricultural');--> statement-breakpoint
CREATE TYPE "public"."relief_rate" AS ENUM('full', 'half');--> statement-breakpoint
CREATE TYPE "public"."tax_category" AS ENUM('spouse', 'charity', 'lineal_descendant', 'other');--> statement-breakpoint
CREATE TYPE "public"."wedding_gift" AS ENUM('child', 'grandchild', 'other');--> statement-breakpoint
CREATE TABLE "holding_tax" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"ownership" "ownership" DEFAULT 'sole' NOT NULL,
	"survivor_party_id" uuid,
	"qualifying_residence" boolean DEFAULT false NOT NULL,
	"relief_kind" "relief_kind",
	"relief_rate" "relief_rate",
	"pension_treatment" "pension_treatment",
	"pension_recipient_party_id" uuid,
	"foreign" boolean DEFAULT false NOT NULL,
	"secured_on_holding_id" uuid,
	"deductible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iht_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"long_term_uk_resident" boolean DEFAULT true NOT NULL,
	"spouse_exemption_limited" boolean DEFAULT false NOT NULL,
	"transferred_nrb_bp" integer DEFAULT 0 NOT NULL,
	"transferred_rnrb_bp" integer DEFAULT 0 NOT NULL,
	"predeceased_spouse_name" text,
	"predeceased_spouse_died_on" date,
	"downsizing_disposed_on" date,
	"downsizing_former_value_pence" bigint,
	"relief_allowance_transferred_pence" bigint,
	"residue_benham" boolean DEFAULT false NOT NULL,
	"merge_charity_components" boolean DEFAULT false NOT NULL,
	"intestacy_family" jsonb,
	"confirmations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifetime_gift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"made_on" date NOT NULL,
	"value_pence" bigint NOT NULL,
	"description" text NOT NULL,
	"recipient_party_id" uuid,
	"recipient_name" text,
	"recipient_category" "tax_category" NOT NULL,
	"form" "gift_form" DEFAULT 'outright' NOT NULL,
	"lifetime_tax_paid_pence" bigint,
	"small_gift" boolean DEFAULT false NOT NULL,
	"wedding_gift" "wedding_gift",
	"normal_expenditure" boolean DEFAULT false NOT NULL,
	"relief_kind" "relief_kind",
	"relief_rate" "relief_rate",
	"relief_still_qualifies" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "party_tax" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"category" "tax_category",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prior_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"estate_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"transfer_on" date NOT NULL,
	"net_increase_pence" bigint NOT NULL,
	"gross_transfer_pence" bigint NOT NULL,
	"tax_paid_pence" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "will_gift" ADD COLUMN "holding_id" uuid;--> statement-breakpoint
ALTER TABLE "will_gift" ADD COLUMN "bears_own_tax" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "holding_tax" ADD CONSTRAINT "holding_tax_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_tax" ADD CONSTRAINT "holding_tax_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_tax" ADD CONSTRAINT "holding_tax_holding_id_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_tax" ADD CONSTRAINT "holding_tax_survivor_party_id_estate_party_id_fk" FOREIGN KEY ("survivor_party_id") REFERENCES "public"."estate_party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_tax" ADD CONSTRAINT "holding_tax_pension_recipient_party_id_estate_party_id_fk" FOREIGN KEY ("pension_recipient_party_id") REFERENCES "public"."estate_party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_tax" ADD CONSTRAINT "holding_tax_secured_on_holding_id_holding_id_fk" FOREIGN KEY ("secured_on_holding_id") REFERENCES "public"."holding"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iht_profile" ADD CONSTRAINT "iht_profile_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iht_profile" ADD CONSTRAINT "iht_profile_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifetime_gift" ADD CONSTRAINT "lifetime_gift_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifetime_gift" ADD CONSTRAINT "lifetime_gift_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifetime_gift" ADD CONSTRAINT "lifetime_gift_recipient_party_id_estate_party_id_fk" FOREIGN KEY ("recipient_party_id") REFERENCES "public"."estate_party"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_tax" ADD CONSTRAINT "party_tax_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_tax" ADD CONSTRAINT "party_tax_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_tax" ADD CONSTRAINT "party_tax_party_id_estate_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."estate_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prior_transfer" ADD CONSTRAINT "prior_transfer_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prior_transfer" ADD CONSTRAINT "prior_transfer_estate_id_estate_id_fk" FOREIGN KEY ("estate_id") REFERENCES "public"."estate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "holding_tax_holding" ON "holding_tax" USING btree ("holding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "iht_profile_estate" ON "iht_profile" USING btree ("estate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lifetime_gift_key" ON "lifetime_gift" USING btree ("estate_id","key");--> statement-breakpoint
CREATE INDEX "lifetime_gift_estate" ON "lifetime_gift" USING btree ("estate_id","made_on");--> statement-breakpoint
CREATE UNIQUE INDEX "party_tax_party" ON "party_tax" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prior_transfer_key" ON "prior_transfer" USING btree ("estate_id","key");