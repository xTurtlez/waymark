# Deploying Waymark (live)

The live app runs on **Vercel (London, `lhr1`)** with **Postgres in London**. The public demo keeps running on GitHub Pages from `main` (static, no database).

You only need web dashboards for this: no commands on your own computer.

## 1. Database (Neon, London)

1. Sign up at https://neon.tech and create a project. **Region: AWS Europe (London) `eu-west-2`.** Postgres 16 or later.
2. In the project's **Connection details**, copy the connection string for the default owner role (it looks like `postgresql://neondb_owner:…@ep-….eu-west-2.aws.neon.tech/neondb?sslmode=require`). This is the **admin URL**. Keep it secret.
3. Make up a long random password for the app's restricted role (32+ characters, letters and numbers). This is the **runtime password**.
4. Work out the **runtime URL**: the same as the admin URL, but with `waymark_runtime:<runtime password>` in place of `neondb_owner:<owner password>`. If Neon shows a "pooled" host (`-pooler` in the hostname), use that host for the runtime URL.

Supabase works too (choose London). Use its direct or session-pooler connection string as the admin URL.

## 2. Create the tables (GitHub)

1. In the GitHub repo, open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `DATABASE_ADMIN_URL`: the admin URL
   - `RUNTIME_DB_PASSWORD`: the runtime password
   - `SEED_STAFF_PASSWORD` (only for a demo sandbox): the password demo staff accounts will use
2. Open **Actions → Production database → Run workflow**. Leave "seed" unticked for a real pilot firm; tick it to load the Ellis & Rowe demo data into a sandbox.

Run the same workflow again after each release that adds migrations.

## 3. File storage (S3, London)

Create an S3 bucket in **eu-west-2** with default encryption on (SSE-S3 or SSE-KMS) and **Block all public access** on. Create an IAM user limited to that bucket (`s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`) and an access key. Any S3-compatible store in London works (set `S3_ENDPOINT` for non-AWS).

## 4. Email (Postmark)

Create a Postmark server, verify your sending domain, and copy the **Server API token**.

## 5. Vercel

1. https://vercel.com → **Add New → Project** → import `xTurtlez/waymark`. Framework: Next.js. Production branch: `main`.
2. **Environment variables** (Production):

| Name | Value |
|---|---|
| `DATABASE_URL` | the runtime URL |
| `BETTER_AUTH_SECRET` | 32+ random characters |
| `BETTER_AUTH_URL` | your production URL, e.g. `https://app.waymark.co.uk` |
| `MAIL_DRIVER` | `postmark` |
| `POSTMARK_SERVER_TOKEN` | from Postmark |
| `MAIL_FROM` | e.g. `Waymark <no-reply@yourdomain>` |
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET`, `S3_REGION` (`eu-west-2`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | from step 3 |
| `CRON_SECRET` | random string (Vercel sends it to the nightly job) |
| `REQUIRE_STAFF_MFA` | `1` (staff must set up TOTP or a passkey) |

   Do **not** set `DATABASE_ADMIN_URL` on Vercel: the app never needs owner access.
3. Deploy. `vercel.json` pins the functions to London and schedules the nightly audit-chain check.
4. Optional: Microsoft Entra sign-in for firm staff. Register an app in Entra, add the redirect `https://<your-domain>/api/auth/callback/microsoft`, then set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `MICROSOFT_TENANT_ID`.

## Notes

- **Cron frequency.** Vercel's Hobby plan runs crons once a day, which is enough for the audit check. The Transaction Engine's chasers (milestone 4) also run after each change; a paid plan allows hourly runs if needed.
- **Backups.** Neon keeps point-in-time history in the same region. Check the retention window on your plan matches the firm's policy.
- **Who can reach data.** The app connects as `waymark_runtime`, which cannot read firm data except through row-level security. Only the migration workflow uses the owner connection.
