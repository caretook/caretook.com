# Plan: Marketing site

> Source PRD: [`plans/marketing-prd.md`](marketing-prd.md). User-story numbers (US) refer to it. Backlog item B-32. Topic `marketing`.

## Status

| Slice | State                                   | Merge into `prd/marketing` (slice commits) |
| ----- | --------------------------------------- | ------------------------------------------ |
| 1     | **landed in `dev`** (wave 1, `c59898d`) | `3eb46f0` (`32ab6a6`, `672687e`)           |
| 2     | **landed in `dev`** (wave 2, `249ba1c`) | `20860b7` (`9f0813f`, `c3fb347`)           |
| 3     | **landed in `dev`** (wave 2, `249ba1c`) | `498be06` (`ee7f320`, `0c5bd0f`)           |
| 4     | **landed in `dev`** (wave 3)            | `1ac4bd2` (`9602ad0`, `583e5d5`)           |
| 5     | **landed in `dev`** (wave 3)            | `87a9d35` (`0a7a7f8`, `6a9b7d6`)           |

Backlog: B-32 is done (all five slices merged). B-40 (real screenshots) waits until the user has a launch-ready product map: don't generate screenshots before then. B-54 (privacy policy and terms) is triaged here: the drafts exist; what's left is the user's review and removing the DRAFT banners.

Wave 1 notes: home loads ~129 KB gzipped JS (over the ~100 KB budget; ~110 KB is React and React Router). `/join` 404s until `invites` builds it. `marketing.mjs` screenshots are off unless `MARKETING_SHOTS=1` (a full-page capture hung it for an hour); always run checks with `--timeout`. The user asked for minimal testing: no app checks unless app code changes, and marketing checks skip the shared queue with `CARETOOK_BROWSER_SLOTS=4`.

