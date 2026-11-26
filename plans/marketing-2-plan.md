# Plan: Marketing site up to date

> Source PRD: [`plans/marketing-2-prd.md`](marketing-2-prd.md). User-story numbers (US) refer to it. Backlog item B-417 (copy part). Topic `marketing-2`.

## Status

| Slice | Wave | State           | Merge into `prd/marketing-2` (slice commits) |
| ----- | ---- | --------------- | -------------------------------------------- |
| 1     | 1    | merged          | a99f66c0 (c75b6d15)                          |
| 2     | 1    | merged          | 0d19a248 (523a2cd5)                          |
| 3     | 1    | merged          | f169d123 (e79719c9, e26936b8)                |
| 4     | 1    | running (Fable) |                                              |

**Landing mode (the user, 2026-11-25): "listen to backlog - split-ops"; run every ready slice.** The contact until the weekly reset (Sat 2026-11-28 12:00) is the backlog session split-ops (`caretook-com-d6`): rotate-go, landing and other questions go to it, not to the user directly. Its rules:

1. This session was opened by hand on Fable with `CARETOOK_USAGE_WATCH=off` to use up the week's limit. Slices run on Fable (`model: "fable"`), made with `CARETOOK_USAGE_WATCH=off pnpm prd slice …`.
2. Before the landing, a Fable skeptic on the wave's decisions and code; its verdict goes here and in the landing report.
3. Rotate and recover as often as needed, with no go from split-ops (the user's word, changed 2026-11-25). Before each rotation, check that `.loops/.sessions/prd-marketing-2.json` says `"model": "fable"` and that `CARETOOK_USAGE_WATCH=off` still applies; tell split-ops afterwards. After the weekly reset this topic moves to Opus however far it has got: split-ops switches the record to Opus and asks for a rotation then.
4. Land only on the user's go, asked for through split-ops. Codex is out of credits: the landing is `--no-review`, and the report says so.
5. Ask split-ops before any `rm` or `end`.
6. At 100% usage everything stops; split-ops nudges after the Fable reset, and the next rotation goes to Opus.

The tests' setup changed 2026-11-25 (test DB, lease and stack through `risa.json`'s hooks): a check failing in setup is reported to split-ops before any workaround. Tedder reads the founder story before the wave lands (the landing report asks).

**Log**

