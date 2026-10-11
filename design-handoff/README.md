# Handoff: Waymark marketing website (landing page)

## Overview
Waymark is SaaS probate software for law firms in England & Wales. Firms license it; their clients (executors, families) use a firm-branded portal for free. This handoff covers the **public marketing website** whose job is to convert law-firm buyers (partners, heads of private client, COLPs) into demo bookings.

Primary deliverable: `designs/Waymark - Landing Page.dc.html`.
Supporting references: brand exploration (`Waymark - Brand.dc.html`, chosen direction **4a Cairn**) and product UI mockups (Key Screens, Client Screens, Solicitor Workspace), which should be used for product screenshots and to keep the site and product visually identical.

Important positioning rule: Waymark is a **software product, not a law firm**. Copy must never imply Waymark gives legal advice or handles estates itself. The footer states: "Waymark is not a law firm and does not give legal advice."

## About the Design Files
The files in `designs/` are **design references built in HTML**. They're prototypes that show the intended look and behaviour, not production code to copy. They use a custom streaming component format (`.dc.html` + `support.js`) that exists only for the design tool, so don't port that runtime.

Task: **recreate the landing page in a proper web stack**. No codebase exists yet. Recommended: **Next.js (App Router) + TypeScript + Tailwind CSS** (or CSS Modules), statically generated, deployed on Vercel or similar. Map every value below to Tailwind theme tokens. Any modern static-capable framework (Astro, Remix) is acceptable.

To view the designs, open the `.dc.html` files in a browser with `support.js` in the same folder (internet needed for Google Fonts and Phosphor icons).

## Fidelity
**High-fidelity.** Colours, type, spacing, radii and copy are final. Recreate pixel-accurately. Placeholder content to replace before launch is listed under "Open items".

---

## Design Tokens

### Colour
| Token | Hex | Use |
|---|---|---|
| cream | `#FBF6EE` | Page background |
| paper | `#FFFDF9` | Cards, nav buttons, form panel |
| ink | `#2B211C` | Primary text |
| ink-2 | `#4A3F38` | Body text on cream/gradients |
| ink-3 | `#5E524A` | Secondary text |
| muted | `#7A6D63` | Captions, eyebrows (≥4.5:1 on cream) |
| line | `#EADFCF` | Borders, dividers |
| line-soft | `#F1E8DA` | Inner dividers, segmented-control track |
| line-strong | `#CFC2AF` | Input + secondary button borders |
| teal | `#0E5F5B` | Primary actions, "done" |
| teal-hover | `#0A4744` | Primary hover |
| teal-tint | `#DCEDE9` | Teal badges/backgrounds |
| deep-teal | `#103F3C` | Dark sections, featured plan |
| on-dark-2 | `#BFD3CD` | Body text on deep-teal |
| on-dark-3 | `#A9C2BB` | Secondary text on deep-teal |
| coral | `#E36E55` | "You are here", attention (fills only) |
| coral-ink | `#A83E28` | Coral text |
| coral-tint | `#FBE0D8` | Coral badge bg |
| amber | `#E3A13A` | Waiting on family, accents on dark |
| amber-ink | `#8A5508` | Amber text |
| amber-tint | `#FBEBCF` | Amber badge bg |
| plum | `#5B2E57` | Third parties, AI |
| plum-tint | `#EEDFEA` | Plum badge bg |
| plum-line | `#B78FB0` | Plum outline buttons, AI dashed border |

Semantic rule used across the product: **teal = done/primary, coral = now/attention, amber = waiting on the family, plum = third parties & AI.**

**Sunrise gradient** (hero glow + demo CTA): `linear-gradient(160deg, #FCE6C9 0%, #F8CDB8 45%, #EFC9D6 100%)`. Hero glow: `radial-gradient(circle, rgba(248,205,184,.85), rgba(252,230,201,.5) 45%, rgba(251,246,238,0) 70%)`, 720px circle, positioned right −220px, top −160px.

### Typography
- **Newsreader** (Google Fonts, opsz 6..72, weights 400/500/600): headings, wordmark, prices. Uses negative tracking.
- **Figtree** (Google Fonts, 400/500/600/700): all UI and body.

| Role | Spec |
|---|---|
| H1 (hero) | Newsreader 400, `clamp(44px, 6vw, 74px)`, line-height 1.02, letter-spacing −0.025em, `text-wrap: balance` |
| H2 section | Newsreader 400, `clamp(36px, 4.4vw, 54px)` (some sections 34–52 / 32–46), lh 1.06, ls −0.02em |
| H3 card | Newsreader 500, 26px, lh 1.15 |
| Wordmark | Newsreader 500, 28px (nav) / 24px (footer), ls −0.02em |
| Lead | Figtree 400, 18–19px, lh 1.55–1.6 |
| Body | Figtree 400, 16px, lh 1.6 |
| Eyebrow | Figtree 600, 13px, ls 0.06em, uppercase |
| Button | Figtree 600, 17px (large) / 15px (nav) |
| Pill/badge | Figtree 600, 12–14px |

