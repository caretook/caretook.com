# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs

- Login link allows clicking multiple times while already loading login flow... login flow very slow. (B-1)
  Status (2026-11-17): planned. Double submit is quick-fixes slice 1. The slowness was split out as B-22 (quick-fixes slice 3: measure first, then fix).

## Change requests

- Latest vitals is too busy. (B-2)
  Status (2026-11-17): PRD written (timeline-polish). One line with the 2–3 most recent readings and "All vitals ›" to expand. Not sliced yet.
- Width of timeline entries can be larger on larger screens while still being mobile-friendly on smaller screens. (B-3)
  Status (2026-11-17): PRD written (timeline-polish). Full width on large screens, entry text capped at ~75 characters, cards in a 2–3 column grid. Phones unchanged.
- Hover actions on timeline author shorthand should show a tooltip with the author's name and avatar. (B-4)
  Status (2026-11-17): PRD written (timeline-polish). Hover/focus tooltip on desktop; on touch, the author filter chip shows the name and avatar.
- Clicking the icon on a timeline entry should filter by that type of entry. (B-5)
  Status (2026-11-17): PRD written (timeline-polish). Combines with the author filter; tapping a filter that's already on does nothing.
- Clicking on the author shorthand should filter by that author. (B-6)
  Status (2026-11-17): PRD written (timeline-polish). New `?author=` filter with a "By (name) ✕" chip.
- Larger/more prominent font for date entries in timeline. (B-7)
  Status (2026-11-17): PRD written (timeline-polish). Larger semibold sticky headers: Today, Yesterday, then "Monday, Nov 16".

## Feature requests

- Use avatar for "user" in header with a dropdown menu for user related actions/settings. (B-8)
  Status (2026-11-17): planned (app-shell slices 1, 2 and 7). Menu has name and email, Settings, theme (per device), Sign out. Slice 1 is ready to run.
- Use dropdown on current care group to change care group settings or switch to another care group. (B-9)
  Status (2026-11-17): planned (app-shell slices 3–6). Group switcher, last-used group, bottom tabs, group settings (name, recipient, members and roles). Waits on slice 1.
- Timeline should infinite scroll through all entries without clicking. (B-10)
  Status (2026-11-17): PRD written (timeline-polish). Auto-loads near the bottom; the "Show older" button goes away.
- Need to add elasticsearch based search to the timeline. (B-11)
  Status (2026-11-17): PRD not written yet (search). Proposed: on-device SQLite full-text search (works offline) plus Postgres full-text search on the server, instead of Elasticsearch. Waits on timeline-polish.
- Split app routing/nesting into subpaths for each page instead of using a single root route. (B-23)
  Status (2026-11-18): planned (routing, 5 slices). Group layout route, URLs for the symptom/vital sheets, settings subpages, a folder per route. Runs after app-shell and timeline-polish land.
- Prefer well abstracted components over single-file components and refactor existing components to be more abstracted. (B-24)
  Status (2026-11-18): planned (components, 6 slices). UI primitives, thin routes, feature folders, no duplicates, in four waves. Runs after routing.

## Big plans

- Plan lightweight agentic chat options (with voice support) for quick actions (like adding a note, symptom, event, vital, etc.) and for asking questions about the timeline. (B-12)
  Status (2026-11-17): PRD not written yet (assistant). Waits on search; providers and medications help.
- Add in providers directory with search and linking to event entries in timeline. (B-13)
  Status (2026-11-18): planned (providers, 7 slices; the data slice can start now). One directory (clinicians, practices, pharmacies, other contacts) with live notes, primary and past; plan after routing and components land.
- Add provider linking/suggestions to event entries in timeline and live notes. (B-14)
  Status (2026-11-18): PRD written (providers). A "With" row on events and notes (several providers each), with suggestions from the title, past titles and recent links.
- Work on medication list management and tracking in timeline. (B-15)
  Status (2026-11-18): PRD written (medications): the list with simple schedules, dose and medication-change entries in the timeline, Today/Due now/Dose sheet, a printable sheet. Allergies filed separately.

## Questions

- How does timeline format persist? (B-16)
  Status (2026-11-17): answered. Saved on your account (preferences.timelineView) and cached on the device for offline use. A change made offline is lost: filed as B-17, quick-fixes slice 2.
