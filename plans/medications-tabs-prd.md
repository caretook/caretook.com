# PRD: Medications tabs

Backlog: B-226 (the Medications page split into Schedule and Medications tabs). Topic `medications-tabs`.

## Problem Statement

The Medications page is one long screen: the header, the recipient's allergies, Today (what's due, with Given, Skipped and Refused), then search, the status and type chips, and the whole list. A caretaker giving a round scrolls past the list's controls, and one looking up a medication scrolls past today's doses. On a phone the two jobs crowd each other.

## Solution

Two tabs under one header: **Schedule** (today's doses, by pass) and **Medications** (the allergies, search, filters and the list). Each tab has its own URL, so links, Back and the bottom tab bar land on the right one. Schedule opens first. The add, edit and allergies sheets open over whichever tab you were on and return to it.

The tabs come from a new standard primitive, `TabNav`, which later pages reuse for their own tabs.

## User Stories

1. As a caretaker, I want Medications to open on today's doses, so that giving a round is the first thing I see.
2. As a caretaker, I want the list on its own tab, so that searching and filtering aren't buried under today's doses.
3. As a caretaker, I want the tabs at the top of the page under the title, so that I can switch with one tap.
4. As a caretaker, I want the current tab clearly marked, so that I know where I am.
5. As a caretaker, I want each tab to have its own address, so that Back returns me to the tab I came from.
6. As a caretaker, I want a tapped tab to highlight at once, even before its screen appears, so that the app feels quick.
7. As a caretaker using a screen reader, I want the tabs announced as navigation with the current one marked, so that I can move between them.
8. As a keyboard user, I want to reach and follow each tab with the keyboard, so that I don't need a pointer.
9. As a caretaker, I want Add, Print and the page title in one header above both tabs, so that they're always in the same place.
10. As a caretaker, I want the Passes button on the Schedule tab, so that editing rounds sits beside the rounds.
11. As a caretaker, I want the recipient's allergies on the Medications tab, with the list they apply to.
12. As a caretaker, I want to add a medication from either tab and come back to the tab I was on when I close the sheet.
13. As a caretaker, I want editing a medication or the allergies to leave the tab underneath as it was (search, filters, scroll), so that I don't lose my place.
14. As a caretaker, I want my search and filters kept in the list tab's address, so that Back and a reload keep them.
15. As a caretaker, I want the bottom tab bar's Medications button to take me to the Schedule tab, and to stay highlighted on either tab and on a medication's page.
16. As a caretaker, I want the timeline's Today medications row to take me to the Schedule tab.
17. As a caretaker, I want Back on the passes, print and medication pages to take me to the tab they belong to (passes and the weekly sheet to Schedule; the medication list print and a medication's page to the list).
18. As a viewer, I want both tabs readable, without Add or the dose buttons, as today.
19. As a caretaker offline, I want both tabs and the switch between them to work, since they read the device's copy.
20. As a developer, I want one tab primitive, so that the next page with tabs looks and behaves the same.

## Implementation Decisions

- **`TabNav`, a `components/ui/` primitive** (exported from the index; imports nothing from feature folders). Callers pass an accessible label and a list of tabs (`label`, `to`, optional `match` for which paths count as that tab), plus at most an outer `className`. Each tab is a link, not an ARIA `tablist`: tabs that change the URL are navigation (`nav` with the label, `aria-current="page"` on the current one). The current tab follows the pending navigation, like `SectionNav` and `TabBar` (`useNavigation().location`, back to the pathname if cancelled), so a tap highlights at once. Links use `prefetch="render"` so a switch works offline. The look is daisyUI tabs (segmented, `tabs-box`), full width on phones; the user left the style to the implementer, so it is decided once here for every later page.
- **Routes:** `medications` becomes a layout route (the header and `TabNav`, then its outlet). Its children are `schedule` and `list`, each with its own `clientLoader` and live queries (Schedule: the due doses and passes; list: the medications, passes and allergies). Plain `/medications` gets no index or redirect: nothing is live, and every in-app link moves to the new paths.
- **Sheets over either tab:** the add, edit and allergies sheets (`new`, `:medicationId/edit`, `allergies`) become children of both tab routes, so the tab stays mounted underneath and closing returns to it. Opening the edit sheet from a medication's page opens it over the list, as today.
- **The header:** the title, Add (writers) and the one Print menu (both sheets) sit above both tabs. Passes shows only on Schedule. The header uses `PageHeader` once timeline-ux-2 has put it in `dev`.
- **URLs:** `medicationUrls` gains the schedule and list paths. Its add, edit and allergies helpers take the tab they open over. The Medications group section (`GROUP_SECTIONS`) links to Schedule and keeps matching every `/medications/*` path. The timeline's Today medications row links to Schedule. Back on the passes page and the weekly sheet goes to Schedule. Back on the list print and a medication's page goes to the list.
- **No reloads on sheet changes:** `onlyMedicationSheetChanged` (`medicationSheets.ts`) and both tabs' `shouldRevalidate` treat opening or closing a sheet over either tab as no reload, as the list does today. A switch between tabs runs the new tab's loader.
- **Unchanged:** Today's behaviour and `dueDoses`; the list's filtering (`medicationList`, `?q=`, `?status=`, `?type=`), now on the list tab only; the medication page, the passes page and print. No schema, sync, server or dependency change; no migration.

## Testing Decisions

- Tests check what a person sees and does (which tab is current, what each tab shows, where a link goes), not component internals.
- **`TabNav`:** a component test in the primitives' browser tests (`renderInRouter`): it marks the current tab with `aria-current`, a tap changes the URL and the marked tab, Back returns, the tabs are reachable and followed with the keyboard, and `match` claims nested paths.
- **The Medications screens:** update the existing Today and list component tests (`today.browser.test.tsx`, `medicationList.browser.test.tsx` and the others on `medicationWorld.tsx`) to the new URLs. New cases: each tab shows only its own parts (Today on Schedule; allergies, search, chips and the list on the list tab), Passes only on Schedule, the shared header on both, and the add sheet opening and closing over each tab and returning to it.
- **URL helpers:** unit tests for the new paths in `urls.test.ts`, the Medications section's link and match in `groupSections.test.ts`, and the sheet rules on both tabs in the `medicationSheets` tests.
- No new end-to-end steps: no browser check visits the Medications page, and the flow crosses no server or sync boundary.

## Out of Scope

- The mobile redesign of the Schedule's rows (B-213, `medications-4`). That PRD comes after this one and works inside the Schedule tab.
- Tabs on any other page. `TabNav` is ready for them, but each page is its own item.
- A redirect from plain `/medications`, or remembering the last tab.

## Further Notes

- Runs after timeline-ux-2 is in `dev`, which rewrites this page's header (`PageHeader`). `TabNav` alone can be built first.
- Not alongside `medications-4`: both change the medications page.