Wave 2 notes: screenshots are SVG placeholders (`public/screenshots/<name>.svg`) until launch (B-40; the generator `marketing-screenshots.mjs` is kept). Providers is a main feature on `/features` (it's in `dev`); medications stays coming soon. The legal pages have `[Review: …]` notes for the user: what account deletion removes, soft-deleted entries not purged, and group deletion untested end to end. B-30 has a note: `invites` slice 3's consent screen links to `/privacy` and `/health-data-privacy`. In-page hash links on marketing pages use React Router `Link`, or ScrollRestoration jumps back.

Wave 3 notes: the sync with `dev` brought `medications`' migration 0013, so the waitlist and contact migration is 0014 (the same SQL, regenerated). Home's JS grew about 11 KB gzipped (the oRPC client and `PublicForm`). The CSV export has no row cap. Dates on the admin waitlist are UTC.

## Architectural decisions

Durable decisions every slice follows:

- **Web build only.** Marketing routes sit under one marketing layout in `routes.ts`'s web-only list (appended). Native's `/` still redirects to `/app`. Marketing modules never import from `routes/app/`, `lib/sync/` or the editor, and no sync or editor chunk loads on a marketing page.
- **Routes:** `/`, `/features`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms`, `/health-data-privacy`, `/sitemap.xml`, `/robots.txt`; the admin waitlist is `/admin/waitlist` (in `invites`' admin frame).
- **Prerendered** at build for the web target. Forms post through oRPC from the client.
- **Copy lives in typed content modules** beside each page, rendered by shared marketing section components (hero, feature grid, steps, promise, FAQ list, CTA band, legal page). Copy changes never touch layout.
- **Every page has** one `h1`, a title and description through `marketingMeta`, a canonical URL from `APP_URL`, and Open Graph and Twitter tags; images have alt text and responsive sources.
- **No third-party requests** (no fonts, scripts, analytics or embeds). No new dependencies.
- **Fictional data only** in screenshots.
- **Legal pages carry a DRAFT banner** until the user says they've been reviewed.
- **Registries are appended to:** `routes.ts`, `PERMISSIONS`, `db/schema/index.ts`, the router, `NOTIFICATIONS`, the admin nav.

## How to run this plan

- **Slice 1 starts now**, beside any other PRD: it touches only marketing routes, the public folder, `react-router.config.ts` (prerender) and `root.tsx`'s icon and meta defaults.
- **2 and 3 after 1, in parallel.**
- **4 after 1 and after `invites` slice 1 lands** (the outbox and `/dev/mail`). **5 after 4 and after `invites` slice 5 lands** (the `/admin` frame).
- Merge in number order. After each merge run `marketing.mjs` (the only check these areas need), plus `sign-in.mjs` when the header's Sign in or the theme script changes, and `invites.mjs` for slice 3's consent-screen link and slice 5. The full suite runs once per landing.
- **Land in waves:** 1; then 2 and 3 (a complete public site); then 4; then 5.
- Every slice ends with `pnpm check`, `pnpm build` (web, with prerender), `pnpm build:native`, its checks and a hand-off (AGENTS.md, _Loop rules_). Hand-offs include screenshots of each page they touched at 420 and 1280, light and dark.

```
1 ──┬── 2
    ├── 3
    └── 4 ── 5
invites 1 → 4 · invites 5 → 5
```

---

## Slice 1: The frame and the home page

**User stories:** US 1–3, 5, 6, 9, 10, 18–23, 28, 30. **Blocked by:** none. **Blocks:** 2, 3, 4.

### What to build

The marketing layout (header with the wordmark, Features, FAQ, About, Sign in and "Join the waitlist", a keyboard-usable menu on phones, a skip link; a footer with the pages and legal links; light and dark through the existing theme script) and the section components. Draft brand assets: an SVG wordmark and icon, a favicon set, apple-touch-icon, a web manifest, and a default 1200×630 Open Graph image, in a new public folder. `marketingMeta`, `sitemap.xml` and `robots.txt` (marketing routes allowed; `/app`, `/admin`, `/invite`, `/join`, `/api`, `/rpc` and `/dev` disallowed), and `Organization` JSON-LD on home. Prerendering for the web target. The home page from its content module, following the PRD's messaging points: hero, what it helps with, how it works, the privacy promise, "Free while in early access", and the calls to action ("Join the waitlist" scrolls to a waitlist band that says "Coming soon" until slice 4; "Have an access code?" goes to `/join`). An empty `MarketingAnalytics` hook point. Routes for the other pages may exist as stubs linked from the nav (slices 2 and 3 fill them). Start `marketing.mjs`.

### Acceptance criteria

- [ ] Home renders at 420 and 1280, light and dark, with one `h1`, landmarks, a working skip link and visible focus; the phone menu opens, traps nothing, and closes with Escape.
- [ ] Meta, canonical, Open Graph, Twitter and JSON-LD are present; `sitemap.xml` and `robots.txt` match the rules above.
- [ ] The prerendered HTML for `/` is in the web build output; the page loads no sync, editor or `/app` chunk, and makes no third-party request.
- [ ] Sign in reaches `/sign-in`; the theme follows the device, and a stored app theme choice applies.
- [ ] Unit tests for `marketingMeta`, the sitemap and robots rules, and the home content module's shape.
- [ ] `pnpm build:native` contains no marketing route; `marketing.mjs` covers the above; `sign-in.mjs` passes.

---

## Slice 2: Features, About and FAQ

**User stories:** US 4, 11–14, 29. **Blocked by:** 1. **Blocks:** none.

### What to build

A screenshot script beside the browser checks that signs in as the seed users and captures the timeline (rows and cards), a live note being written, the vitals line, the Live now banner and the group's members, at 420 px, light and dark, as optimized WebP in the public folder (rerunnable; documented in the hand-off). The features page (the timeline, live notes and events written together, sharing and roles, offline, and "Coming soon" for medications and providers), the About page (why Caretook exists, who's behind it, from a content module the user edits), and the FAQ (cost, who can see what, viewers vs caretakers, security and encryption, offline, leaving a group, deleting your data, what happens to data when a group is deleted) with `FAQPage` JSON-LD. Home's feature section gains the screenshots.

### Acceptance criteria

- [ ] The screenshot script runs against a loop's stack and regenerates every image; the images show only seed data.
- [ ] Each page renders at 420 and 1280, light and dark, with one `h1`; every screenshot has descriptive alt text, responsive sources and lazy loading below the fold.
- [ ] The FAQ's JSON-LD matches its visible questions.
- [ ] Unit tests for the content modules' shape (titles, descriptions, alt text, FAQ items).
- [ ] `marketing.mjs` covers the new pages.

---

## Slice 3: Privacy, terms and the health data notice

**User stories:** US 16, 17, 24, 28. **Blocked by:** 1. **Blocks:** none.

### What to build

Draft `/privacy`, `/terms` and `/health-data-privacy` from content modules, through one legal page component (a DRAFT banner, a "last updated" date, a table of contents for long pages, anchors on headings). Written to AGENTS.md's _Compliance_ section: outside HIPAA; the FTC Health Breach Notification Rule; Washington's My Health My Data Act (what consumer health data is collected, why, who it's shared with, and how to exercise rights); no ad or analytics tools that see health data; consent before sharing in a care group; deletion; encryption at rest; AI vendors that don't retain or train; how to contact us about privacy. Plain language first, with the formal text below each plain summary. Footer links. If `invites` slice 3 is in `dev`, link the invite consent screen to `/privacy` and `/health-data-privacy`; otherwise tell the `invites` orchestrator to add the links.

### Acceptance criteria

- [ ] All three pages render with the DRAFT banner, the date and working heading anchors, at 420 and 1280, light and dark.
- [ ] Every point in AGENTS.md's _Compliance_ section is covered in the hand-off's checklist, with where it appears.
- [ ] The consent screen links to both pages (or the hand-off says who adds them).
- [ ] `marketing.mjs` covers the pages; `invites.mjs` passes if the consent screen changed.

---

## Slice 4: The waitlist and contact

**User stories:** US 7, 8, 15, 26, 27. **Blocked by:** 1, `invites` slice 1. **Blocks:** 5.

### What to build

`waitlist_entry` and `contact_message` tables (one migration, staff-only reads, no IP or user agent stored), their Zod schemas, and services. Public oRPC `public.waitlist.join` (repeat emails update the entry and get the same thanks) and `public.contact.send` (stores the message and enqueues `contactMessage` to `SUPPORT_EMAIL` in one transaction; privacy topics flagged in the subject). Spam rules: a honeypot field, a minimum time on page, and a per-IP rate limit; no CAPTCHA. The waitlist form in home's band and on its own anchor (email, first name, who you care for, how you heard, plus the page and UTM params as `source`), and the `/contact` page with its form. Both show an in-page thanks and field errors. `SUPPORT_EMAIL` is documented and copied into worktrees.

### Acceptance criteria

- [ ] Joining the waitlist stores one entry and thanks the visitor; joining again with the same email (different case) updates it and shows the same thanks.
- [ ] Contact stores the message and its mail appears at `/dev/mail`, addressed to `SUPPORT_EMAIL`; a privacy topic is flagged.
- [ ] A filled honeypot, or a submit faster than the minimum, stores nothing but shows the thanks; the rate limit refuses after its limit.
- [ ] The forms are usable by keyboard and screen reader (labels, errors linked to fields, a polite thanks announcement).
- [ ] Unit tests for the schemas and the spam rules; integration tests for both endpoints.
- [ ] `marketing.mjs` covers the above (entries checked with `psql`, cleaned up afterwards).

---

## Slice 5: The admin waitlist

**User stories:** US 25. **Blocked by:** 4, `invites` slice 5. **Blocks:** none.

### What to build

`/admin/waitlist` in `invites`' admin frame (global `admin`, web only, server loader allowed): a read-only list (newest first, paginated) with filters for date range, who they care for and source, a count, and a CSV export of the filtered rows (UTF-8, escaped). Contact messages aren't listed (they're in the support inbox). An admin nav entry appended.

### Acceptance criteria

- [ ] admin@ sees the waitlist with filters and a matching count; the export downloads exactly the filtered rows, with commas, quotes and newlines escaped.
- [ ] Group owners and other members get the admin refusal; the page shows nothing beyond what visitors typed.
- [ ] Unit tests for the CSV export; an integration test for admin-only access.
- [ ] `marketing.mjs` and `invites.mjs` pass.

---

## For the orchestrator

- **Claim:** B-32 when slice 1 starts. Mark it `done` after the last slice merges.
- **Before slices 4 and 5,** check that `invites` slices 1 and 5 are in `dev`, then `pnpm prd sync`.
- **Show the user** the draft logo, the home page and the legal pages at each landing; copy and the logo are theirs to approve. Don't remove the DRAFT banners until they say the legal text is reviewed.
- **AGENTS.md at landing:** a _Marketing site_ section (web-only routes, prerendering, content modules, the no-third-party rule, the screenshot script), `marketing.mjs` in the browser checks list and the budget table, and the waitlist and contact tables in the domain notes.
