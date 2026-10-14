import "server-only";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, twoFactor } from "better-auth/plugins";
import { getDb, schema } from "@/db/client";
import { emailHtml, sendMail } from "./mail";
import { env } from "./env";

/**
 * Authentication (Better Auth).
 * - Staff: email + password with TOTP, or passkeys; Microsoft Entra SSO when configured.
 * - Families: magic links (optionally a passkey).
 * There is no public sign-up: accounts are created by the firm (invites) or the seed.
 */
function create() {
  const e = env();
  const url = new URL(e.BETTER_AUTH_URL);
  const microsoft =
    e.MICROSOFT_CLIENT_ID && e.MICROSOFT_CLIENT_SECRET
      ? { microsoft: { clientId: e.MICROSOFT_CLIENT_ID, clientSecret: e.MICROSOFT_CLIENT_SECRET, tenantId: e.MICROSOFT_TENANT_ID ?? "common", disableSignUp: true } }
      : undefined;

  return betterAuth({
    appName: "Waymark",
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        passkey: schema.passkey,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
    socialProviders: microsoft,
    // Stored in Postgres so limits hold across serverless instances.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: e.AUTH_SIGNIN_LIMIT },
        "/sign-in/magic-link": { window: 60, max: e.AUTH_SIGNIN_LIMIT },
        "/two-factor/verify-totp": { window: 60, max: e.AUTH_SIGNIN_LIMIT },
        "/two-factor/verify-backup-code": { window: 60, max: e.AUTH_SIGNIN_LIMIT },
      },
    },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    plugins: [
      twoFactor({ issuer: "Waymark" }),
      passkey({ rpID: url.hostname, rpName: "Waymark", origin: url.origin }),
      magicLink({
        disableSignUp: true,
        expiresIn: 60 * 15,
        sendMagicLink: async ({ email, url: link }) => {
          await sendMail({
            to: email,
            subject: "Your link to sign in",
            text: `Use this link to sign in to your estate on Waymark. It works once and expires in 15 minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
            html: emailHtml("Your link to sign in", ["Use the button below to sign in. It works once and expires in 15 minutes."], { label: "Sign in", url: link }),
          });
        },
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof create>;
const g = globalThis as unknown as { __waymarkAuth?: Auth };

export function getAuth(): Auth {
  if (!g.__waymarkAuth) g.__waymarkAuth = create();
  return g.__waymarkAuth;
}
