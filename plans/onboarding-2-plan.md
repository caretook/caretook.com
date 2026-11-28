# Plan: Group setup on its own pages, with setup nudges (onboarding-2)

> Source PRD: [`plans/onboarding-2-prd.md`](onboarding-2-prd.md). User-story numbers (US) refer to it. Backlog item B-670. The invite nudge (B-665), the install tip (B-759) and the connect-assistant nudge (B-858) are in `onboarding-3`.

## Status

| Slice | Wave | State         | Merge into `prd/onboarding-2` (slice commits) |
| ----- | ---- | ------------- | --------------------------------------------- |
| 1     | 1    | landed (opus) | e6594062c (7844ff2e0)                         |
| 2     | 2    | merged (opus) | ab0722574 (f26ce5101)                         |     |
| 3     | 3    | planned       |                                               |
| 4     | 3    | planned       |                                               |
| 5     | 4    | planned       |                                               |
| 6     | 5    | planned       |                                               |

**Landing mode:** run everything through (dispatcher run-through start): start every ready slice, land each green wave, ask only real questions via `risa ask`.

**Wave 2 landed (2026-11-28)** in dev through PR #312 (tier components green, run 46112831998; Codex clean on 9bb46b9; landed unsynced over 1 dev commit sharing no file; dev now e88177c). Slice 2 on opus, merged ab0722574; worktree removed. Report filed (a376). Docs: setup pages in docs/domain/app-shell.md, the moved provider files in docs/layout.md.

**Overlap with shared-displays (settled):** slice 2 moved ProviderForm, ProviderListItem, ProviderRowContact to `components/providers/` (providerFormData to `lib/providers/`); `components/providers/` is now an onboarding-2 hot file. Backlog session advised keeping it; shared-displays (session shared-displays-6b) was told it landed and builds its ProviderCard (its slice 4) on the moved files. **Promise: onboarding-2 edits none of those three files again.** If slice 3 moves `MedicationForm` into `components/medications/` (its index.ts is a shared-displays hot file), tell shared-displays-6b before landing.

**Next: wave 3 = slices 3 and 4**, both opus, in parallel (separate folders). Sync dev first. For slice 3: `MedicationForm` lives in the medications route folder and must move to a shared folder the way ProviderForm did; add each step as a static child in `setup/routes.ts` and append it to `SETUP_PAGES` (`setup/layout/setupPages.ts`; `SETUP_STEP_META` already has headings). Also give slice 3 **B-1007** (setup providers rows show no tags: pass live tags as DirectoryResults does, in `setup/providers/route.tsx` only) and claim it. For slice 4: the setup pages render inside the group layout (the tab bar shows). For slice 5 later: `readSetupFacts` + `setupRedirectStep` + `settingsKnown`. Planning note: slice 2 touched 24 files (over 12).

