# Plan: Routing

> Source PRD: [`plans/routing-prd.md`](routing-prd.md). User-story numbers (US) refer to it. Backlog item B-23. Topic `routing`.

## Status

| Slice | State                                                | Merge into `prd/routing` (slice commits)      |
| ----- | ---------------------------------------------------- | --------------------------------------------- |
| 1     | merged; wave 1, awaiting the user's go-ahead to land | 73f2aeb (2a4bfad, 54d28fd), 8a72857 (448a90a) |
| 2     | ready once wave 1 lands                              |                                               |
| 3     | blocked by 2                                         |                                               |
| 4     | ready once wave 1 lands                              |                                               |
| 5     | blocked by 4                                         |                                               |

Backlog: B-23 is claimed by `prd/routing` (in-progress). Mark it `done` after slice 5 merges.

**Slice 1's decision for slices 2–5: client middleware**, which works in both builds. The group middleware (`lib/group.tsx`) records the group, or the `notOnDevice` error, with `setGroup`. It never throws, because a middleware throw on native's first load lands in the root boundary. Every loader and action under the group route calls `getGroup(context)` first; components use `useGroup()`. The /app layout's middleware sets `sessionContext`; read it with `context.get(sessionContext)`, never a second `requireSession`.

**Open issues:**

- `routing.mjs`'s entry step failed twice on the integration stack under load (about 37–54), then passed on the first try at load 17. The loop found no app bug. The check now waits 45 s, retries once, and prints page state on a failure: if it fails again, read that detail.
- Native dev needs `/api` and `/rpc` proxied to a web server, plus the native origin in `AUTH_TRUSTED_ORIGINS`. There's no script for it yet.

## Architectural decisions

Durable decisions every slice follows:

- **Routes** (all under the shared `/app` layout; `clientLoader`/`clientAction` only, no server exports):
  - `/app` (home), `/app/settings` → index (the list), `units`, `timeline`, `account`
  - `/app/groups/:groupId` (group layout) → index (redirects to `timeline`)
    - `timeline` → `new/:kind` (`symptom` | `vital`, optional `?type=<vitalType>`), `:entryId/edit`
    - `entries/:entryId` (and `entries/new?kind=note|event`): **unchanged URLs**
    - `settings` → index (the list), `details`, `members`
- **Route config** stays explicit in `routes.ts`; no file-system routing package, no new dependency.
- **Group context:** the group layout's client middleware opens the session (through `requireSession`), waits for the first sync, finds the group locally and sets a typed context: group row, display name, role, `canWrite`. A missing group throws `notOnDevice` before any child loader runs. Children's loaders read the context; components read it through `useGroup()`, which stays live. If middleware can't be used in the SPA (native) build, the fallback is a per-navigation memoised `loadGroup(request, groupId)` shared by the layout and children. Slice 1 settles which; later slices use whatever it chose.
- **URLs:** one pure `appUrls` module builds every `/app/…` path and carries search params through. Nothing else builds `/app/…` strings. It absorbs `entryUrl`/`newEntryUrl` and the section paths.
- **A folder per route:** `routes/app/<area>/<page>/route.tsx`, with the components, hooks and pure helpers only that route uses beside it. A file moves to `components/` only when a second route uses it.
- **Sheet routes** render inside the timeline's `Outlet`. The timeline's `shouldRevalidate` skips its loader when only the child route changes. Closing goes back to the timeline URL with the current search params, replacing the history entry when the sheet was opened in-app, and pushing it when the sheet was the first page loaded.
- **Settings layouts** (account and group) render a list from a small registry (`id`, label, icon, path) with `aria-current`, plus an `Outlet`. On phones the index is the list and a subpage has a back link to it. On wide screens the list is a side nav and the index redirects to the first subpage.
- **No schema, migration, sync-config, seed or API change.**
- **Hot files:** `routes.ts` (slice 1 rewrites it; later slices append to their own group), `timeline` (slices 2–3), both settings routes (4–5), `GroupMenu`, `UserMenu`, `lib/groupSections.ts`, `lib/liveEntry.ts`.

## How to run this plan

