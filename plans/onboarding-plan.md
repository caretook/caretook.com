# Plan: Guided setup, legal acceptance and an installable app (onboarding)

> Source PRD: [`plans/onboarding-prd.md`](onboarding-prd.md). User-story numbers (US) refer to it. Backlog items B-359, B-360 and B-31.

## Status

| Slice | Wave | State         | Merge into `prd/onboarding` (slice commits) |
| ----- | ---- | ------------- | ------------------------------------------- |
| 1     | 1    | merged (opus) | 8404c3a4 (ebfc909c)                         |
| 2     | 1    | merged (opus) | 043a28f5 (c6a64dd5, bcfee496)               |
| 3     | 1    | merged (opus) | 6bb9316c (9310f2f9, 071859ba)               |
| 4     | 2    | —             | —                                           |
| 5     | 3    | —             | —                                           |

**Landing mode:** run everything through (started run-through): land each green wave, clean up, ask real questions only through `pnpm prd ask`.

**Now (2026-11-23):** wave 1 running from b91c9d56. Worktrees `onboarding-1`, `-2`, `-3` made, one background opus agent each. Slice 1 merged (migration 0038), quick check passed on 7f5ae1cb. Slice 2 merged, B-360 ready, quick check passed on f3e9ff8a. Slice 3 merged, quick check passed on 48a30890. Synced dev (f41f07ee, no migration from dev). `first-sync` and `invites` browser checks passed on the synced tip. Quick check and the `full` CI run (migration) are next. The lean browser suite is asked through `pnpm prd ask`, not run unasked. Follow-ups to file: focus after dismissing the card; `updatePreferences` reads then writes without a lock. B-359, B-360 and B-31 claimed. No new backlog items for this topic. Slice 4 must move `LegalAgreement` out of the join route to share it. Slices 1 and 2 each added a legal-links helper (`lib/auth/legalLinks.ts`, `account/legalLinks.ts`): fold them into one at landing or file a follow-up.

**Backlog:** `done` B-360 when slice 2 merges, B-359 when slice 4 merges and B-31 when slice 5 merges.

## Architectural decisions

- **Acceptance is written only by the system through its service,** append-only, and is never synced.
- **The server is the authority:** a sign-up without `legal: true` is refused whatever the screen did.
- **Nothing gates `/app`.** Existing accounts are never asked.
- **Sign-up still reveals nothing** about which addresses have accounts.
- **Setup steps come from the device's synced data,** through one pure function; only the dismissal is stored.
- **Shared routes** export no server `loader` or `action` and import no marketing code.
- **No new dependency.** One migration, in slice 1. All test data is fictional.

## How to run this plan

Wave 1 is slices 1, 2 and 3, which touch separate areas. Wave 2 is slice 4. Wave 3 is slice 5.

Slices 1 and 3 both run browser checks but edit different specs: slice 1 edits `invites`, and slice 3 keeps the `data-invite-card` hook, so it edits neither.

**Hot files:** `apps/web/app/routes/account/join/`, `apps/web/app/routes/account/invite/`, `packages/auth/src/tickets.ts`, `packages/api/src/care-groups/`, `packages/data/src/services/careGroupInviteService.ts`, `apps/web/app/routes/app/groups/timeline/`, `apps/web/app/root.tsx`, `apps/web/public/site.webmanifest`, `apps/web/app/routes/marketing/layout/`, `packages/data/src/db/schema/app-shell/userPreferences.ts`, `apps/web/app/lib/app-shell/me.ts`, `scripts/browser-checks/invites.spec.mjs`. It waits on no other topic; the dispatcher keeps hot-file overlaps apart.

## Slice 1: Acceptance at access-code sign-up

Stack: yes · Reads: docs/domain/auth.md, docs/domain/care-groups.md, docs/domain/data-layer.md, docs/domain/components.md · Tests: unit, integration, component, e2e:invites

**User stories:** US 1, 4, 5.

**Build:**

- The pure legal rules (versions, wording) and the `legal_acceptance` table (adds a migration), its permissions, model and service, all in the `auth` area.
- `accessCode.signUp` requires `legal: true` and records acceptance in its transaction.
- The checkbox and its three legal links (Terms, Privacy Policy, Consumer Health Data Privacy Policy) on `/join/:code`, correct on both build targets. Each record names all three versions.

