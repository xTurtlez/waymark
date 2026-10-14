CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
-- Global (not tenant data); used directly by the runtime role like the other auth tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit TO waymark_runtime;