### Radius
8 (icon tiles 12), 14 (nav button, inputs, segmented), 16 (small cards, rows), 18 (large buttons), 24 (panels, security grid), 28 (feature/pricing cards, form), 40 (full-bleed rounded sections), 99 (pills).

### Shadows
- Product card: `0 40px 80px -30px rgba(43,33,28,.35)`
- Phone: `0 40px 70px -24px rgba(43,33,28,.5)`
- AI chip: `0 20px 40px -16px rgba(91,46,87,.5)`
- Draft card on dark: `0 40px 80px -30px rgba(0,0,0,.5)`

### Spacing & layout
- Content max-width **1280px**; rounded full-bleed sections max-width **1340px** with 12–24px outer gutter.
- Horizontal page padding: `clamp(20px, 4vw, 48px)`.
- Section vertical padding: 96–110px. Section internal padding for rounded sections: `clamp(40px,6vw,80px) clamp(24px,5vw,72px)`.
- Two-column sections use `grid-template-columns: repeat(auto-fit, minmax(min(100%, 420–460px), 1fr))` with gaps of 40–64px, so they collapse to one column on narrow screens. Card grids use `minmax(min(100%, 260–340px), 1fr)`.
- `box-sizing: border-box` globally.

---

## Page: Landing (`/`)
Top to bottom. All copy below is final unless marked.

### 1. Header / nav
Flex row, wraps on mobile, padding 22px horizontal gutter.
- Logo: cairn mark (34px, `assets/waymark-cairn.svg`) + wordmark "Waymark", gap 10px.
- Links (Figtree 500 15px, ink-2, gap 26px): Product `#product`, AI assistant `#assistant`, For your clients `#families`, Security `#security`, Pricing `#pricing`.
- Right: "Sign in" (text, 600 15px) and **"Book a demo"** (44px tall, radius 14, teal bg, paper text, hover teal-hover) → `#demo`.
- Build note: on <900px collapse links into a menu button (not designed; use a simple full-screen sheet in cream).