**Acceptance criteria:**

- [ ] Unit: the terms, privacy and health-data privacy versions equal the legal pages' last-updated dates.
- [ ] Integration: sign-up without `legal` creates nothing; with it, one row names the versions and `access_code`; an existing address writes no row and gets the same answer; only the person can read a row, only `system` can write one; deleting the account deletes it.
- [ ] Component: `/join/:code` can't submit without the box; the links open in a new tab and keep the form.
- [ ] e2e: the `invites` check's access-code flow ticks the box.

**Blocked by:** none. **Blocks:** slice 4.

## Slice 2: Installable app

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/marketing.md, docs/domain/security-headers.md · Tests: unit, component

**User stories:** US 13, 14.

**Build:**

- The manifest opens `/app`, standalone, with a stable `id`.
- It's linked from the root for every page, with iOS web-app meta tags; the marketing layout's own link goes.
- Account settings links the three legal pages, correct on both build targets.

**Acceptance criteria:**

- [ ] Unit: the manifest's `id`, `start_url`, `scope`, `display` and icons; its start URL routes to the service worker's shell.
- [ ] Component: the root's links include the manifest once, and the marketing layout test is updated; account settings shows the legal links.

**Blocked by:** none. **Blocks:** none.

## Slice 3: The setup checklist for people who can set up

Stack: yes · Reads: docs/domain/app-shell.md, docs/domain/timeline.md, docs/domain/components.md, docs/domain/connectors.md · Tests: unit, component, e2e:first-sync

**User stories:** US 7, 8, 9, 10, 11.

**Build:**

- The pure `gettingStartedSteps` for owners, admins and caretakers, and the 14-day window from the membership's `created_at`.
- The setup card on the timeline, from synced data, taking the place of the invite card while it shows. Its invite step keeps the `data-invite-card` hook.
- Dismissal per group on `user.preferences`, through the settings path. Seeded members start with their seeded groups dismissed.

**Acceptance criteria:**

- [ ] Unit: steps for each role and state; the connect step by role and the group's switch, never counted toward completion; the window's edges.
- [ ] Component: a new owner sees the steps, and adding an entry ticks one live; dismissing hides it and survives a reload; a member past 14 days sees nothing; the invite card returns once the setup card is gone.
- [ ] e2e: `first-sync` and the `invites` new-group step still find `data-invite-card`, with no spec edit.

**Blocked by:** none. **Blocks:** slice 5.

## Slice 4: Acceptance at invite sign-up and accept

Stack: yes · Reads: docs/domain/auth.md, docs/domain/care-groups.md, docs/domain/components.md · Tests: integration, component, e2e:invites

**User stories:** US 2, 3, 4, 5, 6.

**Build:**

- `invite.signUp` requires `legal: true` and records `invite_signup`.
- `invite.accept` takes optional `legal`, records `invite_accept`, and returns `legalRequired` when neither a current row nor `legal` is there, for email invites and links alike.
- The authed read, and `/invite/:token` showing the box on sign-up and, only when needed, on the consent step.

**Acceptance criteria:**

- [ ] Integration: each path above, including an accept that follows a lost sign-up write, a link's request, and accepting twice; an existing address through a link writes no row.
- [ ] Component: the box shows on sign-up, and on consent only for an account without a current acceptance.
- [ ] e2e: the `invites` check ticks the box in its existing sign-up flows, for email and link invites.

**Blocked by:** slice 1. **Blocks:** none.

## Slice 5: The welcome for viewers and Easy roles

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/timeline.md, docs/domain/care-groups.md, docs/domain/components.md · Tests: unit, component

**User stories:** US 11, 12.

**Build:**

- `gettingStartedSteps` returns a role welcome for viewers, Easy helpers and Easy viewers.
- The welcome on the timeline and the Easy timeline, dismissed the same way.

**Acceptance criteria:**

- [ ] Unit: each of the three roles gets its welcome and no steps.
- [ ] Component: the welcome shows on both timelines, offers nothing the role can't do, and stays dismissed.

**Blocked by:** slice 3. **Blocks:** none.