**Backlog:** `done` B-670 when slice 6 merges (B-670 replaces the setup card, which is slice 6's work).

## Architectural decisions

- **Setup is per group, for the person who set it up:** the group's earliest member, while an owner. Everyone else gets the welcome, never steps, a redirect or nudges.
- **Step state comes from the device's synced data** through one pure module. Only the account's choices are stored: `preferences.groupSetup` (`opened`, retired nudges), which only grows, plus the old `setupDismissed`.
- **Everything is offline and native-safe:** shared routes export no server `loader` or `action`. The setup pages write locally through the areas' existing writers, and the redirect reads only the local database and the cached settings.
- **One toast at a time, through `ui/` only.** Nudges never carry medical facts or an action's only path.
- **No migration, no new dependency, no new browser check.** All test data is fictional.

## How to run this plan

- Wave 1 is slice 1. Wave 2 is slice 2. Wave 3 is slices 3 and 4 (setup steps beside the nudges: separate folders, with the setup rules read but not changed). Wave 4 is slice 5. Wave 5 is slice 6.
- **Why slice 6 waits for slice 5:** `data-invite-card` is on both the setup card's invite step and `InviteSomeoneCard`. Slice 5 rewrites `newGroup.browser.test.tsx`, `first-sync` and `invites` to assert only that the Timeline is reached, so slice 6 can change the card without breaking them.
- **Hot files:** `apps/web/app/routes/app/groups/setup/`, `apps/web/app/lib/app-shell/groupSetup`, `apps/web/app/lib/app-shell/setupNudges`, `apps/web/app/lib/app-shell/gettingStarted`, `apps/web/app/lib/app-shell/me.ts`, `apps/web/app/routes/app/groups/layout/`, `apps/web/app/components/ui/toastQueue.ts`, `packages/data/src/db/schema/app-shell/userPreferences.ts`, `packages/data/src/services/userService.ts`, `packages/api/src/app-shell/me.ts`, `scripts/browser-checks/first-sync.spec.mjs`, `scripts/browser-checks/invites.spec.mjs`. Slice 6 also touches `fixes-ui`'s `routes/app/groups/timeline/`. Each touches no other running topic's hot file.
- **`fixes-ui` overlap:** slice 6 touches a `fixes-ui` hot folder. The orchestrator starts it only when `pnpm backlog prd list` shows `fixes-ui`'s current wave isn't touching that folder; otherwise it waits for that wave to land.
- **Tests start set up:** from slice 1 the test device and the seeds mark every group's setup `opened` with all nudges retired, so no other test or browser check meets a redirect or a nudge. Setup tests opt in through a device option.
- It waits on no other topic. Slice 6 is about 8 files, mostly deletions and test edits; if it grows, split the pure welcome rules from the Timeline screens.

## Slice 1: The setup record follows the account

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/data-layer.md, docs/domain/api.md, docs/domain/components.md · Tests: unit, integration

**User stories:** US 7, 11 (storage).

**Build:**

- `preferences.groupSetup` in the user preferences schema: per group id `{ opened?: true, retired?: ("help" | "entry")[] }` (the nudge ids, a list later topics extend), capped like `setupDismissed`, with `mergeGroupSetup` (union, never unsets).
- The user service merges it on save, `me.get` returns it, and `me.update` takes a partial change.
- The device's settings cache and pending path carry it (merge on cache, clear what was sent), offline included.
- The device settings say whether they're **known** (a cached copy, or a `me.get` that answered) or only the defaults. The redirect and nudges act only on known settings, so a new or wiped device never redirects a second time.
- The seeds add `groupSetup` (opened, all nudges retired) beside `setupDismissed` for seeded members, an append-only seed edit. The test device starts the same for its group, with an option to start with no record.

**Acceptance criteria:**

- [ ] Unit: `mergeGroupSetup` keeps both devices' groups and retirements, never drops `opened`, and holds the cap. The device cache merges a pending change over a refreshed copy without losing either, and reports unknown with no cache until the server answers. The seeds' setup step is idempotent (prior art: `setupDismissed.test.ts`).
- [ ] Integration: `me.update` with `groupSetup` then `me.get` returns it; a second save for another group keeps the first; a malformed record (unknown nudge id, not a uuid key) is refused.

**Blocked by:** none. **Blocks:** slice 2.

## Slice 2: The setup pages, with the providers step and Later

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/providers.md, docs/domain/components.md, docs/layout.md · Tests: unit, component

**User stories:** US 2, 6, 8 (pages).

**Build:**

- The pure setup rules: who sets the group up, the four page steps' state (`hasProvider`, `hasProfileBasics`, `hasMedication`, `hasCarePeriod`), finished, the first unfinished step, and whether to redirect on open (settings known, sets it up, not finished, not `opened`, not in `setupDismissed`). The facts query grows the provider, care-period and earliest-member facts.
- The shared route `/app/groups/:groupId/setup/:step` in the app-shell area's route list, with an `appUrls` helper. A client-only layout shows progress, the step, **Next** and **Later, take me to Caretook!** (to the Timeline). Opening it stores `opened`. Anyone but the setter, or a role that can't write, is sent to the Timeline. An unknown step goes to the first.
- The `providers` step: `ProviderForm` inline, posting to the step's own client action through the providers area's parser and local write, then listing what's added. Slice 3 adds the other steps' pages, and until then Next from providers finishes.

**Acceptance criteria:**

- [ ] Unit: the setup rules for the creator, a `/join` owner (system `created_by`), a staff group's invited owner, a second owner, an invited caretaker and a viewer; each step's done state; the redirect decision with `opened`, with `setupDismissed` and when finished.
- [ ] Component (test device, offline): the creator adds a provider on the step and sees it listed; Later lands on the Timeline and `opened` is saved pending; an invited member opening the URL lands on the Timeline.

**Blocked by:** slice 1. **Blocks:** slices 3, 4.

## Slice 3: Profile basics, medications and care period steps

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/profiles.md, docs/domain/medications.md, docs/domain/care-periods.md, docs/domain/components.md · Tests: component

**User stories:** US 3, 4, 5.

**Build:**

- The `profile` step: the Profile page's Allergies and Conditions sections (with none known), working as they do on Profile.
- The `medications` step: `MedicationForm` inline, whose prescriber picker lists the providers added in step 1.
- The `period` step: `PeriodForm` inline, including **Add as a new place**, with its own defaults. The last step's Next finishes on the Timeline.
- Each posts to the step's own client action through its area's parser and local write. A form gains a target only if that is the smaller change.

**Acceptance criteria:**

- [ ] Component (test device, offline): set "No known allergies" and add a condition; add a medication with the provider from step 1 as prescriber; add a period at a new place; each step shows done, and Next from the period step lands on the Timeline with the flow finished.

**Blocked by:** slice 2. **Blocks:** slice 5.

## Slice 4: Setup nudges: help and first entry

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: unit, component

**User stories:** US 9, 10, 11, 12.

**Build:**

- `toast()` takes a second action (the view already lists an array of actions).
- The pure nudge scheduler (PRD, _Implementation decisions_, "The nudges"): help, then entry (a list `onboarding-3` extends); the session's first, then hourly; the follow-up after Don't ask again; done or retired nudges skipped; nothing before `opened` (or the old dismissal) or on a setup page. The constants are named.
- One hook in the group layout runs it on open, visibility and focus and its timer, shows the toast (**Open**, **Don't ask again**) and saves retirements through the settings path. Help opens the first unfinished step, entry the Timeline's note sheet.

**Acceptance criteria:**

- [ ] Unit: the scheduler's order, the hourly slot, the session's first nudge, the 30 s follow-up, a done step skipped (another member logged an entry), and no nudge before `opened`, on a setup page or with unknown settings.
- [ ] Component: the toast shows two actions and runs each once; with a fake clock the help nudge shows after `opened`, Don't ask again retires it (pending, offline) and the entry nudge follows 30 s later; entry's Open lands on the note sheet; the default test device shows no nudge.

**Blocked by:** slice 2. **Blocks:** slices 5, 6.

## Slice 5: A creator's first open goes to setup

Stack: yes · Reads: docs/domain/app-shell.md, docs/domain/components.md, docs/agents/loop.md · Tests: component, e2e:first-sync, e2e:invites

**User stories:** US 1, 7, 8.

**Build:**

- The group route's client loader asks the setup rules and sends a creator's first open to the first unfinished step, from `/app/groups/new`, `/join` (after the email is confirmed) and a staff group's owner invite alike. After `opened`, it never redirects again.
- `first-sync` and `invites` pass through the setup pages with Later where they create a group, and assert only that the Timeline is reached (no card assertion, so they hold before and after slice 6). `newGroup.browser.test.tsx` expects the setup page, not the invite card.

**Acceptance criteria:**

- [ ] Component: a new group from `/app/groups/new` opens on the providers step; a second open goes to the Timeline; a group in `setupDismissed` and an invited member's group open on the Timeline; with no cached settings it opens on the Timeline; it works offline with cached settings.
- [ ] e2e: `first-sync` and `invites` pass with the setup pages in the way.

**Blocked by:** slices 3, 4. **Blocks:** slice 6.

## Slice 6: The Timeline's setup card goes

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/timeline.md, docs/domain/care-groups.md, docs/domain/components.md · Tests: unit, component

**User stories:** US 13.

**Build:**

- The setup steps leave both timelines, Easy view included. `InviteSomeoneCard` stays for a lone manager in the full view as today (now whenever the setter is alone, not only after the setup card), until `onboarding-3` replaces it.
- The welcome card shows for every member who didn't set the group up (welcome text for every role), within today's window, and is dismissed as today. The setter sees no setup card.
- The setup card's tests move to the welcome; tests that waited on the setup card's `data-invite-card` step wait on `InviteSomeoneCard` or the welcome.

**Acceptance criteria:**

- [ ] Unit: the welcome text exists for every role; the setter gets none.
- [ ] Component: a lone owner's Timeline (full and Easy) shows no setup card and, in the full view, the Invite someone card; an invited caretaker sees the welcome and can dismiss it; the Timeline jump tests pass.

**Blocked by:** slices 4, 5. **Blocks:** none.