- 2026-11-25: session started; backlog ingested (nothing new for this topic). B-417 claimed. Slice 1 started: worktree `.loops/marketing-2-1` (slot 1), agent spawned on Fable; the watch runs in the background. Slices 2 to 4 start as the one before merges.
- Slice 1 handed off (slice check and the `marketing` check green) and merged as a99f66c0; its worktree stays until the wave is green. Slice 2 started: `.loops/marketing-2-2`, agent on Fable. For slice 4: the founder clause changes in four places together (`hero.lockup.descriptor`, `DEFAULT_OG_IMAGE.alt`, the third `<text>` of `og-default.svg`, the re-rendered PNG), and the longer descriptor needs a second line or a smaller size in the image. Docs to fold at landing: the lockup field; the share image rendered from `og-default.svg` by `scripts/build/share-image.mjs`. For the next plan: slice 1 changed 14 files (the hook warns past 12).
- Slice 2 handed off (slice check green; it didn't run the `marketing` browser check, slice 3 runs it) and merged as 0d19a248. Slice 3 started: `.loops/marketing-2-3`, agent on Fable. The price promise lives in `site/price.ts`, word for word from the marketing PRD's _Messaging update_. **For the user at landing (slice 2's judgement calls):** the hero says "free" twice in a row (eyebrow "Free for families" above the descriptor); "security" stays as a topic word (the FAQ group "Privacy and security"), only "secure" forms are banned; the home band no longer says "invitation-only"; the old cost answer's "take your information with you" is gone (B-52, download all your data); the AI lines now say Caretook doesn't use AI on your information today. Docs to fold: `docs/domain/marketing.md`'s legal-pages line ("deletion by request during early access") is now true only of the legal pages.
- Slice 3 handed off (slice check and the `marketing` check green, 11/11) and merged as f169d123. Slice 4 started: `.loops/marketing-2-4`, agent on Fable. Slice 3: sixteen feature blocks, the "Coming soon" band removed, nine lucide icons added to `sections/icons.tsx`, the FAQ's viewer answer corrected, "appointment" replaced by "visit" on home and features. **For the user at landing:** the connectors block says it works with Claude and ChatGPT, which `connectors.md` still lists as "by hand before launch"; the older blocks (timeline, notes, vitals, sharing, offline) weren't re-audited; home's grid dropped vitals and family access for medications and what's coming up. Its claims list (each claim with its area doc) is in the slice 3 hand-off; the page text is in the session scratchpad (`s3-*.txt`), and the Fable skeptic re-checks the claims from the diff.
- Slice 4 handed off (slice check and the `marketing` check green) and merged as fdafec95; B-417 marked done (ready). All four slices are merged; their worktrees stay until the wave's verdict is green. The founder text is verbatim and test-held; the descriptor has the founder clause in home's lockup, the share image (two lines) and its alt. **For the user at landing:** home's meta description doesn't carry the founder clause (it would pass 200 characters); About now has two "why" headings ("Why Caretook exists" first, "Why we built Caretook" third); the story mentions an AI assistant while the FAQ says Caretook doesn't use AI on your information today; Tedder reads the story before landing. `ProseContent.placeholder` is now unused.
- The wave's CI run: `pnpm prd tier` proposes `full` only because no rule covers `scripts/build/share-image.mjs` (a hand-run script nothing imports); requested at `components` (`--why` at landing), split-ops told. Next: the verdict, `pnpm prd sync`, serve, the browser checks, the PR, the Fable skeptic, then the landing go through split-ops (`--no-review`: Codex is out of credits).
- **Fable land skeptic (rule 2), on tip 975064d1: `go`** ("The diff is copy, one hero variant and a hand-run script; the claims I sampled match the area docs and code, and the open items affect sharing the live link, not merging into `dev`."). It covers `--tier components` and `--no-review` only, never the user's go or Tedder's read. Findings: (1) home's gallery intro says "Real screens from Caretook" over placeholder images, and (5) the sharing block's "Viewers can follow along without changing anything" contradicts the todos block: both sent to slice 3's agent as a fix (in flight; the wave's CI run is rerun after its second merge). (6) the claims test's gaps: filed under fixes-tooling. **Questions for the user in the landing ask:** (2) Claude and ChatGPT are claimed flatly but the by-hand connect check isn't done, and ChatGPT needs Developer mode; (3) Google Calendar works only for test users until Google verifies the OAuth app; (7) home says "You can delete your data whenever you want" without "by request", and the "Not for AI training" tile sits beside connectors, which send data to the member's chosen vendor. Sampled and matching: medications, todos, planner and visit prep, care periods, profile, the three print sheets, search, the price promise, the founder text (verbatim).
- Slice 3's fix (cd6715c4: the "Real screens" line dropped, the sharing block's viewer line corrected) merged as 011e0859. The first CI run (components, on 975064d1, run 45727378280): `flake`, one planner test in a file this branch doesn't touch (`plannerSeries.browser.test.tsx`, the scope dialog's Cancel), which lands and is filed after the merge. `pnpm prd sync`: up to date with dev, no merge. The marketing doc is folded (2dc4f29a). Served at http://localhost:6273; `pnpm prd browser --changed --base dev`: `marketing` 1/1 green on the tip. PR 199 is open. Out now: the second CI run (components, on the tip with the fix) and `pnpm prd review marketing-2 --wait` (expected exit 4, out of credits). Then: `pnpm prd ready`, the landing ask to split-ops (the skeptic's three questions and Tedder's read), land with `--tier components --why "the only uncovered file is a hand-run render script" --no-review`, then `status-trim`, and ask split-ops before `rm` and `end`.

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
