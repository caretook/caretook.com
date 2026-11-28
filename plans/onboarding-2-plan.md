# Plan: Group setup on its own pages, with setup nudges (onboarding-2)

> Source PRD: [`plans/onboarding-2-prd.md`](onboarding-2-prd.md). User-story numbers (US) refer to it. Backlog item B-670. The invite nudge (B-665), the install tip (B-759) and the connect-assistant nudge (B-858) are in `onboarding-3`.

## Status

| Slice | Wave | State         | Merge into `prd/onboarding-2` (slice commits)   |
| ----- | ---- | ------------- | ----------------------------------------------- |
| 1     | 1    | landed (opus) | e6594062c (7844ff2e0)                           |
| 2     | 2    | landed (opus) | ab0722574 (f26ce5101)                           |
| 3     | 3    | landed (opus) | 52d9b39e1 (51bcd45a6)                           |
| 4     | 3    | landed (opus) | 744b58204, fix 4e8ee1a20 (748f3b4c8, 807e5b1ef) |
| 5     | 4    | merged (opus) | bd843f2b7 (1cac719b7)                           |
| 6     | 5    | planned       |                                                 |

**Landing mode:** run everything through (dispatcher run-through start): start every ready slice, land each green wave, ask only real questions via `risa ask`.

**Wave 3 landed (2026-11-28)** in dev through PR #314 as 5cc9811 (tier components: run 46116285448 green, then 46117505937 on the fix a flake (search perf test, brake list); Codex clean on 1154928 after one fix round; landed unsynced over 2 dev commits sharing no file). Slice worktrees removed. Report filed. Docs: setup + nudges in app-shell.md (trimmed to its 10 KB budget), ui-kit toast `secondAction`, new component folders in layout.md. shared-displays (now session shared-displays-9c) told about the `components/medications/index.ts` exports.

**Codex follow-ups filed (prd=onboarding-2, triaged):** B-1008 (a setup nudge toast outlives its group or a setup page opening; Open goes to the old group) and B-1009 (Back from a medication opened on the setup medications step goes to the Medications list: add the setup route to `lib/medications/medicationOrigin.ts`). Either can ride with slice 5 or 6 if small, else a fixes slice.

**Wave 4 started (2026-11-28):** dev sync skipped (no shared file); backlog ingest empty, no new items. Slice 5 (opus) handed off 1cac719b7 (quick check green), merged as bd843f2b7: redirect in the group layout middleware (`layout/setupRedirect.ts`); first-sync and invites edited to click Later, not yet run. CI components run 46119276962 on cec63f0a: file; blame puts `settings.browser.test.tsx` (timeline toggle vs Settings, save in flight) on the branch. Lean browser suite 10/11: `session-end` fails 3/3 (offline symptom chip at :118), owner unknown. Fix f7c7c9517 (the redirect reads settings via `loadSettings`; a known-but-uncached device redirected to an unrouted setup page) merged as 68eb76e09. session-end was this stack's stale data: passes after `pnpm datastore:reset`. Rerunning CI components on the tip. B-670 stays in progress until slice 6.

**Wave 4 = slice 5** (stack: yes, opus). Builds on `readSetupFacts` + `setupRedirectStep` + `settingsKnown` (`lib/app-shell/groupSetup.ts`). The setup pages render inside the group layout. `useSetupNudges` shows nothing on a setup page. Entry nudge's Open goes to `appUrls.newEntry(g, "note")` (the PRD's `timeline/new/note` doesn't exist). Then wave 5 = slice 6 (check `fixes-ui`'s wave isn't on `routes/app/groups/timeline/` first).

**Overlap with shared-displays:** onboarding-2 edits none of `components/providers/ProviderForm`, `ProviderListItem`, `ProviderRowContact` again (a promise). Planning note: slice 2 touched 24 files and slice 3 55 (it moved the medication, period and profile form pieces into `components/` and `lib/` so no route imports another's folder).

**Backlog:** `done` B-670 when slice 6 merges (B-670 replaces the setup card, which is slice 6's work). B-1007 landed.

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
