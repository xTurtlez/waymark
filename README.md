# Waymark

Probate software for law firms in England & Wales. Firms license it; executors and families use a firm-branded portal for free.

This repository is the **first working build of the product**: the solicitor's practice workspace and the client portal, built from the design handoff in `design-handoff/`. Both sides share one data store, so an action on one side shows up on the other.

> Waymark is a software product, not a law firm, and does not give legal advice.

## Live demo

Every push to `main` builds the app and publishes it to GitHub Pages (see `.github/workflows/deploy.yml`). The site is a static export: everything runs in the browser, so no server is needed.

One-time setup on a new repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Run it locally

Requires **Node.js 20.9 or later**.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and choose a side:

| Route | What it is | Design ref |
|---|---|---|
| `/` | Demo entry: pick practice or portal, reset demo data | – |
| `/practice` | Practice dashboard: filter tabs, search, stage/fee-earner/sort, "who we're waiting on", assistant queue, **New estate** | Key Screens 1b |
| `/practice/estate?id=ellis` | Estate workspace: stage strip, 10 tabs, tasks, ledger, IHT, parties, documents, notes, audit trail, messages, plus the **assistant panel** (Draft / Extract / Missing / Summary / Ask) | Solicitor Workspace 3a |
| `/practice/estates` | Caseload as a dense table | – |
| `/practice/tasks`, `/documents`, `/letters`, `/drafts`, `/settings` | Cross-estate views | – |
| `/portal` | Client journey: today's step, the winding 7-stage path, honest timeline, plain-English terms | Key Screens 1a |
| `/portal/welcome` | Onboarding (4 steps) | Client Screens 2a |
| `/portal/step` | Today's step, with add-an-account sheet | 2b |
| `/portal/documents` | Document vault with camera/file upload | 2c |
| `/portal/assets` | What they owned and owed, add something | 2d |
| `/portal/messages` | Messages with the solicitor + "Ask Waymark" general-guidance assistant | 2e |
| `/portal/updates` | What's been done on their behalf | 2f |

**Try this:** open `/practice/estate?id=ellis` in one tab and `/portal` in another. Approve the Barclays draft and the family gets an update. Upload the funeral invoice in the portal and a "Check funeral invoice" task appears for Priya. Tabs stay in sync.

## What's real and what's mocked

Real, working now:
- Every screen in the handoff, responsive from 360px to wide desktop.
- Shared state across practice and portal (approvals, uploads, messages, assets, tasks, notes, audit entries), persisted in the browser's localStorage and synced across tabs.
- Human-in-the-loop rules: nothing an AI draft produces is "sent" until a solicitor approves it; extracted fields flagged low-confidence must be ticked before they're added; every approval and edit is written to the audit trail.
- Live IHT estimate from the ledger (NRB £325k + RNRB £175k when a home is present).
- Validation, empty states, keyboard focus states, labelled controls, `prefers-reduced-motion`.

Mocked (deliberately, behind clear seams):
- **Data**: seeded in `src/lib/seed.ts`; the reducer in `src/lib/store.tsx` is the stand-in for an API. Action names map 1:1 to future endpoints.
- **Assistant**: `src/lib/assistant.ts` is rule-based so the demo works offline. Swap it for a model-backed endpoint that returns the same `{ paragraphs, handoff }` shape.
- **Uploads**: files aren't stored; only the file name is recorded.
- **Auth**: the demo signs you in as Priya Shah (practice) or Sarah Ellis (portal).
- **Sending**: "Approve & send" changes status and logs it; nothing leaves the app.

## Project structure

```
src/
  app/                    Next.js App Router routes (practice/*, portal/*)
  components/
    brand/Cairn.tsx       The cairn mark and wordmark (brand direction 4a)
    ui/                   Primitives (buttons, stage bar, avatar) and the Sheet modal
    practice/             Practice shell, estate card, workspace sections, assistant panel
    portal/               Portal shell, bottom nav, journey path
    shared/               Add-asset sheet and asset/document metadata
  lib/
    types.ts              Domain model (shaped like DB rows; money in pence)
    seed.ts               Demo data: Margaret Ellis + 8 other estates
    store.tsx             Shared reducer, persistence, cross-tab sync
    selectors.ts          Derived values: IHT, totals, waiting-on counts, summaries
    assistant.ts          Assistant seam (client guidance + firm Q&A)
    stages.ts             The 7 stages and colour semantics
design-handoff/           Original design files (open the .dc.html files in a browser)
```

Design tokens live in `src/app/globals.css` under `@theme` (Tailwind v4). Colour carries meaning everywhere: **teal** done/primary, **coral** now/attention, **amber** waiting on the family, **plum** third parties and AI. Never put coral or amber text on light backgrounds; use the `-ink` variants.

Icons are Phosphor, via `react-icons/pi`.

## Suggested next steps

1. **Backend and auth**: Postgres (Prisma or Drizzle) with firm → estate → party tenancy; separate roles for fee earners, paralegals and clients; magic-link sign-in for executors. Replace `useActions()` internals with API calls.
2. **Audit log**: append-only table written server-side on every mutation (the UI already shows it).
3. **Document storage**: UK-region object storage, virus scanning, signed URLs; keep the "checking → accepted" workflow.
4. **Assistant**: model-backed drafting and extraction behind the existing review gates; store sources with every draft; keep the client assistant to general guidance with a handoff to the solicitor.
5. **Firm branding**: per-firm name, colours and logo for the portal (Settings page has a preview).
6. **Compliance**: confirm the security claims in the handoff (UK data residency, encryption, ID checks) before anything is said publicly.
7. **Marketing site**: the landing page in `design-handoff/designs/Waymark - Landing Page.dc.html` is fully specified and not built yet.
