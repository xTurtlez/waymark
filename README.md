# Waymark

Probate software for law firms in England & Wales. Firms license it; executors and families use a firm-branded portal for free.

> Waymark is a software product, not a law firm. It does not give legal advice or hold client money. Solicitors stay responsible for everything that leaves the system.

**Status: v2 in progress** (branch `v2`, plan in `docs/v2-plan.md`).
- Milestone 1 (Foundation): real database, accounts, row-level security, audit log, file storage, job queue.
- Milestone 2 (Real data model): the estate record in proper tables with real dates; stage, waiting-on and attention derived.
- Milestone 3 (Rules engine): Inheritance Tax and intestacy rules by date of death, with an explainable IHT workspace.
- Next: the Transaction Engine (M4), then the executor flow, Exceptions inbox and AI, and outputs.

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
- **The estate record.** Parties, staff, milestones, will and gifts, holdings, ledger, tasks, documents, extractions, drafts, messages, client updates and notes each have their own table. Every v1 screen reads and writes them through one audited server action.
- **Real dates.** Dates are stored as dates and timestamps; "Today", "Fri" and "3 weeks, overdue" are worked out on screen in UK time. Stage, who we're waiting on, the blocker line and needs-attention are derived from milestones and tasks, never typed in.

- **Inheritance Tax.** `src/rules/` is a pure engine: rates and thresholds are dated data with sources, picked by date of death. It covers the death estate, reliefs, spouse and charity exemptions (including the 36% rate), the residence nil-rate band (taper, transfer, downsizing), lifetime gifts, quick succession relief, pensions from April 2027, excepted estates and intestacy. Every figure in the IHT tab links to its rule, and the breakdown downloads as CSV. Uncertain points become flags a solicitor confirms (`docs/open-legal-questions.md`). Tax data is firm-only in the database; families never receive it.

Still to come: the Transaction Engine (M4), the executor flow (M5), the Exceptions inbox and model-backed AI (M6), and PDFs and outputs (M7).

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
| `npx vitest run` | Unit tests (including 69 worked IHT estates, 100% coverage enforced on `src/rules`) and database tests (RLS, audit chain, job queue). Needs a migrated database: set `DATABASE_URL` (runtime) and `DATABASE_ADMIN_URL` (owner) |
| `npx playwright test` | Live E2E at 1440px and 390px: sign-in, access rules, approve → audit → family update, upload → firm task, the IHT tab. Run `npm run build` and `npm run e2e:db` first |
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
  lib/            Shared logic: reducer, derive (stage, waiting-on...), iht (estate → engine), dates, store, selectors, types
  rules/          Pure tax and intestacy engine: dated rule tables, calculate, gifts, RNRB, reliefs, QSR, reporting
  server/         Server-only: actions, estate-store (load/save), auth, audit, files, jobs, mail, viewer, env
scripts/          migrate, seed, reset, runtime-role, e2e-db
drizzle/          SQL migrations (generated + hand-written roles, RLS, triggers)
tests/            Vitest unit and database tests
e2e/              Playwright (live and demo)
docs/             v2 plan, deploy guide, open legal questions
design-handoff/   Original design files
```

Design tokens live in `src/app/globals.css` under `@theme`. Colour carries meaning everywhere: **teal** done/primary, **coral** now/attention, **amber** waiting on the family, **plum** third parties and AI. Fonts (Newsreader, Figtree) are self-hosted. Icons are Phosphor via `react-icons/pi`.
