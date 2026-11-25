# Plan: Marketing site up to date

> Source PRD: [`plans/marketing-2-prd.md`](marketing-2-prd.md). User-story numbers (US) refer to it. Backlog item B-417 (copy part). Topic `marketing-2`.

## Status

| Slice | Wave | State                   | Merge into `prd/marketing-2` (slice commits) |
| ----- | ---- | ----------------------- | -------------------------------------------- |
| 1     | 1    | planned                 |                                              |
| 2     | 1    | planned                 |                                              |
| 3     | 1    | planned                 |                                              |
| 4     | 1    | planned (text approved) |                                              |

## Architectural decisions

- Page text lives only in the content modules and the shared meta module. No new section components; the hero section gains the lockup fields (slice 1), nothing else changes shape.
- **The legal pages (privacy, terms, health data notice) are untouched** (B-54). Banned-phrase tests cover home, features, FAQ, About and the meta module only.
- Every claim is checked against the area docs before it's written (PRD, _Decisions_: claims discipline). No "early access", "HIPAA", "free forever", competitor names or "export anytime" on the non-legal pages.
- No screenshots, videos or illustrations; the existing SVG placeholders stay where they are.
- The share image keeps its path and size. Its source is a new SVG beside it in `apps/web/public/`, rendered to the PNG with Playwright (already a dev dependency) by a small script under `scripts/`; never a new rasterizer.

## How to run this plan

- **One wave:** slices 1 to 4 in order (each edits a content module the one before touched). Land when slice 4 merges: that's the version the user shares.
- After each merge, the `marketing` browser check. Hand-offs show each touched page at 420 and 1280, light and dark, for review only (not marketing screenshots).
- **Landing:** no migration, no dependency, no sync change. Hot files: `apps/web/app/routes/marketing/`, `apps/web/public/og-default.png`.
- **Backlog:** claim B-417 when slice 1 starts. `done` it when slice 4 merges; the visual refresh it also asked for is B-836 (marketing visual refresh) under `marketing`.
- Fold into [marketing](../docs/domain/marketing.md) at landing: the lockup, the price sentence's single home, the claims rule.

## Slice 1: The lockup, titles and share image

Stack: yes · Reads: docs/domain/marketing.md, docs/domain/components.md · Tests: unit, component, e2e:marketing

**User stories:** US 1, 6. **Blocked by:** none. **Blocks:** 2.

The PRD's _Decisions_ on the lockup: the home hero shows the name, "Care, taken." and the descriptor without the founder clause, with the old heading as supporting copy (the hero section's type and component gain the fields; other pages' heroes are unchanged). Page titles and descriptions with the tagline, in each page's content module's `meta` field (the shared meta module holds only the share image and its alt). The share image: the SVG source, the PNG rendered from it with Playwright (_Architectural decisions_), and its alt text. The `marketing` check's home assertions follow the new hero.

**Acceptance:** content tests cover the lockup fields; meta tests cover the titles and the share image alt; the pages component test renders the lockup; the `marketing` check passes; the hand-off shows home and the new share image.

## Slice 2: Free for families and the claims

Stack: yes · Reads: docs/domain/marketing.md · Tests: unit, e2e:marketing

**User stories:** US 2, 5. **Blocked by:** 1. **Blocks:** 3.

The PRD's _Decisions_ on the price promise and claims discipline across home, FAQ and the features page's two price lines (its eyebrow and its closing call-to-action body): "Free for families" in place of "Free while in early access"; the price band and the FAQ cost answer from one shared sentence in one module; the FAQ's security and AI answers reworded to concrete promises, including the question "Is our information secure?" (a bare "secure") and the "How do I delete my data?" answer's "While we're in early access" (it still sends people to the contact page: there's no self-serve deletion yet). A unit test fails on "early access", "HIPAA", "free forever" or a bare "secure" in the home, features, FAQ and About content and the meta module (never the legal pages).

**Acceptance:** the banned-phrase test and the shared-sentence test pass; the `marketing` check passes; the hand-off shows home, FAQ and features.

## Slice 3: The features as they are today

Stack: yes · Reads: docs/domain/marketing.md, docs/domain/medications.md, docs/domain/todos.md, docs/domain/calendars.md, docs/domain/assistant.md, docs/domain/care-periods.md, docs/domain/search.md, docs/domain/profiles.md, docs/domain/connectors.md · Tests: unit, component, e2e:marketing

**User stories:** US 3, 4, 5. **Blocked by:** 2. **Blocks:** 4.

Bring `/features` and home's "What Caretook helps with" and "How it works" up to today, per the PRD's _Implementation decisions_ (feature blocks): medications out of "Coming soon" into a main block; blocks for todos, the planner and calendars (iCal feed, Google Calendar, reminder emails), quick entry, printable sheets (only the ones that exist), care periods, search, the profile, and connecting your own Claude or ChatGPT (where it's set up in the app); remove the "Coming soon" band unless something planned is worth naming without a date. Home picks the four or five strongest. Any FAQ answer that names a feature as coming is updated.

**Acceptance:** content tests check every feature block has a heading and body and that no built feature is listed as coming; the `marketing` check passes; the hand-off shows home and features and lists each claim with the area doc that backs it.

## Slice 4: The founder story

Stack: yes · Reads: docs/domain/marketing.md · Tests: unit, e2e:marketing

**User stories:** US 7. **Blocked by:** 3. **Blocks:** none.

Put the approved founder story and bios on About exactly as written below (the user approved them on 2026-11-25; their partner, Tedder, reads them before the wave lands: the orchestrator's landing report asks). Add "built by caregivers who've been there" back to the descriptor on home and in the meta module. Don't edit the text; a word that breaks a content test is a question for the user, not a rewrite. Name the co-founder **Tedder**, never another name, and use no pronouns for Tedder.

> **Why we built Caretook**
>
> We're Bo and Tedder, partners in Mars Hill, North Carolina, and we've both been family caregivers.
>
> In early 2025, Tedder's father was diagnosed with stage IV lung cancer and died within a few months. Bo's father lived with multiple sclerosis for decades. Bo and his mother cared for him nearly full time through his last two years, until he died in hospice in the fall of 2026.
>
> The illnesses were different, but the work was the same. We kept medical details straight, tracked medications, kept doctors and family on the same page, and made hard decisions without all the facts. The timeline, printable medication sheets and visit notes we pieced together turned out to be the most useful things we had. Bringing all of it to an AI assistant helped us make sense of everything and keep up with the constant choices.
>
> We came to it from different directions. Tedder brought clinical and disaster resilience training to the hard conversations and the crises. Bo brought twenty years of building software and the habit of turning a mess into a system. Between us, we could see how those rough tools could become something better, for families who don't have the time to build their own.
>
> We cared for each other through both losses. Caretook is the tool we wish we'd had the energy to build while we were in the middle of it, made for any family managing long-term care, so the next family doesn't have to start from scratch.
>
> **Tedder, MS, MSW, LCSW, LCASA**
> Co-founder. Master's degrees in social work and disaster resilience leadership from Tulane University.
>
> **Bo Davis**
> Co-founder. 20 years building software and leading technology teams, including as a startup CTO.

**Acceptance:** the content test checks the story's heading, both bios and the descriptor; the `marketing` check passes; the hand-off shows About and home.
