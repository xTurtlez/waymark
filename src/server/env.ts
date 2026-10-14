import { z } from "zod";

/** Validated server environment. Parsed lazily so builds don't need secrets. */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  MAIL_DRIVER: z.enum(["outbox", "postmark"]).default("outbox"),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  MAIL_FROM: z.string().default("Waymark <no-reply@waymark.local>"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/files"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("eu-west-2"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  MALWARE_SCANNER: z.enum(["eicar", "none"]).default("eicar"),
  MAX_UPLOAD_MB: z.coerce.number().default(20),
  CRON_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
  REQUIRE_STAFF_MFA: z.enum(["0", "1"]).default("0"),
  // Sign-in attempts allowed per address per minute (per endpoint). E2E raises it.
  AUTH_SIGNIN_LIMIT: z.coerce.number().int().min(1).default(5),
  WAYMARK_DEV_TOOLS: z.enum(["0", "1"]).default("0"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const blank = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
    const parsed = schema.safeParse(blank);
    if (!parsed.success) {
      throw new Error(`Invalid environment:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
    }
    cached = parsed.data;
    if (process.env.NODE_ENV === "production" && cached.STORAGE_DRIVER === "local" && process.env.VERCEL) {
      throw new Error("STORAGE_DRIVER=local is not allowed on Vercel. Configure S3 (eu-west-2).");
    }
  }
  return cached;
}

/** Dev-only tools (the email outbox page) are on outside production, or when explicitly enabled (CI). */
export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || env().WAYMARK_DEV_TOOLS === "1";
}
