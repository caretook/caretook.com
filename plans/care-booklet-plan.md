# Plan: The printed care booklet

> Source PRD: [`plans/care-booklet-prd.md`](care-booklet-prd.md). User-story numbers (US) refer to it. Items B-918, B-1024, B-1031. Topic `care-booklet`, after `data-rights`.

## Status

| Slice | Wave | State   | Merge into `prd/care-booklet` (slice commits) |
| ----- | ---- | ------- | --------------------------------------------- |
| 1     | 1    | planned |                                               |
| 2     | 2    | planned |                                               |
| 3     | 3    | planned |                                               |
| 4     | 3    | planned |                                               |
| 5     | 3    | planned |                                               |
| 6     | 3    | planned |                                               |
| 7     | 3    | planned |                                               |

**Backlog:** claim B-918 when slice 1 starts, B-1031 with slice 6, B-1024 with slice 7. `risa backlog done` B-918 after slices 1 to 5, B-1031 after 6, B-1024 after 7.

## Architectural decisions

Durable decisions every slice follows:

- **One page contract:** every booklet page is one file in `apps/web/app/routes/app/groups/booklet/pages/` exporting `page: BookletPage<T>` (PRD _The booklet area_). The booklet finds pages by glob; no slice after the second edits the route, the contract or another page's file.
- **Order numbers are fixed** in the PRD (_The booklet area_, "Order numbers"); a page takes its own.
- **Local data only:** pages read the device's local copy through existing `lib/` queries and loaders (import, never edit: those folders belong to other topics), and keep live with `useLiveQuery` seeded from `load`. No server call, no schema change, no migration, no new dependency.
- **Who sees a page** is its `visible(role)`, matching what the device holds (PRD _Decisions_).
- **Tests sit beside the route**, never inside `pages/` (the glob skips `*.test.tsx`, but keep them out anyway). One test file per slice, named in its `Check:`.
- **Loops don't edit docs.** At landing the orchestrator writes `docs/domain/booklet.md` (the page contract, order numbers, who sees what), adds `booklet` to AGENTS.md's _Area index_, notes the booklet in [profiles](../docs/domain/profiles.md) and [medications](../docs/domain/medications.md), and files the `fixes-nit` item to move the three existing sheets into a feature folder after `med-intervals` lands (PRD _Notes_).

## How to run this plan

- **Wave 1:** slice 1 alone (the pure contract and the URL).
- **Wave 2:** slice 2 alone (the route and the front page; every page slice builds on it).
- **Wave 3:** slices 3 to 7 at once. Each adds its own page files and its own test file; none edits slices 1 and 2's files, and no two share a file (slice 4 alone touches the profile folder).
- **Seven slices**, one over the usual six: the send-back split the frame in two, and the page slices stay together so the booklet lands usable.
- **Gates:** each slice's `Check:` and `risa check`; the wave gate runs the component tests of `routes/app/groups/booklet/`, `profile/` and `medications/print/`.

## Slice 1: The page contract and the booklet's URL

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md · Tests: unit · Blocked by: none · Check: apps/web/app/lib/booklet/booklet.test.ts (new)

**User stories:** 3, 6 (the rules under the frame).

**Build** (PRD: _The booklet area_, "The page contract", "Discovery", "Selection"):

