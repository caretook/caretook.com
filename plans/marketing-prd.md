# PRD: Marketing site (landing page, features, about, FAQ, legal, waitlist, contact)

Status: 🟡 planned in [`marketing-plan.md`](marketing-plan.md) (5 slices; slice 1 can start now). Backlog item: B-32. Topic `marketing`. Web build only; it doesn't touch `/app`, so it runs beside every other PRD. The waitlist and contact forms use `invites`' notifications outbox, and the admin list uses its `/admin` pages.

## Problem Statement

caretook.com is a placeholder. A family member who hears about Caretook, or is sent an invite, has nowhere to learn what it is, whether it's safe for their parent's health information, or how to get in. Caretook is invitation-only, so someone without an invite or access code has no way to say "I'm interested" and no way to reach the team. There's no privacy policy or terms, which a health-data app needs before anyone signs up, and which the invite consent screen should link to. There's also no logo, favicon or share image, so a shared link looks broken.

## Solution

A small, fast, calm public site for family caretakers (adult children, spouses and siblings coordinating someone's care), built on the same stack and served only by the web build:

- **Home:** what Caretook does in one sentence, the three or four things it helps with, how it works (a shared care group, invite family, log from any phone, even offline), a privacy promise, "Free while in early access", and two calls to action: **Join the waitlist**, and **Have an access code?** (to `/join/:code`). Sign in is in the header.
- **Features:** the care timeline, live notes and events written together, sharing with family and the roles, and what's coming (medications, providers), with real app screenshots made from fictional data.
- **About**, **FAQ** (cost, who can see what, security, offline, leaving a group, deleting data) and **Contact** (a form that emails the team).
- **Privacy policy**, **Terms**, and a **consumer health data privacy notice**: drafts marked DRAFT until legal review, written to Caretook's compliance rules.
- **A waitlist** (email, first name, who you care for, how you heard) that staff can see and export from `/admin`.
- A draft **logo, favicon and share image**, plus the SEO basics.

Pages are prerendered at build, carry none of the app's sync or editor code, and follow the device's light or dark theme.

## User Stories

1. As a family caretaker who heard about Caretook, I want to understand what it does within a few seconds, so that I know if it's for me.
2. As a caretaker, I want to see the main things it helps with (a shared timeline, notes written together, family sharing), so that I can picture using it.
3. As a caretaker, I want to see how it works in a few steps, so that it doesn't seem complicated.
4. As a caretaker, I want real screenshots of the app, so that I know what I'm getting.
5. As a caretaker worried about privacy, I want a clear promise about who sees the data and what Caretook never does with it (no ads, no selling, no tracking), so that I can trust it.
6. As a caretaker, I want to know it's free while in early access, so that cost isn't a question.
7. As someone without an invite, I want to join a waitlist, so that I hear when I can start.
8. As someone on the waitlist, I want to say who I care for and how I heard, optionally, so that the team understands me.
9. As someone with an access code, I want an obvious "Have an access code?" link, so that I can start right away.
10. As an existing user, I want Sign in in the header, so that the site gets me to the app.
11. As a caretaker, I want a features page that explains each part in plain language, so that I can show it to my siblings.
12. As a caretaker, I want to see what's coming (medications, providers), so that I know where it's going.
13. As a caretaker, I want an FAQ answering cost, who can see what, security, offline use, leaving a group and deleting data, so that I don't have to ask.
14. As a caretaker, I want an About page saying who's behind Caretook and why, so that it feels human.
15. As a caretaker, I want to contact the team with a question, so that I can get help.
16. As a caretaker, I want to read the privacy policy, terms and consumer health data notice, so that I know my rights.
17. As someone accepting an invite, I want the consent screen to link to the privacy policy, so that I can read it before agreeing.
18. As a caretaker on a phone, I want the site to be fast and readable on a small screen, so that it works in a waiting room.
19. As a caretaker, I want the site to follow my device's light or dark setting, so that it's comfortable to read.
20. As a caretaker using a screen reader, I want headings, landmarks, alt text and focus order to make sense, so that I can use the site.
21. As a caretaker sharing a link, I want a proper title, description and image to show up in messages, so that the link looks trustworthy.
22. As the team, I want the site findable by search engines (titles, descriptions, a sitemap, structured data), so that people can find it.
23. As the team, I want copy in editable content modules, separate from layout, so that changing text doesn't mean touching components.
24. As the team, I want legal pages clearly marked DRAFT until reviewed, so that nothing unreviewed looks final.
25. As staff, I want to see the waitlist with filters and export it as CSV, so that we can invite people in batches.
26. As staff, I want contact messages emailed to a support address, so that we see them where we work.
27. As the team, I want spam kept out of the waitlist and contact form without a CAPTCHA, so that real people aren't burdened.
28. As the team, I want no third-party trackers on the site, so that we keep the compliance promise.
29. As the team, I want a regenerable screenshot set from fictional data, so that screenshots stay current as the app changes.
30. As a native-app user, I want none of this in the app bundle, so that the app stays small.

## Implementation Decisions

- **Web only.** Marketing routes are added to `routes.ts`'s web-only list, under one marketing layout route. Native's `/` still redirects to `/app`. Marketing modules never import from `routes/app/`, `lib/sync/` or the editor.
- **Routes:** `/` (home), `/features`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms`, `/health-data-privacy`, plus `/sitemap.xml` and `/robots.txt` resource routes.
- **Prerendering:** the web build prerenders the marketing routes (React Router's `prerender` for the web target only). Forms post through oRPC from the client (the pages stay static).
- **Layout:** a marketing layout with a header (wordmark, Features, FAQ, About, Sign in, a primary "Join the waitlist" button; a menu on phones) and a footer (the pages, the legal links, "© Caretook"). daisyUI themes follow `prefers-color-scheme`; the app's stored theme choice (`caretook:theme`) applies if set, through the existing `THEME_SCRIPT`. Typography is generous (body ≥ 18 px on phones) and calm, using the app's daisyUI palette. No new UI library or font service.
- **Content modules:** each page's copy lives in a typed content module beside it (headings, paragraphs, lists, FAQ items, image references), rendered by small section components (hero, feature grid, steps, promise, FAQ list, CTA band). Changing text never means touching layout.
- **Messaging points** (the copy draft follows these):
  - Caretook is a shared place for a family to keep track of someone's care: what happened today, symptoms and vitals, notes from visits, and soon medications and providers.
  - Everyone in the care group sees the same thing at once, on any phone, even offline.
  - The person being cared for comes first: invite only who they agree to share with; viewers can see without changing anything.
  - Privacy promise: no ads, no selling data, no trackers, no AI vendor training on it; you can delete your data.
  - Free while in early access. Plain words, no jargon, no fear-based selling.
- **Visuals:** lucide icons and soft daisyUI shapes, no stock photos of people. **Screenshots** come from a script beside the browser checks that signs in as the seed users and captures set screens (timeline rows and cards, a live note, vitals, a group's members) at 420 px, in light and dark, as optimized WebP. Fictional seed data only. A screenshot's alt text describes what it shows.
- **Brand assets:** a draft SVG wordmark and icon (the user approves or replaces them), a favicon set (SVG plus PNG sizes, apple-touch-icon), a web manifest for the marketing site, and a default 1200×630 Open Graph image. Static files go in the web app's public folder (created by slice 1).
- **SEO:** a `marketingMeta({ title, description, path, image? })` helper for each route (title, description, canonical from `APP_URL`, Open Graph, Twitter card). `sitemap.xml` lists the marketing routes; `robots.txt` allows them and disallows `/app`, `/admin`, `/invite`, `/join`, `/api`, `/rpc` and `/dev`. Structured data: `Organization` on home and `FAQPage` on the FAQ.
- **Waitlist:** a `waitlist_entry` table (`email` unique case-insensitive, `first_name`, `caring_for` (`parent | spouse | child | sibling | friend | other`, optional), `heard_from` (optional free text, max 200), `source` (page and UTM params), `created_at`; no IP or user agent stored). Signing up again with the same email updates the entry and shows the same thanks (no "already on the list" leak). Staff-only reads. No confirmation email in v1.
- **Contact:** a `contact_message` table (name, email, topic `question | help | privacy | other`, message ≤ 5,000, `created_at`) and a `contactMessage` notification to `SUPPORT_EMAIL` through the outbox. The person gets an on-page thanks (no auto-reply in v1). Privacy-topic messages are flagged in the subject.
- **Public endpoints:** oRPC `public.waitlist.join` and `public.contact.send`, through `publicProcedure`, with Zod validation, a hidden honeypot field (filled → silently accepted, nothing stored), a minimum time on page, and a per-IP rate limit (in memory now, the same limit storage question as auth). No CAPTCHA, no new dependency.
- **Admin:** `/admin/waitlist` (global `admin`, web only, from `invites`' admin frame): a read-only, filterable list (date range, caring for, source) and a CSV export. Staff see only what people typed into the form.
- **Analytics:** none in v1. The marketing layout gets one empty `MarketingAnalytics` hook point so a cookieless counter can be added later. Never in `/app`.
- **Legal drafts:** privacy policy, terms and a consumer health data privacy notice (Washington's My Health My Data Act), written to AGENTS.md's _Compliance_ section: outside HIPAA, the FTC Health Breach Notification Rule, no ad or analytics tools that see health data, consent before sharing, deletion, encryption at rest, and AI vendors that don't retain or train. Each page shows a "DRAFT, not yet reviewed" banner and a "last updated" date from its content module. The invite consent screen (`invites` slice 3) links to `/privacy` and `/health-data-privacy`.
- **Performance and accessibility budget:** each marketing page under about 100 KB of JS gzipped and an LCP image under about 150 KB, with responsive images (`srcset`) and `loading="lazy"` below the fold. One `h1` per page, landmarks, skip link, visible focus, and contrast AA in both themes.
- **Env:** `SUPPORT_EMAIL` (new), `APP_URL` (from `invites`).
- **Hot files:** `routes.ts` (web-only list, appended), `react-router.config.ts` (prerender), `root.tsx` (meta defaults and icon links only), `PERMISSIONS`, `db/schema/index.ts`, the router, `NOTIFICATIONS` (appended), and `invites`' admin navigation (appended).

## Testing Decisions

- A good test checks what a visitor or caller sees (the page, the stored entry, the queued email, the meta tags), not internals.
- **Unit:** `marketingMeta` (canonical, OG and Twitter fields), the sitemap builder (every marketing route, none of the private ones), the robots rules, the content modules (every page has a title, a description and one `h1`; every image has alt text; every FAQ item has a question and an answer), the waitlist and contact Zod schemas, the honeypot and timing rule, and the CSV export (escaping commas, quotes and newlines). Prior art: `appUrls` and `groupSections` tests.
- **Integration:** `public.waitlist.join` (stores, normalizes the email, updates a repeat without leaking, the honeypot stores nothing, the rate limit refuses the 11th call in a minute), `public.contact.send` (stores and enqueues `contactMessage` in one transaction; privacy topic flagged), and admin-only access to the waitlist list and export. Prior art: `router.int.test.ts`.
- **Browser check `marketing.mjs`:** every page loads at 420 and 1280 in light and dark with no console errors and one `h1`; the header menu works by keyboard on a phone; meta tags and JSON-LD are present; no request goes to a third-party origin; no `/app` or sync chunk loads on marketing pages; Join the waitlist stores an entry (checked with `psql` through `PG_CONTAINER`) and thanks the visitor; contact queues a mail visible at `/dev/mail`; "Have an access code?" reaches `/join/…`; Sign in reaches `/sign-in`; screenshots of each page. Order-independent and self-cleaning (tagged `+mkt<run>@example.com` entries removed).
- `pnpm build` (web, with prerender) and `pnpm build:native` both succeed, and the native build contains no marketing route.

## Out of Scope

- Analytics (a hook point only; the vendor or self-built counter is decided later).
- A pricing page, plans or payments.
- A blog, newsletter, or a CMS (content modules are code).
- Waitlist confirmation emails and double opt-in, auto-replies to contact messages, and sending access codes from the waitlist (sending stays manual).
- Professional and agency marketing ("For professionals").
- Final legal text (drafts only, for review), and translations.
- A final brand (the logo is a draft for the user to approve or replace).
- Stock photography and video.

## Further Notes

- Source: the user's request on 2026-11-18, filed as B-32.
- Interview decisions (2026-11-18):
  - **Pages:** home, features, privacy and terms, about, contact and FAQ.
  - **Calls to action:** both the waitlist and "Have a code?".
  - **Look and audience:** the daisyUI theme, warm and calm, for family caretakers.
  - **Copy and contact:** agents draft the copy and the user edits it; contact is a form emailed through the outbox.
  - **Waitlist:** email plus optional context, with an `/admin` list and CSV export.
  - **Build and analytics:** prerendered static pages with the SEO basics; analytics decided later.
  - **Visuals and price:** screenshots, illustrations and a draft logo, favicon and OG image; the site says "free in early access".
- The marketing site makes public promises (no ads, no trackers, deletion). Anything that changes those, such as adding analytics, needs the privacy page updated in the same change.
