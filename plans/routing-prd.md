# PRD: Routing (nested group routes, sheet URLs, settings subpages, a folder per route)

Status: 🟡 written, not planned. Backlog item: B-23. Topic `routing`. Runs after `app-shell` and `timeline-polish` land; `components` follows it.

## Problem Statement

Every `/app` screen is a flat sibling under the one `/app` layout. The timeline, the entry page and (soon) group settings each look up the group, the user's role and whether they can write, and each repeats the "not on this device yet / not a member" handling. Anything that belongs to a group has no parent route to hang off, so each new group screen (Medications, Providers, Assistant) will copy that setup again.

Some screens have no URL at all. Adding or editing a symptom or vital opens a sheet held in the timeline's component state: Back on a phone leaves the timeline instead of closing the sheet, a reload loses it, and nobody can link to "add a vital". Settings is one long page, and group settings will be too (details and members).

The route modules are also single files that hold the loader, the action, the page and its private pieces. The timeline and entry routes are about 350 lines each, and their private components and helpers have nowhere to live except the shared components folder.

## Solution

Give every page its own path, nested where the UI is nested:

- **A group route**, `/app/groups/:groupId`, is a layout that loads the group once: its row, the recipient's display name, your role and whether you can write. It owns the 404 and "Getting your care groups…" handling. Its children read that context instead of loading it again. `/app/groups/:groupId` on its own goes to the timeline.
- **Sheets get URLs.** Under the timeline: `timeline/new/symptom`, `timeline/new/vital` (optionally `?type=heartRate`) and `timeline/:entryId/edit`. The sheet renders over the timeline, which stays mounted underneath with its scroll position, loaded pages and filters (`?kind=`, `?author=`) intact. Back, Escape, Cancel and a save all close it by leaving the sub-route. Links work: opening one goes straight to the timeline with the sheet open.
- **Settings subpages.** `/app/settings` becomes a short list (Units, Timeline layout, Account) linking to `/app/settings/units`, `/app/settings/timeline` and `/app/settings/account`. Group settings becomes `/app/groups/:groupId/settings` (the list) with `…/settings/details` and `…/settings/members`. On wide screens the list stays beside the open subpage as a side nav, and `/settings` shows the first subpage.
- **A folder per route.** Each route module lives in its own folder with the components, hooks and helpers only it uses. `routes.ts` stays the one explicit route config.

Nothing a user does today changes, except that sheets and settings subpages now have their own URL. Entry links (`/entries/:id`, `/entries/new?kind=`) and share links keep working unchanged.

## User Stories

1. As a caretaker adding a symptom on a phone, I want the Back gesture to close the sheet, so that I don't leave the timeline by accident.
2. As a caretaker, I want Escape, Cancel and saving to close the sheet the same way Back does, so that the history never has a stale sheet in it.
3. As a caretaker, I want the timeline to keep my scroll position and loaded entries when a sheet opens and closes, so that I don't lose my place.
4. As a caretaker, I want my kind and author filters kept when a sheet opens and closes, so that the list I was looking at comes back.
5. As a caretaker, I want to reload the page with a sheet open and still see it, so that a refresh doesn't throw away what I was about to log.
6. As a caretaker, I want a link that opens "add a vital" with the type already chosen, so that a reminder or bookmark gets me there in one tap.
7. As a caretaker, I want editing a symptom or vital to have its own URL, so that I can come back to it from history.
8. As a viewer, I want an add or edit sheet URL to show me the timeline without a sheet, so that I'm never shown a form I can't use.
9. As a caretaker, I want an edit URL for an entry that was deleted, or isn't a symptom or vital, to land on the timeline (or the entry's page for notes and events), so that old links don't break.
10. As a caretaker offline, I want sheet URLs to work from the device's copy, so that logging works anywhere.
11. As a user, I want `/app/groups/<id>` on its own to open that group's timeline, so that a trimmed URL still goes somewhere useful.
12. As a non-member, I want every route under a group to be the same 404 that shows no names, so that nothing about the group leaks.
13. As a user on a slow first sync, I want every group route to show "Getting your care groups…" and then the page, so that I never see a wrong "not found".
14. As a user, I want the group's name and my role in the header to stay put while I move between the group's pages, so that the frame doesn't flicker.
15. As a user on a phone, I want Settings to open as a short list, so that I can see everything I can change without scrolling.
16. As a user on a phone, I want each settings subpage to have a back link to the list, so that moving between them is easy.
17. As a user on a wide screen, I want the settings list beside the open subpage, so that I can switch subpages in one click.
18. As a user, I want a link straight to the units settings, so that I can be sent there from a vitals form.
19. As an owner or admin, I want group settings split into Details and Members, so that each page is short.
20. As a viewer, I want to see group settings' Details and Members read-only, so that I know who's in the group.
21. As a user, I want the current settings subpage marked in the list and announced to screen readers, so that I know where I am.
22. As a user, I want the user menu's "Settings" and the group menu's "Group settings" to open the list (phones) or the first subpage (wide screens), so that they behave as before.
23. As a user with a shared entry link, I want `/entries/:id` to work exactly as before, so that links already sent keep working.
24. As a native-app user, I want every new route to work in the static build, so that the app works without a server.
25. As a developer of a later PRD, I want a new group section to be a child of the group route that gets the group context for free, so that Medications doesn't repeat the timeline's setup.
26. As a developer, I want each route's private components and hooks in the route's folder, so that I can find everything a page uses in one place.
27. As a developer, I want the group context typed, so that a child can't read a field the layout doesn't load.
28. As a developer, I want one place that builds every app URL, so that a route move changes one function, not every link.