### 2. Hero
Two-column auto-fit grid (min 460px), gap 56px, padding-top `clamp(32px,6vw,72px)`, bottom 80px. Sunrise radial glow behind the right column.
- Pill: "Probate software for firms in England & Wales" (teal-tint bg, teal text, 600 14px, padding 7×14).
- H1: "Every estate, every blocker, one calm workspace."
- Lead (max 560px): "Waymark gives your private client team a live view of every estate, an assistant that drafts and reads documents under your review, and a portal that keeps families informed so they don't have to call."
- CTAs (gap 12, wrap): Primary "Book a demo →" (56px, radius 18, teal). Secondary "Watch the 3-minute tour" with coral play icon (56px, radius 18, paper bg, 1.5px line-strong border).
- Small print (14px muted): "30-day pilot on your live estates. Migration from your case management system included." *(placeholder offer, confirm)*
- **Right visual** (min-height 520px, relative), three layered elements:
  1. Dashboard card (absolute, left 0, right 60px, top 20px; paper, radius 24, line border): title "Needs attention" + coral pill "4 estates"; four rows (cream bg, radius 16) each with estate name, a 7-segment stage bar (5px tall, gap 3, teal for done / coral for current / line for future) and a blocker chip coloured by who it's waiting on. Rows: Margaret Ellis (stage 3, "Barclays · 21 days", plum), Kwame Asante (3, "Aviva pension · overdue", coral), Anil Mehta (4, "HMRC query · 12 days left", coral), Jean Whitfield (2, "With David · original will", amber).
  2. Phone (absolute right 0 bottom 0, 250px wide, 7px #1E1815 bezel, radius 40/33): client journey preview, firm-branded "Ellis & Rowe", "Good evening, Sarah.", task card "Let's list what Margaret owned" + Begin button, 3 stage rows.
  3. Plum chip (absolute left 24 bottom 40): sparkle icon + "3 letters drafted · awaiting your review".
  - Recommended build: create these as real components (reused from the product UI) or export as high-res images. Gentle entrance motion is welcome (fade/translate 12px, 400ms ease-out, staggered 80ms); respect `prefers-reduced-motion`.

### 3. Stage strip
Full-width paper band, borders top/bottom. Label "COVERS THE WHOLE ADMINISTRATION" + 7 numbered stages (26px circles): Register, Gather, Value, IHT, Probate, Collect & pay, Distribute. Circle colours: teal, teal, amber, amber, coral, coral, plum. Wraps on mobile.

### 4. Product pillars `#product`
- Header grid: H2 "Built for teams running forty estates, not one." + paragraph "Each stone in our mark is one part of the job. Waymark stacks them in one place, so a partner can see the whole caseload and a paralegal knows exactly what to do next."
- Three cards (paper, radius 28, padding 30, line border). Each shows the cairn mark at 56px, **building up** from card to card: card 1 base stone teal (others line colour); card 2 base + middle (amber); card 3 all three (coral top).
  1. "See what's blocked, and on whom". Body: "Every estate as a card, with its stage, days open, and whether it's waiting on the family, a bank, HMRC or the Probate Registry." Proof: "\"Needs attention\" view surfaces overdue items automatically"
  2. "One workspace per estate". Body: "Parties, assets, liabilities, IHT position, documents, tasks and notes in one place, with a full audit trail behind every change." Proof: "Live IHT position against NRB and RNRB"
  3. "Families who don't need to chase". Body: "Clients see progress, upload documents from their phone and read plain-English updates in your firm's name." Proof: "Updates post automatically as you work"
- Proof line: teal 600 14px, separated by top border line-soft.

### 5. AI assistant `#assistant`
Rounded section (radius 40, deep-teal bg), two columns, amber radial glow bottom-left.
- Eyebrow (amber): sparkle + "THE ASSISTANT".
- H2 (cream): "It does the first draft. You keep the final word."
- Lead (on-dark-2): "Nothing goes to a bank, HMRC or a client until a solicitor approves it. Every draft, edit and approval is logged against the estate."
- 2×2 feature list (40px icon tiles, rgba(255,255,255,.08), amber icons): Drafts letters / Reads documents / Flags what's missing / Summarises the estate, each with one line of text (see source file).
- Right: draft letter card (paper, radius 24): dashed plum pill "Draft · needs your review", recipient, excerpt with the extracted date highlighted in amber-tint, "Sources" line in plum, buttons Edit (plum outline) and "Approve & send" (teal).

### 6. For your clients `#families`
Two columns, gap 64.
- Left: square sunrise circle (max 420px, radius 50%) containing a phone-shaped placeholder (height 84%, aspect 9/16, centred, 6px #1E1815 border, radius 22). **Placeholder: replace with a looping screen recording of the client journey** (MP4/WebM, muted, autoplay, playsinline; poster image).
- Eyebrow (coral-ink): "FOR YOUR CLIENTS". H2: "Families feel looked after. Your phones go quiet." Lead: "Executors get a portal in your firm's name. It shows one clear step at a time, explains legal terms when they tap them, and tells them what you've done on their behalf."
- Four ticked lines (teal check): "**Your name, not ours.** The portal carries your firm's branding." / "**Plain English throughout.** Legal terms explained on tap." / "**Made for phones.** Executors upload documents with their camera." / "**A clear general-guidance assistant.** It answers \"what does this mean?\" and hands anything specific to you."

### 7. Security `#security`
Paper band. H2: "Built to satisfy your COLP and your clients." Grid of 6 cells separated by 1px line (implemented as grid gap 1px over line-coloured bg, outer radius 24). Each: 26px teal Phosphor icon, title 600 17px, body 15px. Items: UK data residency; Encrypted end to end; Immutable audit trail; Role-based access; Client ID checks; Fits your stack. **All claims are placeholders that must be confirmed with engineering/legal before launch.** Add real certification badges here (e.g. Cyber Essentials Plus, ISO 27001) only if they are actually held.

### 8. Pricing `#pricing` (toggleable section)
- H2 "Simple pricing, per fee earner." + sub "Unlimited estates and client portals on every plan."
- Segmented control (track line-soft, radius 14; active segment paper): "Monthly" / "Annual · save 15%". **Default: Annual.** Annual price = round(monthly × 0.85).
- Three plan cards (radius 28, padding 30):
  - **Team**, £79 monthly / £67 annual "per fee earner / month". Paper.
  - **Practice**, £129 / £110. **Featured**: deep-teal bg, cream text, amber "Most chosen" tag, amber ticks, amber CTA with ink text.
  - **Enterprise**, "Custom".
  - Feature lists and CTAs ("Start a pilot", "Book a demo", "Talk to us") as in the source file. All CTAs → `#demo`.
- **Prices are placeholders.** Put plan data in a CMS or config file. The whole section should be hideable with a feature flag (`showPricing`).

### 9. Book a demo `#demo`
Rounded section (radius 40, sunrise gradient) with a large faded cairn (360px, opacity .16) bottom-right.
- H2: "See Waymark with one of your own estates." Lead: "A 30-minute call with our product team. Bring a live matter, anonymised, and we'll set it up while you watch."
- Form panel (paper, radius 28, padding 28, 2-col grid gap 14):
  - Your name (required), Firm (required), Work email (full width, required, email format; consider blocking free-mail domains with a gentle message).
  - "Estates you handle each year": single-select pill group: Under 50 / 50–200 / 200–500 / 500+ (default 50–200). Selected: teal bg, white text.
  - Submit "Book my demo →" (56px, radius 18, teal).
  - Inputs: 50px tall, radius 14, 1.5px line-strong border, cream fill, 16px text. Add a focus ring: 2px teal outline, 2px offset.
  - Not designed, please implement: inline error text in coral-ink 14px under the field; loading state on the button (spinner, disabled); success state replacing the form with "Thank you, [name]. We'll be in touch within one working day." plus an optional calendar embed (Cal.com/Calendly). Send submissions to the CRM (HubSpot or similar) and an email notification.

### 10. Footer
Logo (28px) + "Waymark"; text: "Probate, one clear step at a time. Software for law firms. Waymark is not a law firm and does not give legal advice." Link columns Product (Workspace, Assistant, Client portal) and Company (Security, Pricing, Contact). Add before launch: Privacy policy, Terms, Cookie notice, company registration number and registered address.

---

## Interactions & Behaviour
- Anchor links scroll smoothly (`scroll-behavior: smooth`; sticky header offset via `scroll-margin-top`).
- Primary buttons: hover bg `#0A4744`, 150ms. Secondary/outline: hover bg cream. All interactive targets ≥44px.
- Pricing toggle swaps prices instantly (optional 150ms number crossfade).
- Demo size pills behave as a radio group (`role="radiogroup"`, arrow-key navigation).
- Motion: subtle, slow, calm. No bouncy easing. Respect `prefers-reduced-motion`.
- Responsive: designed fluid from 360px to 1440px+. All multi-column grids collapse via auto-fit. Below ~600px the hero visual should stack: dashboard card full width, then the phone centred below (switch from absolute to flow layout).

## State
- `billing: 'monthly' | 'annual'` (default annual)
- `estateVolume: 0..3` (default 1)
- Demo form: field values, validation errors, `status: idle | submitting | success | error`
- Feature flag: `showPricing` (default true)

## Accessibility
WCAG 2.2 AA. Text colours above are chosen for ≥4.5:1 on their backgrounds. Never put coral `#E36E55` or amber `#E3A13A` text on light backgrounds; use the `-ink` variants. Semantic landmarks (`header`, `nav`, `main`, `section` with headings, `footer`), labelled inputs, visible focus states, alt text for product imagery.

## SEO / meta (not designed)
Title: "Waymark: probate software for law firms in England & Wales". Description from hero lead. OG image: cairn mark on cream with the H1. Favicon: cairn SVG (at 16px use the simplified mark without rotation if it blurs).

## Assets
- `assets/waymark-cairn.svg`: primary mark (teal / amber / coral).
- `assets/waymark-cairn-reversed.svg`: for deep-teal backgrounds (cream base stone).
- Icons: **Phosphor Icons** (regular / bold / fill), `@phosphor-icons/react` recommended. Used: arrow-right, play-circle, check, sparkle, envelope-simple, scan, warning-circle, text-align-left, map-pin, lock-key, list-checks, users-three, identification-card, plugs-connected.
- Fonts: Newsreader and Figtree from Google Fonts (self-host via `next/font`).
- Needed from the client: client-journey screen recording, real product screenshots (or build from the product mockups), confirmed pricing, confirmed security claims, legal pages.

## Files
- `designs/Waymark - Landing Page.dc.html`: **the page to build**
- `designs/Waymark - Brand.dc.html`: logo directions; chosen = 4a Cairn (lockups on light/dark, app icon, small sizes)
- `designs/Waymark - Key Screens.dc.html`: product foundations (colour, type, components), client Journey, practice dashboard
- `designs/Waymark - Client Screens.dc.html`: onboarding, today's step, document vault, assets & debts, messages, updates
- `designs/Waymark - Solicitor Workspace.dc.html`: estate workspace + AI assistant panel
- `designs/support.js`: design-tool runtime, needed only to open the `.dc.html` files locally

Note: the product mockups still show an earlier squiggle logo. Use the cairn everywhere.

## Open items before launch
1. Confirm pricing and the pilot offer.
2. Confirm every security/compliance claim.
3. Supply the journey recording and product imagery.
4. Mobile nav sheet, form error/success states, legal pages (specified above, not designed).