- `apps/web/app/lib/booklet/booklet.ts` (new, pure): the `BookletPage<T>` and `BookletPageId` types, `collectPages(modules)` (each module's `page`, sorted by order; throws on a duplicate id or order), `bookletSelection(pages, role, pagesParam)`, `pagesParam(selectedIds)`.
- `apps/web/app/lib/booklet/urls.ts` (new): `bookletUrls.booklet(groupId, pages?)` (`?pages=` comma-joined ids; omitted for all), composed into `apps/web/app/lib/app-shell/appUrls.ts` (append, as the other areas).

**Acceptance criteria** (`apps/web/app/lib/booklet/booklet.test.ts` (new), web:unit):

- [ ] `collectPages` sorts by order and throws on two pages with the same id or the same order.
- [ ] `bookletSelection`: no `?pages=` selects every visible page; `pages=front` selects only it; an unknown id is ignored; an empty `pages=` selects none; a page whose `visible` is false for the role is left out entirely.
- [ ] `appUrls.booklet(groupId)` and `appUrls.booklet(groupId, ["front", "medications"])` give `…/booklet` and `…/booklet?pages=front,medications`, and `pagesParam` round-trips through `bookletSelection`.

**Blocks:** 2.

## Slice 2: The booklet page and the front page

Stack: no · Reads: docs/domain/components.md, docs/domain/ui-kit.md, docs/domain/profiles.md · Tests: component · Blocked by: 1 · Check: apps/web/app/routes/app/groups/booklet/booklet.browser.test.tsx (new)

**User stories:** 1, 2, 3, 4, 11.

**Build** (PRD: _The booklet area_, "The route", "A shared page header"; _The pages_, "Front page"):

- `apps/web/app/routes/app/groups/booklet/routes.ts` (new) with `route("booklet", …)`, appended to the group's children in `apps/web/app/routes.ts`; `scripts/project/check-areas.d/booklet` (new: the folder's component tests, `-`).
- `apps/web/app/routes/app/groups/booklet/route.tsx` (new): the glob into `collectPages`, `clientLoader` (visible pages' `load`s), the checklist (`CheckField` per page), Print, the ticked pages in `data-booklet-page` wrappers with page breaks, `BookletPageHeader` (in this file or beside it), `shouldRevalidate`. Its `<main>` carries `data-print-page`, as the existing print routes do, so `app.css`'s print block (and its `@page weekly`) applies.
- `apps/web/app/routes/app/groups/booklet/pages/front.tsx` (new): the front page (order 10, every role).

**Acceptance criteria** (`apps/web/app/routes/app/groups/booklet/booklet.browser.test.tsx` (new)):

- [ ] An owner opening `…/booklet` sees the checklist with the front page ticked and the front page showing the recipient's name, preferred name, birthday and age, code status, allergies (most severe first) and active conditions, and the header's printed date in the recipient's zone.
- [ ] Unticking the front page sets `?pages=` (empty) and disables Print; `?pages=front` opened directly ticks only it.
- [ ] Under `commands.media("print")` the checklist and frame are hidden and each page wrapper but the first breaks before.
- [ ] A viewer sees the front page.
- [ ] Offline (the local database only, no `api` calls) the page renders.

**Blocks:** 3, 4, 5, 6, 7.

## Slice 3: The medication list and weekly sheet in the booklet

Stack: no · Reads: docs/domain/components.md, docs/domain/medications.md · Tests: component · Blocked by: 2 · Check: apps/web/app/routes/app/groups/booklet/medicationPages.browser.test.tsx (new)

**User stories:** 1, 5.

**Build** (PRD: _The pages_, "Medication list … emergency sheet"; _Notes_, "The import exception"):

- `apps/web/app/routes/app/groups/medications/print/index.ts` (new): re-exports the list's sheet component, loader and live hook. `apps/web/app/routes/app/groups/medications/print/week/index.ts` (new): the weekly chart, its loader, its live hook and the week-start helper the weekly route uses. No other edit in those folders (`med-intervals` owns them).
- `apps/web/app/routes/app/groups/booklet/pages/medications.tsx` (new): order 20, every role, with `PrintAllergies` and `PrintConditions` as on the list route.
- `apps/web/app/routes/app/groups/booklet/pages/weekly.tsx` (new): order 30, every role, landscape, this week. It wraps `useWeeklySheet` as it is: the hook fixes its own `now` and reads `useGroup()`, so the booklet's `now` doesn't reach it (a harmless difference of moments).

**Acceptance criteria** (`apps/web/app/routes/app/groups/booklet/medicationPages.browser.test.tsx` (new)):

- [ ] A member's booklet lists the front page, medication list and weekly sheet in that order; the list shows a current medication's row and the allergies block as its standalone route does; the weekly sheet shows this week's Monday and a pass's G/S/R boxes.
- [ ] A viewer gets both pages.
- [ ] The weekly page's wrapper carries the weekly named page (`[page:weekly]`), so it prints landscape.
- [ ] The standalone medication print tests pass unchanged (the wave gate runs them).

**Blocks:** none.

## Slice 4: The emergency sheet in the booklet, and Print from the profile opens it

Stack: no · Reads: docs/domain/profiles.md, docs/domain/components.md · Tests: component · Blocked by: 2 · Check: apps/web/app/routes/app/groups/profile/profile.browser.test.tsx

**User stories:** 7, 6, 5.

**Build** (PRD: _Decisions_, "The profile header's Print"; _The pages_, "Medication list … emergency sheet"):

- `apps/web/app/routes/app/groups/profile/print/index.ts` (new): re-exports `EmergencySheet`, `loadEmergencySheetRows`, `useEmergencySheet`. No other edit in that folder.
- `apps/web/app/routes/app/groups/booklet/pages/emergency.tsx` (new): order 40, `visible` = `canReadRecipient(role, "details")`.
- `apps/web/app/routes/app/groups/profile/ProfileHeader.tsx`: `PrintLink` goes to `appUrls.booklet(groupId)` with `aria-label="Print care booklet"`, shown to every member (not only detail readers); Edit's rules unchanged.
- `apps/web/app/routes/app/groups/profile/profile.browser.test.tsx`: the Print expectations follow (`PRINT_URL` becomes the booklet's; the viewer now has Print), and the booklet route joins the world through `profileWorld`'s extra `routes`, so a test follows Print into the booklet.

**Acceptance criteria** (`profile.browser.test.tsx`):

- [ ] Owner, caretaker and viewer each see Print on the profile, linking to `…/booklet`, offline too.
- [ ] Following Print, a caretaker's booklet lists and shows the emergency sheet (an emergency contact's name); a viewer's lists neither it nor its content.
- [ ] Edit still shows only for writers and stays disabled offline; the emergency sheet's own page tests pass unchanged (the wave gate runs them).

**Blocks:** none.

## Slice 5: The providers list

Stack: no · Reads: docs/domain/components.md, docs/domain/providers.md · Tests: component · Blocked by: 2 · Check: apps/web/app/routes/app/groups/booklet/providersPage.browser.test.tsx (new)

**User stories:** 8, 1.

**Build** (PRD: _The pages_, "Providers list"):

- `apps/web/app/routes/app/groups/booklet/pages/providers.tsx` (new, order 50, every role): the pure `providersSheet(providers)` builder (in the page file, or a sibling file beside the route if long) and the sheet with `BookletPageHeader`, over `providersQuery` (live only, lib/providers).

**Acceptance criteria** (`apps/web/app/routes/app/groups/booklet/providersPage.browser.test.tsx` (new)):

- [ ] Providers are grouped clinicians, practices, pharmacies, other (`PROVIDER_TYPES`), by name within a group; each shows specialty, every labelled phone and the address.
- [ ] A deleted provider is left out; with none, "No providers yet."
- [ ] A viewer gets the page.

**Blocks:** none.

## Slice 6: The care team contacts sheet

Stack: no · Reads: docs/domain/components.md, docs/domain/profiles.md, docs/domain/providers.md, docs/domain/care-groups.md · Tests: component · Blocked by: 2 · Check: apps/web/app/routes/app/groups/booklet/contactsPage.browser.test.tsx (new)

**User stories:** 9, 6.

**Build** (PRD: _The pages_, "Care team contacts"):

- `apps/web/app/routes/app/groups/booklet/pages/contacts.tsx` (new, order 60, every role) and its pure `contactsSheet(...)` builder (in the page file, or a sibling beside the route if long): Call first from `emergencyEntries` (lib/profiles emergencyList) over the members (lib/care-groups members sync) and, for members who pass `canReadRecipient(role, "outsideContacts")`, outside contacts (lib/profiles recipient details sync); Care team from the member-share rows; Providers to call with the after-hours callout; Pharmacies.

**Acceptance criteria** (`apps/web/app/routes/app/groups/booklet/contactsPage.browser.test.tsx` (new)):

- [ ] An owner's sheet lists Call first in emergency order with the primary marked, an outside contact included; the care team with relationships and shared phones; a clinician's phone labelled "After hours" under the after-hours heading; a pharmacy's phone under Pharmacies.
- [ ] A viewer's sheet has no outside contacts and no recipient details, and still lists members and providers.
- [ ] Empty sections are left out.

**Blocks:** none.

## Slice 7: The todo sheet

Stack: no · Reads: docs/domain/components.md, docs/domain/todos.md · Tests: component · Blocked by: 2 · Check: apps/web/app/routes/app/groups/booklet/todosPage.browser.test.tsx (new)

**User stories:** 10, 1.

**Build** (PRD: _The pages_, "Todos"):

- `apps/web/app/routes/app/groups/booklet/pages/todos.tsx` (new, order 70, every role, `marks` as the PRD says) and its pure `todoSheet(todos, now, timeZone)` builder (in the page file, or a sibling beside the route if long), over `todosQuery` (lib/todos; open, not deleted) and the members for assignee names; `TODO_WRITE_IN_ROWS = 8`. Top-level todos only, a subtask indented under its parent; a repeating todo prints its current open instance (record both as assumed in the hand-off).

**Acceptance criteria** (`apps/web/app/routes/app/groups/booklet/todosPage.browser.test.tsx` (new)):

- [ ] Open todos only (a done and a deleted one left out), overdue and today first, then by due date, no due date last; each row has a tick box, title, due, assignee and initials box.
- [ ] Eight blank write-in rows follow, and the header shows the page's marks line.
- [ ] A viewer gets the page; with no open todos it shows the write-in rows alone.

**Blocks:** none.
