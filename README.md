# Waymark

Probate software for law firms in England & Wales. Firms license it; executors and families use a firm-branded portal for free.

> Waymark is a software product, not a law firm. It does not give legal advice or hold client money. Solicitors stay responsible for everything that leaves the system.

**Status: v2 in progress** (branch `v2`, plan in `docs/v2-plan.md`). Milestone 1 (Foundation) is built: real database, accounts, row-level security, audit log, file storage and job queue under the v1 screens. Later milestones (Transaction Engine, rules engine, executor flow, Exceptions inbox, AI, outputs) follow the brief's order.

## Two builds from one codebase

| | Live | Demo |
|---|---|---|
| What | The product, for pilot firms | The public prototype |
| Hosting | Vercel, London (`lhr1`) | GitHub Pages: https://xturtlez.github.io/waymark/ |
| Data | Postgres (London), real accounts | Seeded, in the visitor's browser only |
| Build | `npm run build` | `NEXT_PUBLIC_BASE_PATH=/waymark npm run build:demo` |

Files named `*.live.tsx` / `*.demo.tsx` are mode-specific (picked by `pageExtensions` in `next.config.ts`); everything else is shared, so both builds show the same screens.

## What's real (live build)

- **Accounts.** Staff sign in with email + password (with TOTP) or a passkey; Microsoft Entra SSO when configured. Executors and families sign in with a magic link. No public sign-up: firms invite people. Sign-in attempts are rate limited in Postgres.
- **Tenancy in the database.** Every tenant row carries `firm_id`, and Postgres row-level security decides what each request can see. The app connects as `waymark_runtime`, a login that owns nothing and cannot bypass RLS. It reaches firm data only by switching to `waymark_app` inside `withTenant()`. Family users additionally see only estates they are a party to. Tests prove cross-firm reads and writes fail.
- **Audit log.** `audit_event` is append-only (enforced by trigger and grants) and hash-chained per firm. `audit_verify()` recomputes the chain nightly. Every action records actor, time, IP, user agent and before/after values.
- **Files.** Uploads are checked by content (not file extension), size-capped, hashed (SHA-256) and malware-scanned before storage. Storage is S3 in `eu-west-2` with server-side encryption (local disk in development), served through access-checked routes.
- **Jobs.** A Postgres-backed queue: each job runs once even with several workers, retries back off, and duplicates are dropped. A Vercel cron drives it.
- **Screens.** Every v1 screen (practice dashboard, estate workspace with assistant panel, client portal) runs on the database through one audited server action.

Still to come in later milestones: the full domain model (M2), the tax rules engine (M3), the Transaction Engine (M4), the executor flow (M5), the Exceptions inbox and model-backed AI (M6), and PDFs and outputs (M7). Until M2, part of each estate's detail is stored as JSON on the estate row.

## Run it locally

Needs Node.js 22 and Postgres 16.

```bash
npm install
cp .env.example .env.local          # then edit the database URLs
# Fresh local database: migrate, set the runtime role's password, load demo firms
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/waymark RUNTIME_DB_PASSWORD=<16+ chars> npm run e2e:db
npm run dev
```

Sign in at http://localhost:3000/sign-in:
- **Staff:** `priya.shah@ellis-rowe.example` with password `waymark-demo-password` (or `SEED_STAFF_PASSWORD`).
- **Family:** `sarah.ellis@example.com`, then open http://localhost:3000/dev/outbox to follow the magic link.
- A second firm (Hartley Moss: `owen.price@hartley-moss.example`) shows that firms can't see each other's data.

For the browser-only demo: `npm run build:demo` and serve `out/`.

## Tests

| Command | What |
|---|---|
| `npm run lint`, `npm run typecheck` | ESLint (Next + React hooks rules) and TypeScript strict |
| `npx vitest run` | Unit tests and database tests (RLS, audit chain, job queue). Needs a migrated database: set `DATABASE_URL` (runtime) and `DATABASE_ADMIN_URL` (owner) |
| `npx playwright test` | Live E2E at 1440px and 390px: sign-in, access rules, approve → audit → family update, upload → firm task. Run `npm run build` and `npm run e2e:db` first |
| `E2E_MODE=demo npx playwright test` | Demo build E2E (after `build:demo`) |

CI (`.github/workflows/ci.yml`) runs all of these on every PR against Postgres 16.

## Deploying

See `docs/deploy.md`: Neon (London), S3 (London), Postmark and Vercel, set up from their dashboards, with database migrations run from the **Production database** GitHub Action.

## Project structure

```
src/
  app/            Routes. *.live.tsx = live only, *.demo.tsx = demo only
  components/     UI (brand, ui primitives, practice, portal, auth, shared)
  db/             Drizzle schema and client (withTenant, admin connection)
  lib/            Shared client logic: reducer, store, selectors, assistant seam, types
  server/         Server-only: actions, auth, audit, files, jobs, mail, viewer, env
scripts/          migrate, seed, reset, runtime-role, e2e-db
drizzle/          SQL migrations (generated + hand-written roles, RLS, triggers)
tests/            Vitest unit and database tests
e2e/              Playwright (live and demo)
docs/             v2 plan, deploy guide
design-handoff/   Original design files
```

Design tokens live in `src/app/globals.css` under `@theme`. Colour carries meaning everywhere: **teal** done/primary, **coral** now/attention, **amber** waiting on the family, **plum** third parties and AI. Fonts (Newsreader, Figtree) are self-hosted. Icons are Phosphor via `react-icons/pi`.