## Implementation Decisions

- **Route config stays explicit** in `routes.ts` (no file-system routing package; no new dependency). Routes are grouped by nesting, and each module path points into its folder.
- **The tree:**
  - `/app` layout (unchanged frame, from `app-shell`)
    - index (home), `settings` layout → index (list), `units`, `timeline`, `account`
    - `groups/:groupId` layout → index (redirect to `timeline`)
      - `timeline` → `new/:kind` (symptom or vital), `:entryId/edit`
      - `entries/:entryId` (including `new?kind=`)
      - `settings` layout → index (list), `details`, `members`
      - later sections (Medications, Providers…) are new children here
- **Group context through route middleware.** The group layout's client middleware opens the session, waits for the first sync, finds the group locally and sets a typed group context (group row, display name, role, `canWrite`). It throws `notOnDevice` before any child loader runs, so 404 and first-sync handling live in one place. Children's `clientLoader`s read it from `context`; components read it through one hook (`useGroup()`), which also keeps it live (a renamed group or changed role shows without a reload). React Router 8.5.1 ships middleware; if it can't be used in SPA mode, the fallback is a per-navigation memoised `loadGroup(request, groupId)` that the layout and children share. The first slice proves which.
- **`requireSession` stays the one session check;** the group middleware builds on it and doesn't open a second database.
- **Sheet routes:**
  - `timeline/new/:kind` accepts `symptom` and `vital` only (notes and events stay at `entries/new?kind=`); anything else redirects to the timeline. `?type=` preselects a vital type and is ignored when unknown.
  - `timeline/:entryId/edit` loads the entry locally. A note or event redirects to its entry page, a deleted or missing entry to the timeline, a viewer to the timeline.
  - The timeline renders an `Outlet`; the child route renders `EntrySheet` + `EntryForm`. Writes go through the child route's `clientAction` (the same local writes as today), then navigate back.
  - Closing navigates to the timeline URL with the current search params, **replacing** the history entry when the sheet was opened in-app (so Back after a save doesn't reopen it), and pushing when the sheet was the first page loaded.
  - The timeline's `shouldRevalidate` doesn't rerun its loader when only the child route changes, so infinite-scroll pages, scroll position and live queries are untouched.
- **Settings layouts** (account and group): the layout renders the list and an `Outlet`. On phones the index route shows the list and a subpage shows only itself, with a back link. On wide screens the list is a side nav and the index redirects to the first subpage. The list items are a small registry (`id`, label, icon, path), like `GROUP_SECTIONS`, and rendered with `aria-current`. Group settings' content comes from `app-shell` slices 5–6 and is moved, not rewritten. Account holds what doesn't fit Units or Timeline layout (name, email, sign out), read-only for now.
- **URLs in one module.** A pure `appUrls` module builds every app path (`groupHome`, `timeline(groupId, search)`, `newSheet(groupId, kind, { type, search })`, `editSheet`, `entry`, `newEntry`, `settings(sub)`, `groupSettings(groupId, sub)`). It absorbs `entryUrl`/`newEntryUrl` and `GROUP_SECTIONS`' paths, and the timeline's filter-state module (from `timeline-polish`) uses it for the base path. Nothing else builds `/app/…` strings.
- **Folder per route:** `routes/app/<area>/<page>/route.tsx` plus private files beside it (components, hooks, pure helpers and their tests). A component moves to the shared components folder only when a second route uses it. This PRD moves files and splits what moves; deeper component work is the `components` PRD.
- **Frame regions are unchanged.** `GroupMenu`, `SectionNav` and `TabBar` read the group from the group context instead of `useParams()` + their own queries where that's simpler. The tab bar's "hidden on `/entries/*`" rule is unchanged; it shows under sheet routes (the sheet covers it, `z-50`).
- **No schema, migration, sync-config, seed or API change.**
- **Hot files:** `routes.ts` (rewritten in slice 1), `layout.tsx` (frame untouched, only its loader may slim down), `timeline.tsx`, `entry.tsx`, both settings routes, `GroupMenu`, `UserMenu`, `lib/groupSections.ts`, `lib/liveEntry.ts`. That's why it waits for `app-shell` and `timeline-polish` to land, and why `components` waits for it.
- **Suggested slices:** (1) group layout route + middleware/context + `appUrls` + folders for the existing routes, behavior unchanged; (2) sheet routes; (3) account settings subpages; (4) group settings subpages. 2, 3 and 4 can run in parallel after 1.

## Testing Decisions

- A good test checks what a user or caller sees (the URL, the page, the 404, the value returned), not how routes are wired inside.
- **Unit (`web:unit`):** `appUrls` (every builder, search params carried through and encoded), the sheet route's guard (kind, `type`, entry kind, role → sheet, redirect target), and the settings list registry's active-item rule. Prior art: `groupSections.test.ts`, `liveEntry.test.ts`.
- **Browser checks:** all existing checks must pass unchanged (`roundtrip.mjs` covers the sheet's add, edit, delete, validation, offline and viewer flows; `phase2.mjs` the timeline; `app-shell.mjs` the frame and settings; `live-notes.mjs` the entry page and share links). Update their selectors only where a URL is now asserted.
- **A new `routing.mjs`:** Back closes a sheet and keeps scroll position and filters; a reload with a sheet URL reopens it; a deep link to `new/vital?type=heartRate` preselects the type; the edit URL for a note goes to its page; a viewer's sheet URL shows no form; `/app/groups/<id>` lands on the timeline; a non-member's group URLs are 404s with no names; the settings list on a phone and the side nav at 1280; `routeDiscovery` works offline for a sheet URL. It follows the checks' rules (tags its own entries, cleans up, order-independent).
- `pnpm build:native` must succeed (no server exports, `HydrateFallback` only in root).

## Out of Scope

- File-system route conventions or any new routing package.
- Changing entry or share URLs (`/entries/:id` stays).
- Making notes and events open in a sheet, or symptoms and vitals open on a full page.
- New settings (anything beyond moving today's Units and Timeline layout, plus a read-only Account page).
- Refactoring components beyond moving them into route folders (that's the `components` PRD).
- Offline web reload (still needs a service worker).

## Further Notes

- Source: the inbox line "Split app routing/nesting into subpaths for each page instead of using a single root route" (B-23).
- Interview decisions (2026-11-18): all four parts (group layout route, sheet URLs, settings subpages, a folder per route); sheets nest under the timeline; settings are an index list with subpages; two separate PRDs, this one first, both after `app-shell` and `timeline-polish` land.
- Later PRDs (`providers`, `medications`, `assistant`) should add their sections as children of the group route and build links through `appUrls`. If one of them starts before this lands, it adds its route the current way and this PRD moves it.