- **Its dependencies are in `dev`:** all of `app-shell`, and `timeline-polish` wave 1 (slices 1–3). `timeline-polish` slices 4–7 are paused until `routing` and `components` land, so nothing else is changing the files slice 1 moves. Check the backlog's PRD table first.
- **Slice 1 runs alone.** It moves every route into its folder and rewrites `routes.ts`, so nothing else can run beside it.
- Then **2 and 4 run in parallel** (the timeline vs. the settings routes). **3 after 2** (same sheet route shell), **5 after 4** (it reuses 4's list and side nav).
- Merge in number order. After each merge, rerun every browser check (this plan touches every screen): `app-shell`, `phase2`, `roundtrip`, `live-notes`, `first-sync`, `sign-in`, `signout-wipe` and `layout-offline` (the last two with a timeout), plus `routing.mjs` once it exists.
- Every slice ends with `pnpm check`, `pnpm build:native` (no server exports; `HydrateFallback` only in `root.tsx`), its browser checks, and a hand-off (AGENTS.md, _Loop rules_).
- **Land after slice 1** before starting the next wave: `providers` and `medications` should build on the group route.

```
1 ──┬── 2 ── 3
    └── 4 ── 5
```

---

## Slice 1: The group route, the URL module and a folder per route

**User stories:** US 11–14, 23–28. **Blocked by:** none (`app-shell` and `timeline-polish` wave 1 are in `dev`). **Blocks:** 2, 3, 4, 5.

### What to build

Add the `/app/groups/:groupId` layout route. Its middleware loads the group once and sets the group context; the timeline, the entry page and group settings read it instead of loading the group, role and write access themselves, and their own "not on device" handling goes. `/app/groups/<id>` on its own redirects to the timeline. Prove the middleware works in both targets (`pnpm dev`, `dev:native` and `build:native`). If it doesn't, use the memoised-loader fallback and say so in the hand-off.

Add `appUrls`, and switch every link, redirect and navigate in the app to it (the frame's menus and nav, the timeline's filters and rows, the entry page, share, home's group list, sign-in's redirect target). Move every `/app` route module into its own folder with its private pieces, and rewrite `routes.ts` as the nested tree (without the sheet and settings children yet). Nothing a user sees changes.

### Acceptance criteria

- [ ] `/app/groups/<Dev Family id>` redirects to its timeline; a non-member's `/app/groups/<id>`, `/timeline`, `/entries/<id>` and `/settings` are each the `/app` 404 and show no names.
- [ ] A slow first sync on a group URL shows "Getting your care groups…", then the page (`first-sync.mjs` passes, and covers a group URL other than the timeline).
- [ ] The group is read once per navigation: no group, role or membership query remains in the timeline's, entry page's or group settings' loaders.
- [ ] A group renamed on another device, or a changed role, shows in the header and on the page without a reload (`useGroup()` is live).
- [ ] `useGroup()` and the context are typed; reading a field the layout doesn't set is a type error.
- [ ] `grep` finds no `/app/` string literal outside `appUrls`, `routes.ts` and the browser checks.
- [ ] Unit tests for `appUrls`: every builder, search params carried through and encoded, unknown values dropped.
- [ ] Every route module is in its own folder; `components/` holds only files used by two or more routes (list any moved in the hand-off).
- [ ] `pnpm build:native` succeeds; the native dev build opens a group's timeline and an entry.
- [ ] Every existing browser check passes unchanged, apart from URL assertions it had to update (listed in the hand-off).

---

## Slice 2: Add-sheet URLs

**User stories:** US 1–6, 8, 10. **Blocked by:** 1. **Blocks:** 3.

### What to build

`timeline/new/symptom` and `timeline/new/vital` (with optional `?type=`) as child routes of the timeline that render the add sheet. The quick-add bar's Symptom and Vitals buttons, and the vital type menu, become links to them, carrying the timeline's filters. The add form saves through the child route's action (the same local writes as today), then closes. Back, Escape, Cancel and saving all close the sheet by leaving the child route, and the timeline underneath keeps its scroll position, loaded pages and filters. A reload or a deep link opens the timeline with the sheet. An unknown kind redirects to the timeline, an unknown `type` is ignored, and a viewer gets the timeline with no form. Start `routing.mjs`.

### Acceptance criteria

- [ ] Quick add → Symptom goes to `…/timeline/new/symptom?<current filters>`, and the sheet opens.
- [ ] After scrolling far enough to load older entries, opening and closing the sheet (by Back, Escape, Cancel and a save) keeps the scroll position and the loaded entries.
- [ ] `?kind=` and `?author=` survive opening and closing.
- [ ] After a save, Back doesn't reopen the sheet; a deep-linked sheet's Back leaves the app's history as expected.
- [ ] Reloading `…/new/vital?type=heartRate` reopens the sheet with Heart rate chosen; `?type=bogus` opens it with no type chosen.
- [ ] `…/new/note` and `…/new/anything` redirect to the timeline (notes and events stay at `entries/new`).
- [ ] As viewer@, `…/new/symptom` shows the timeline and no form.
- [ ] Offline, a sheet URL opens and saves from the device's copy.
- [ ] Unit tests for the sheet route's guard (kind, `type`, role → sheet or redirect target).
- [ ] `routing.mjs` covers the above; `roundtrip.mjs` and `phase2.mjs` pass.

---

## Slice 3: Edit-sheet URL

**User stories:** US 7, 9. **Blocked by:** 2. **Blocks:** none.

### What to build

`timeline/:entryId/edit` as a child route that loads the entry locally and renders the edit sheet. A symptom's or vital's row tap and its ⋯ → Edit become links to it (with the timeline's filters). It saves and closes like the add sheet. A note's or event's edit URL redirects to its entry page; a deleted, missing or other group's entry redirects to the timeline; a viewer is redirected to the timeline. The sheet's title and form come from the entry, as today.

### Acceptance criteria

- [ ] Tapping a symptom row goes to `…/timeline/<id>/edit?<filters>` with the form filled; saving updates the row and closes the sheet.
- [ ] Reloading an edit URL reopens the sheet with the entry's current values.
- [ ] An entry deleted on another device while its edit sheet is open closes the sheet and shows the timeline (no error).
- [ ] A note's edit URL lands on `…/entries/<id>`; a deleted entry's and another group's entry's edit URL land on the timeline.
- [ ] viewer@'s edit URL shows the timeline and no form; row taps for symptoms and vitals still do nothing for viewers.
- [ ] Unit tests extend the guard (entry kind, deleted, role).
- [ ] `routing.mjs` covers the above; `roundtrip.mjs` (edit, delete, validation, offline) and `phase2.mjs` pass.

---

## Slice 4: Account settings subpages

**User stories:** US 15–18, 21, 22. **Blocked by:** 1. **Blocks:** 5.

### What to build

The settings list (a registry of Units, Timeline layout and Account) and the layout that renders it. `/app/settings` is the list on phones, with each subpage at `/app/settings/units`, `/timeline` and `/account` showing a back link to it. At wide widths, the list is a side nav beside the open subpage and `/app/settings` redirects to Units. Today's units and timeline layout controls move to their subpages unchanged (same `saveSettings` writes). Account shows the name and email read-only, plus Sign out. The user menu's Settings goes to `/app/settings`. The list and side nav are generic, so group settings (slice 5) reuses them.

### Acceptance criteria

- [ ] At 420 wide, `/app/settings` shows three items; each opens its subpage, which has a back link to the list.
- [ ] At 1280 wide, `/app/settings` lands on Units with the side nav; the current item has `aria-current="page"`.
- [ ] Units and Timeline layout save exactly as before, offline included (`layout-offline.mjs` passes).
- [ ] `/app/settings/units` works as a direct link and after a reload.
- [ ] Account shows the name and email, and Sign out signs out (`signout-wipe.mjs` passes).
- [ ] Unit test for the list's active-item rule.
- [ ] `routing.mjs` covers the list and the side nav; `app-shell.mjs` passes.

---

## Slice 5: Group settings subpages

**User stories:** US 19–22. **Blocked by:** 4. **Blocks:** none.

### What to build

Group settings on the same list and layout as slice 4: `/app/groups/:groupId/settings` is the list (Details, Members) on phones, with `settings/details` and `settings/members` as subpages; at wide widths, the side nav plus Details. The details and members content built by `app-shell` slices 5–6 moves into the subpages unchanged, including its intents, permissions, offline notice and confirms. The group menu's "Group settings" goes to the list. Leaving the group still goes to `/app`.

### Acceptance criteria

- [ ] At 420 wide, group settings shows Details and Members; each opens with a back link. At 1280 wide, Details opens beside the side nav.
- [ ] Every `app-shell` group settings behavior passes in its new place: rename, recipient edits, role changes, remove, leave, last-owner refusals, viewer read-only, offline notice.
- [ ] A non-member's `…/settings/members` is the 404 with no names.
- [ ] `…/settings/members` works as a direct link and after a reload.
- [ ] `routing.mjs` covers the group list and side nav; `app-shell.mjs` passes.

---

## For the orchestrator

- **Claim:** B-23 when slice 1 starts. Mark it `done` after slice 5 merges.
- **Land after slice 1** before starting slices 2 and 4, so other PRDs (`providers`, `medications`) can sync onto the group route and `appUrls`.
- **Tell other running PRDs** when slice 1 lands: new group screens are children of the group route, and links go through `appUrls`.
- The `components` PRD (B-24) starts only after this one has fully landed.
