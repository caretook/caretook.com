# Plan: Marketing site refresh

> Source PRD: [`plans/marketing-3-prd.md`](marketing-3-prd.md). User-story numbers (US) refer to it. Items B-836, B-855, B-887, B-888, B-563, B-829. Topic `marketing-3`.

## Status

**From the user**

- 2026-11-28 (B-855 hero text): "Yes. Exact text. Go"

**Landing mode:** run everything through (started run-through by the dispatcher): start every ready slice, land each green wave, ask only real questions via `risa ask`.

**For wave 1's landing report** (slice 3's ideas, B-829): claim a todo ("I'll take it", a "needs someone" filter); dose reminder emails from Med times; routines as repeating todos with a weekly done count; starter checklists as todo templates; photos on entries; documents beside the profile (insurance cards, POLST, power of attorney); a site line: free for the whole family, plus no tracking; a catch-up digest email. Also B-1070 (meta "care notebook" vs hero "care journal") for the user's wording call.

**Now (2026-11-28):** wave 1 merged (B-836 stays open for wave 2); wave 1 CI (run 46190535266) failed only static: Prettier on this plan's table (fixed); every component test passed. One components run follows once 5 and 6 merge (gates both waves); wave 2 slices 5, 6 working (opus). Docs to fold at landing: marketing.md's page list gains /accessibility. Worktrees made; agents on opus (the plan's Model field) for all five. Backlog at wave 1 boundary: nothing new for marketing-3.

| Slice | Wave | State                                                               | Merge into `prd/marketing-3` (slice commits) |
| ----- | ---- | ------------------------------------------------------------------- | -------------------------------------------- |
| 1     | 1    | merged                                                              | ece376081 (1a8ca0000)                        |
| 2     | 1    | merged                                                              | 249bfb719 (d54231d81)                        |
| 3     | 1    | merged                                                              | cb7b17dba (1233d1544)                        |
| 4     | 1    | merged                                                              | c4ec80abb (b54c99c0e)                        |
| 5     | 2    | working                                                             |                                              |
| 6     | 2    | handed off (6e5c74c43; its plan-format commit 4972ba02d: keep ours) |                                              |
| 7     | 1    | merged                                                              | 651f2b48b (044c01061)                        |

## Architectural decisions

- Web build only; everything is under `apps/web/app/routes/marketing/` except the research note (`docs/research/`).
- Copy lives in the content modules; layout in the section components; the shared look in `sections/look.ts` (slice 4 makes it; slices 5 and 6 read it). No file keeps its own `CONTAINER` after wave 2.
- Theme tokens only; motion only under `prefers-reduced-motion: no-preference`. No new dependency, font or image.
- Tests are structural, never word for word. Nobody edits `site/claims.test.ts` (fixes-tooling's hot file).
- The claims rule (marketing.md): only what the app does today, checked against the area docs.

## How to run this plan

- **Wave 1** (slices 1 to 4 and 7, all at once): features copy, the accessibility page, the research note, the look module with the home page, and the user's hero text with the share image. They share no file and no check file.
- **Wave 2** (slices 5 and 6, at once): the inner pages and the layout, on slice 4's look module. Slice 5 also needs slice 1's features order (the jump links follow the blocks).
- The `marketing` browser check runs once, by the orchestrator at wave 2's landing (after slices 5 and 6 merge), with `RISA_BROWSER_SLOTS=4`; no slice runs it.
- Slice 3 is docs only: no stack, no tests, prettier only.

## Slice 1: Features: "Log it in seconds" first, then easy mode

Stack: no · Reads: docs/domain/marketing.md, docs/domain/app-shell.md, docs/domain/timeline.md, docs/domain/care-groups.md · Tests: unit · Blocked by: none · Check: apps/web/app/routes/marketing/features/content.test.ts

US 5, 6 (B-887, B-888).

**Build**

- `features/content.ts` `content.showcases`: move `quick-entry` to right after `timeline`; its heading becomes "Log it in seconds, typed or spoken"; paragraphs lead with speed (one line, typed or said with the phone's dictation); the points list keeps its order.
- Add an `easy-mode` block after it: the simpler timeline (today's doses as one tap, my todos, four big tiles), the switch on the Timeline page, the Easy helper and Easy viewer roles. Each claim checked against app-shell.md _Easy mode_, timeline.md _The easy view_ and care-groups.md's roles. No image.
- `sections/icons.tsx`: a new icon name for easy mode, from `lucide-react` (already installed), if none fits.
- Update the meta description if it lists the blocks.

**Acceptance**

- [ ] `features/content.test.ts`: the first three block ids are `timeline`, `quick-entry`, `easy-mode`; `easy-mode` has paragraphs and points and a known icon; the existing checks still pass. No wording asserted.

**Blocks:** 5.

## Slice 2: Accessibility statement page

Stack: no · Reads: docs/domain/marketing.md, docs/domain/components.md · Tests: unit · Blocked by: none · Check: apps/web/app/routes/marketing/sections/legal.test.ts

US 7 (B-563).

**Build**

- `site/pages.ts` `MARKETING_PAGES`: append `{ id: "accessibility", path: "/accessibility", label: "Accessibility", area: "site" }` (at the end; no `header`). Not `legal`: that area is the three accepted documents (`legalLinks()` and its test).
- `routes.ts` `marketingRoutes`: append the route.
- `accessibility/route.tsx` (new): like the privacy route, `LegalPage` with `marketingMeta`.
- `accessibility/content.ts` (new): a `LegalPageContent`, `draft: true`, today's date. Sections: our standard (WCAG 2.2 AA, not independently audited), what we do (only what's true: the Atkinson Hyperlegible typeface, visible focus, reduced motion, native controls, light and dark themes, accessibility lint; check each in app.css, components.md and the ESLint config), known gaps (placeholder screenshots; no audit yet), how to report a barrier (`[text](/contact)`), and the date. No "secure", "HIPAA", "early access".

**Acceptance**

- [ ] `sections/legal.test.ts`: the page joins `PAGES` and passes the shape checks; it's in `MARKETING_PAGES` with area `site`; it uses none of the claims test's banned words (a local list, since the claims test isn't edited).
- [ ] `LEGAL_VERSIONS`, `legalLinks()` and the sign-up checkbox are unchanged (the legal versions and legal links tests pass untouched).
- [ ] The SEO test passes untouched (sitemap and prerender follow the page list).

**Blocks:** 6.

## Slice 3: Research note: Caretook compared with Caring Village

Stack: no · Reads: docs/domain/marketing.md, plans/marketing-2-prd.md · Tests: none (Markdown) · Blocked by: none · Check: none

US 8 (B-829).

**Build**

- `docs/research/caring-village.md` (new; under 10 KB): from Caring Village's public site and app store pages (searches name only Caring Village and its features, nothing about this project or its users), a table of features (Caring Village, Caretook, verdict: overlap, Caretook ahead, Caring Village ahead), each Caretook cell resting on an area doc; then three short lists: where we already do better, where they do, and ideas to pull ahead. Date it, and list the pages read with their URLs.
- Nothing on the site changes and nothing is filed in the backlog: the orchestrator copies the ideas into the landing report for the user.

**Acceptance**

- [ ] The note exists, cites its sources, and every Caretook claim names its area doc.
- [ ] `pnpm exec prettier --check docs/research/caring-village.md` passes.

**Blocks:** none.

## Slice 4: The look module and the home page

Stack: no · Reads: docs/domain/marketing.md, docs/domain/components.md · Tests: component · Blocked by: none · Check: apps/web/app/routes/marketing/home/waitlist.browser.test.tsx

US 1, 2 (B-836).

**Build**

- `sections/look.ts` (new): the PRD's _Implementation decisions_ look module: container, section rhythm, the two band tones, the card, the opening gradient, h1/h2/h3 sizes.
- `sections/Sections.tsx`: `Hero`, `SectionHeading`, `FeatureGrid`, `Steps`, `PromiseSection`, `CtaBand` read from it; drop the local `CONTAINER`. Keep the hero's one `h1`, the lockup and both buttons on one row from 360 px; the hero gets the opening gradient.
- `home/WaitlistBand.tsx`: the band and form surface from the look module.

**Acceptance**

- [ ] `home/waitlist.browser.test.tsx` and the pages component test pass untouched (behaviour unchanged); no copy changes here (slice 7 owns the hero text).
- [ ] Light and dark both checked by eye on a 360 px and a 1280 px viewport in the hand-off.

**Blocks:** 5, 6.

## Slice 5: Inner pages: the look, uniform blocks and jump links

Stack: no · Reads: docs/domain/marketing.md, docs/domain/components.md · Tests: component · Blocked by: 1, 4 · Check: apps/web/app/routes/marketing/sections/pages.browser.test.tsx

US 1, 2, 4 (B-836).

**Build**

- `sections/PageSections.tsx`: `PageIntro` (the opening gradient), `Showcase` (cards and bands from the look module; with no image, its icon large in the image's column, `aria-hidden`), `Gallery`, `Prose`, `FaqList` read from slice 4's look module; drop the local `CONTAINER`. Add a new `JumpLinks`: `{ items: { id, heading }[] }`, a `nav` labelled "On this page" of React Router hash `Link`s, scrolling sideways on a phone.
- `features/route.tsx`: render the new jump links from `content.showcases` under the intro.
- `sections/LegalPage.tsx`: container and headings from the look module.
- `contact/route.tsx`: its inline container from the look module.

**Acceptance**

- [ ] `pages.browser.test.tsx`: the features page has one "On this page" nav with one link per block, each to an id on the page; each block still has one `h2`; the page still has one `h1`.
- [ ] The legal page component test passes untouched.

**Blocks:** none.

## Slice 6: Header and footer

Stack: no · Reads: docs/domain/marketing.md, docs/domain/components.md · Tests: component · Blocked by: 2, 4 · Check: apps/web/app/routes/marketing/layout/layout.browser.test.tsx

US 1, 2 (B-836).

**Build**

- `layout/MarketingHeader.tsx`: already sticky and blurred, with `NavLink`'s `aria-current`; keep that. Change only: the container and surface from the look module, opaque under `prefers-reduced-transparency: reduce`.
- `layout/MarketingFooter.tsx`: already three columns with labelled Site and Legal navs; keep that. Change only: the container and band from the look module.
- `scripts/browser-checks/marketing.spec.mjs` `PAGES`: append `/accessibility` (slice 2's page), so the sitemap and one-h1 tests cover it. The orchestrator runs this check at wave 2's landing.

**Acceptance**

- [ ] `layout.browser.test.tsx`: (new assertions on what exists) the current page's header link has `aria-current="page"`; the footer has a site group (Accessibility among it) and a legal group, each a labelled list; the skip link and menu tests pass.

**Blocks:** none.

## Slice 7: The user's hero text and the share image

Stack: no · Reads: docs/domain/marketing.md · Tests: unit · Blocked by: none · Check: apps/web/app/routes/marketing/home/content.test.ts

US 3 (B-855). **The text is the user's, exact, word for word (2026-11-28: "Yes. Exact text. Go"); never reword it.**

**Build**

- `home/content.ts` `homeContent.hero`: `lockup.descriptor` becomes "A shared care journal, made by caregivers who've been there."; `lead` becomes "Signal or not, caretakers can add today's notes, medications, visits and doctors' numbers, and it reaches everyone in the care group." The badge (`eyebrow`), the lockup and both buttons stay as they are.
- `apps/web/public/og-default.svg`: the descriptor's two `<text>` lines carry the new descriptor, rewrapped to fit the same box; then re-render `apps/web/public/og-default.png` with `node scripts/build/share-image.mjs`.
- `site/meta.ts` `DEFAULT_OG_IMAGE`: its alt becomes "Caretook. Care, taken. A shared care journal, made by caregivers who've been there."

**Acceptance**

- [ ] `home/content.test.ts`: `hero.lead` is one sentence of at most 25 words (structure, not wording); the existing checks pass.
- [ ] `site/meta.test.ts` passes untouched (it holds the descriptor, the SVG and the alt together); the PNG is re-rendered and checked by eye in the hand-off.

**Blocks:** none.
