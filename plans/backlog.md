# Backlog tracker

Agents keep this file; you review it. **Add new things in [inbox.md](inbox.md)**, not here. Each item below came from an inbox line (or an agent), and has an id, a status, the PRD it belongs to, and notes.

**Statuses:** inbox (new, not triaged) → triaged (a PRD proposed: check it) → in-progress (claimed) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped.

## PRDs

Which PRDs exist, what each depends on, and the shared files it touches: orchestrators read this to choose what can run at the same time. At most three PRD orchestrators run at once.

| PRD               | Doc                                                          | Depends on                                           | Hot files                                                                   |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `orchestration` | [PRD](orchestration-prd.md), [plan](orchestration-plan.md): **done** (`94e6b80`) | — | none now |
| `live-notes-ux` | [PRD](live-notes-ux-prd.md), [plan](live-notes-ux-plan.md): **done** | — | none now |
| `quick-fixes`     | [plan](quick-fixes-plan.md) (no PRD: one slice per fix): slices 1–46 in `dev` (44–46: B-135, B-134, B-157 in `2d57e70`); wave 13 (slices 47–51: B-184 to B-190) in `dev` (`bf0891df`); wave 14 (slices 52–57: B-192, B-198, B-201, B-191, B-174, B-175) in `dev`; waiting for wave 15: B-180, B-182, B-211 (B-207 landed as hotfix `fc373a34`); new fixes append as slice 58 on |  (none) | varies by slice; none now |
| `app-shell` | [PRD](app-shell-prd.md), [plan](app-shell-plan.md): **done** | — | none now |
| `timeline-polish` | [PRD](timeline-polish-prd.md), [plan](timeline-polish-plan.md): **done** | — | none now |
| `search` | [PRD](search-prd.md), [plan](search-plan.md): **done** (`a5f3d4d`) | — | none now |
| `providers` | [PRD](providers-prd.md), [plan](providers-plan.md): **done** (`7c075d1`) | — | none now |
| `medications` | [PRD](medications-prd.md), [plan](medications-plan.md): **done** (`8ff8354`) | — | none now |
| `medications-2` | [PRD](medications-2-prd.md), [plan](medications-2-plan.md): **done** (`a6738b4`) | — | none now |
| `assistant` | [PRD](assistant-prd.md), [plan](assistant-plan.md): **done** (`7f3ec10`) | — | none now |
| `connectors` | [PRD](connectors-prd.md), [plan](connectors-plan.md): **done** (`a08af6bd`) | — | none now |
| `providers-2` | [PRD](providers-2-prd.md), [plan](providers-2-plan.md): **done** (`df4d0c05`) | — | none now |
| `appointments-2` | [PRD](appointments-2-prd.md), [plan](appointments-2-plan.md): **done** (`f49aa958`) | — | none now |
| `connectors-2` | [PRD](connectors-2-prd.md), [plan](connectors-2-plan.md): **done** (`017a9b29`) | — | none now |
| `medications-3` | [PRD](medications-3-prd.md), [plan](medications-3-plan.md): **done** (`82221a92`) | — | none now |
| `list-filters` | [PRD](list-filters-prd.md), [plan](list-filters-plan.md): 4 slices, waves 1 → (2, 3) → 4: a shared `FilterMenu` (round sliders button, count badge, a dropdown of single-choice sections, removable chips) on the medications list, then the providers directory and the Todos tab, then the Planner (B-249). No migration, no deps, stackless. Replaces `medications-4` (B-213 was resolved by the tab split, B-226). **Ready to start**; slice 4 waits for B-247 | slices 1–3: (none); slice 4: B-247 in `dev` (a `quick-fixes` item) | `components/ui/` (index, `styles.ts`, the new `FilterMenu` and its model), `timeline/TimelineFilters.tsx` and `TimelineViewMenu.tsx` (an import only), `medications/MedicationFilters.tsx` and the list route, `providers/DirectoryFilters.tsx` and its route, `todos/TodoChips.tsx` and its route, the Planner's filter row (`PlannerHeader.tsx`), those screens' component tests |
| `medications-tabs` | [PRD](medications-tabs-prd.md), [plan](medications-tabs-plan.md): **done** (`07a6b59a`, PR #14) | — | none now |
| `conditions` | [PRD](conditions-prd.md), [plan](conditions-plan.md): **done** (`a95acb73`) | — | none now |
| `github-review` | [PRD](github-review-prd.md), [plan](github-review-plan.md): **done** (`63e225fb`, PR #12); follow-ups B-239 to B-242, B-244 | — | none now |
| `routing` | [PRD](routing-prd.md), [plan](routing-plan.md): **done** (`ff25ef2`) | — | none now |
| `components` | [PRD](components-prd.md), [plan](components-plan.md): **done** (`ca39416`) | — | none now |
| `invites` | [PRD](invites-prd.md), [plan](invites-plan.md): **done** (`e6286f4`) | — | none now |
| `marketing` | [PRD](marketing-prd.md), [plan](marketing-plan.md): **done**; B-40 and B-54 wait on the user | — | none now |
| `profiles` | [PRD](profiles-prd.md), [plan](profiles-plan.md): **done** (`88890df`) | — | none now |
| `appointments` | [PRD](appointments-prd.md), [plan](appointments-plan.md): **done** | — | none now |
| `care-periods` | [PRD](care-periods-prd.md), [plan](care-periods-plan.md): **done** (`f6c4e92`) | — | none now |
| `data-rights`     | to write (B-52, B-53, B-84)                                  | (none)                                               | `packages/api`, `lib/sync/client.ts` (wipe), `packages/auth`, account settings |
| `tasks` | [PRD](tasks-prd.md), [plan](tasks-plan.md): **done** (`1ee7864`) | — | none now |
| `documents`       | to write (B-56)                                              | hosting (B-33, file storage); `profiles` (soft); `encryption` decision | file storage, its area's `routes.ts`, `urls.ts`, schema and `permissions/` parts, `GROUP_SECTIONS`              |
| `encryption`      | [security review](security-review.md) (on `plan/encryption`): reviewed 2026-11-19. E2E: option A for launch, C (files) with `documents`; fixes filed as B-79 to B-85 | (none); affects `assistant` and `documents` | none itself: its fixes land through `quick-fixes`, `data-rights`, `account-security` and hosting |
| `onboarding`      | to write (B-31)                                              | `invites` (done)                                     | seeds, `careGroupService`, `/app` home                                     |
| `account-security` | to write (B-85: two-factor required for owners, admins and staff; breached-password check) | `invites` (done); B-80 (the Devices page) first (soft) | `packages/auth`, account settings, group settings Members, `careGroupService` and the access-code and invite flows (owners must enrol) |
| `admin` | [PRD](admin-prd.md), [plan](admin-plan.md): **done** | — | none now |
| `check-migration` | [PRD](check-migration-prd.md), [plan](check-migration-plan.md): **done** (`c7fd1390`) | — | none now |
| `loop-recovery` | [PRD](loop-recovery-prd.md), [plan](loop-recovery-plan.md): **done** | — | none now |
| `hosting` | [PRD](hosting-prd.md), [plan](hosting-plan.md): **done** except going live: waves 1–4 in `dev` (`8b7f683`), `prd/hosting` removed; slice 7 (going live, B-33) is the user's, with a hotfix agent | (none) | none now |
| `app-speed` | [PRD](app-speed-prd.md), [plan](app-speed-plan.md): **folded into `timeline-ux`** (its PRD is the speed half's input) | — | none now |
| `agent-tooling` | [PRD](agent-tooling-prd.md), [plan](agent-tooling-plan.md): **done**, all 6 slices in `dev` (`5d5e1d7`): batched backlog commits, `pnpm log`, the doc budget guard, the core + `docs/agents/` split, the six area docs trimmed | (none) | none now |
| `code-layout` | [PRD](code-layout-prd.md), [plan](code-layout-plan.md): **done** (`18e9cf8`) | — | none now |
| `timeline-ux` | [PRD](timeline-ux-prd.md) (speed half: [app-speed PRD](app-speed-prd.md)), [plan](timeline-ux-plan.md): 10 slices, waves (1, 2, 3) → (4, 5, 6) → (7, 8, 9) → 10: navigation that doesn't wait, tiles that remember (dimmed until fresh), the bundle budget, prefetched tabs, one Today card with status hues, the day header with its summary and rows with the author under the menu and no period places, the service worker, simple mode's order and type scale, quick entry's rotating placeholder, open-after-save and lean recent lines, cheaper `/rpc` auth (B-136–B-140, B-144, B-155, B-156, B-162–B-171). **Done 2026-11-20**: all 10 slices in `dev` (8b3179ab); follow-ups B-174, B-175, B-178, B-179 | wave 1: none; wave 2 on: `code-layout` slice 5 in `dev` (`appUrls`), or coordinate with it | `lib/auth/session.ts`, `lib/auth/sessionRules.ts`, `lib/app-shell/me.ts`, `lib/sync/` (the remembering hook), `recentLines` (at code-layout's paths), `SectionNav`, the `/app` layout (update notice), the timeline route, its strips (replaced by `TodayCard`), `DayHeader`, `DaySummaryLine`, the row components, `PeriodMarkerItem`, `SimpleTimeline`, quick entry, `packages/auth`, `packages/api/src/procedures.ts`, `routes/rpc.ts`, `scripts/loops/prd.sh`, `scripts/loops/check-areas.d/`, new `scripts/build/` |
| `i18n` | to write (B-209: translations for all text; needs a dependency approved) | best after the feature PRDs settle; runs alone | every user-facing string: routes, `ui/`, emails, MCP text, date formatting |
| `timeline-ux-2` | [PRD](timeline-ux-2-prd.md), [plan](timeline-ux-2-plan.md): **done** (`f1fc883e`) | — | none now |
| `quick-entry` | [PRD](quick-entry-prd.md), [plan](quick-entry-plan.md): 4 slices, waves 1 → (2, 3, 4): one vocabulary table of kind-picking words (falls, seizures and the like are symptoms; 911, ER and urgent care are notes; visit verbs make events, contact verbs make notes), provider lines as events (titles, places), "the 25th" and month dates, forward for events and back for past-only kinds; notes that @-mention named providers (`addNote.providerIds`, both runners, the connector's `add_note`); a provider event's Save opens a prefilled new-event draft (mixed lines save the rest with Undo); kind chips on the cards (B-220). No migration, no deps, stackless. **Ready to start** once `timeline-ux-2` and `tasks-2` are in `dev` | `timeline-ux-2` in `dev` (last item B-224); `tasks-2` in `dev` (the to-do rename in actions, `actionPreview`, connector tools; last item B-222) | `packages/data` assistant schema (`quickEntry.ts`, `quickEntryTime.ts`, the new `quickEntryVocabulary.ts`, `assistantActions.ts`, `quickEntryPreview.ts`), `noteYjs.ts` (`noteDocFromText`), `assistantActionService`, the connector's `add_note`, `lib/assistant/` (`quickEntry.sync.ts`, `quickEntryDraft.ts`, `openAfterSave`), `components/quick-entry/` (`useQuickEntry`, `quickEntryCards.ts`, the card), the entry page's new-event draft |
| `planner-2` | to write (B-248: remove reminders, notes become past-only, todos take their place; no data migration; B-245 attach a todo to a note is the later follow-up) | `quick-entry` in `dev` (the same date rules; last item B-220) | the note time rules on the device and server (`timelineEntryService`), the Planner (+ menu, rows, `upcomingFilters`), the Today card and `SimpleNext`, `calendarItems` and `calendarText` (the reminder kind: feed, Google push and pull, `reminderPlan`, Remind me), quick entry (`quickEntryTime`, the note action), the connector's `upcoming` and `add_note`, seeds |
| `planner-3` | to write (B-245: a note can carry a todo with its own due day and assignee, the replacement for reminders) | `planner-2` in `dev` (last item B-248) | the note editor and entry page, `todoService` and the todo schema (a link to its note), the Planner's todo rows, the Today card, the connector's `add_note` and `add_todo` |
| `simple-mode` | to write (B-221: locked simple mode, a new member type or a nit pass) | (none) | `@caretook/data/permissions`, `careGroupMemberService`, group settings Members, `SimpleTimeline`, the `/app` layout |
| `tasks-2` | [PRD](tasks-2-prd.md), [plan](tasks-2-plan.md): **done** (`2db975a7`) | — | none now |

## Summary

<!-- Generated by `pnpm backlog` on every write: don't edit this table by hand. -->

| Id | Type | Status | PRD | Owner | Title |
| -- | ---- | ------ | --- | ----- | ----- |
| B-25 | feature | staging | providers-2 | prd/providers-2 | @-mentions of providers inside live notes and events |
| B-31 | feature | triaged | onboarding |  | Demo group for every new user: a seeded, fictional care group to explore the app |
| B-33 | plan | triaged | hosting |  | Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment |
| B-40 | chore | triaged | marketing |  | Real app screenshots for the marketing site before launch |
| B-48 | feature | staging | providers-2 | prd/providers-2 | Allow import of providers from other care groups that you have access to. |
| B-52 | feature | triaged | data-rights |  | Ability to download all data from the app to a file for backup or transfer to another device. |
| B-53 | feature | triaged | data-rights |  | Ability to delete ALL data from the app. |
| B-54 | feature | triaged | marketing |  | privacy policy and terms of service. |
| B-56 | feature | triaged | documents |  | ability to upload photos of patient drivers license, insurance card, DNR, etc. |
| B-60 | feature | staging | appointments-2 | prd/appointments-2 | Recurring appointments (weekly PT, dialysis three times a week) |
| B-61 | feature | staging | appointments-2 | prd/appointments-2 | Appointment reminders by email and push before the appointment |
| B-62 | feature | staging | appointments-2 | prd/appointments-2 | iCal feed of a care group's upcoming appointments |
| B-63 | feature | staging | appointments-2 | prd/appointments-2 | Google Calendar sync of a care group's appointments |
| B-84 | feature | triaged | data-rights |  | Deleting an entry, provider or medication scrubs its content everywhere |
| B-85 | feature | triaged | account-security |  | Two-factor sign-in, required for owners, admins and staff; breached-password check |
| B-145 | question | triaged | encryption |  | Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for… |
| B-174 | bug | staging | quick-fixes | prd/quick-fixes | Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page |
| B-175 | chore | staging | quick-fixes | prd/quick-fixes | Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6 |
| B-180 | bug | staging | quick-fixes | prd/quick-fixes | Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races |
| B-181 | feature | staging | conditions | prd/conditions | A conditions list on the care recipient's profile (diagnoses), so helpers and a connected assistant's recipient_profile can see them |
| B-182 | bug | staging | quick-fixes | prd/quick-fixes | providers.browser.test.tsx 'a practice's name finds its clinicians too; the Clinicians chip keeps the search…' flakes under load: after tapping Clinicians, the 'Current providers' list still has Dr. Samuel Patel when its expect.poll times out |
| B-183 | chore | triaged | hosting |  | Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons) |
| B-191 | bug | staging | quick-fixes | prd/quick-fixes | clicking the next entry in the upcoming section of the simple timeline should expand the section,… |
| B-192 | bug | staging | quick-fixes | prd/quick-fixes | undo when checking off a todo should list all the todos that were checked off, not just the last… |
| B-193 | feature | staging | connectors-2 | prd/connectors-2 | In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states |
| B-194 | feature | staging | connectors-2 | prd/connectors-2 | A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off |
| B-195 | feature | staging | connectors-2 | prd/connectors-2 | Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state |
| B-196 | feature | triaged | connectors-2 |  | List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting |
| B-197 | feature | staging | connectors-2 | prd/connectors-2 | Connector write tool add_condition (and resolve): a connected assistant adds or resolves a care recipient's condition through recipientConditionService |
| B-198 | bug | staging | quick-fixes | prd/quick-fixes | rotating placeholder in the timeline entry box is distracting and confusing. Use a static… |
| B-199 | bug | staging | medications-3 | prd/medications-3 | ability to add a medication quickly from the log a dose screen. |
| B-200 | bug | staging | medications-3 | prd/medications-3 | medications need a type field: rx, otc, supplement, etc. |
| B-201 | bug | staging | quick-fixes | prd/quick-fixes | simple timeline date header should show the care period as well |
| B-203 | feature | landed | github-review | prd/github-review | Now that we are we have github fixed, we should start using it for some of the merge management so… |
| B-204 | feature | staging | connectors-2 | prd/connectors-2 | connector should be able to edit notes and events so it can help you draft questions or add… |
| B-205 | bug | staging | quick-fixes | prd/quick-fixes | mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails at some times of day: give_pass on w.evening returns isError (line 160) |
| B-206 | bug | staging | quick-fixes | prd/quick-fixes | mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails in the evening: its Metformin dose a minute earlier fills the Evening pass, so give_pass says 'Nothing is left to give in Evening today' |
| B-207 | bug | staging | quick-fixes | hotfix/stack-healthcheck | pnpm prd stack up fails at migrate with 'Connection terminated unexpectedly': the compose Postgres healthcheck (pg_isready -U caretook -d caretook) passes against the socket-only init server; use -h 127.0.0.1 (powersync-storage has the same pattern) |
| B-208 | change | staging | simple-mode |  | you should be able to edit all entries, search, and filter in simple mode. |
| B-209 | feature | triaged | i18n |  | react-i18next or some other internationalization library to support multiple languages for all text… |
| B-210 | bug | staging | quick-fixes |  | Browser specs left stale by dev's timeline hotfixes: app-shell ([data-simple-toggle] gone), layout-offline ([aria-label="Cards"] gone) since 76375c07 (one View options menu); invites (first main a[href*=/entries/] is the collapsed Today card's Next link) since 1ff53864 |
| B-211 | change | staging | quick-fixes | prd/quick-fixes | link to group details edit page from the edit profile screen for editing the care recipient's… |
| B-212 | bug | staging | medications-3 | prd/medications-3 | icon order at top of medications page is not great. Add medication button should be a + icon. Print… |
| B-213 | bug | landed | medications-tabs |  | medications today schedule layout is confusing especially on mobile. Plan an improved layout for… |
| B-214 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | don't need patient name on the providers, medications, upcoming, or tasks page page, just need it… |
| B-215 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | move due now and usual around now into a dialog with an icon to toggle it on timeline quick entry… |
| B-216 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | suggestion dropdown for quick entry box should appear above elements instead of pushing elements… |
| B-217 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | If today is empty on the timeline, we need some kind of placeholder/prompt to add an entry. Page… |
| B-218 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | expand icon for day summary on timeline should be at the left of the day summary, not the right. |
| B-219 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | can the tooltip in the quick entry box appear inside the box instead of outside? That icon is also… |
| B-220 | change | ready | quick-entry | prd/quick-entry | Improve quick entry box to be more powerful and flexible. Things like "fell" creates an event,… |
| B-221 | feature | triaged | simple-mode |  | locked simple mode is really confusing. We may want to just add a new user type at this point for… |
| B-222 | feature | staging | tasks-2 | prd/tasks-2 | Tasks and todos are confusing. We should rename tasks "todos" or something similar and move them to… |
| B-223 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | in header care group drop down, we don't need to show the current care period line. New care group… |
| B-224 | bug | staging | timeline-ux-2 | prd/timeline-ux-2 | in the add timeline entry dropdown, vitals should be a menu entry with an expandable submenu for… |
| B-225 | bug | staging | quick-fixes | prd/quick-fixes | Component tests fail between midnight and about 5 a.m.: they put entries a few hours before now, which lands on yesterday (entryPrint 'an event's: title, time…' gets 'Yesterday, 10:18 PM' for /^Event · Today/; timelineCarePeriods 'a period at a place…' gets 'day 2'; timelineSimple 'a day header names the care period…' times out) |
| B-226 | change | landed | medications-tabs | prd/medications-tabs | Medications page should be tabbed into Schedule and Medications |
| B-227 | bug | dropped | quick-fixes |  | Component tests fail just after midnight America/Los_Angeles: 'today' fixtures made minutes or hours before now fall on yesterday (timelineSummaries, entryPrint 'an event's', timelineCarePeriods 'places', timelineSimple 'a day header names the care period') |
| B-228 | bug | in-progress | quick-fixes | prd/quick-fixes | Component tests still read attributes and values synchronously right after render: about 40 expect(X()!.getAttribute\|value\|dataset\|checked\|placeholder\|innerText…) sites (staff, entry, provider, timelineSheetUrls…), outside B-180's sweep |
| B-229 | bug | triaged | quick-fixes |  | on timeline page, header and Today section should be in same column width as the rest of the… |
| B-230 | bug | ready | quick-fixes | prd/quick-fixes | reminders.int.test.ts 'reminds a task's assignee, and skips a suppressed address' times out at 5000 ms under load in a full check (then 'turns reminders off from the email's unsubscribe link' gets Invalid URL); passes alone |
| B-231 | bug | triaged | quick-fixes |  | "Nothing logged today yet." message should be in a border box like a timeline entry box to match… |
| B-232 | bug | in-progress | quick-fixes | prd/quick-fixes | Google Calendar keeps pushing to a disabled account: calendarSyncService connectionsFor never checks user.disabledAt (the feed and pull paths do), so disabling a member doesn't stop new appointments and todos reaching their calendar |
| B-233 | bug | in-progress | quick-fixes | prd/quick-fixes | A repeating all-day visit today can't move to a new series: the server's pastVisit check uses occurredAt < now, but the UI and planSeriesEdit use isPastVisit (all-day visits count until the day ends), so the upload rejects today's visit and leaves it on the old series |
| B-234 | bug | in-progress | quick-fixes | prd/quick-fixes | Editing a 'last Friday' monthly series turns it into '4th Friday' when opened from a month with four Fridays: choiceOfRule keeps monthly.by but drops nth, and choiceRule rebuilds it from the visit's date (BYDAY=-1FR from 2027-02-26 becomes 4FR) |
| B-235 | bug | in-progress | quick-fixes | prd/quick-fixes | After Back restores the timeline, picking the current filter again in the same minute blanks the medication names (doses show 'Medication'): restored goes undefined, useTimelineMedications' initial becomes NO_ROWS, and useLiveQuery resets its rows without restarting the watch |
| B-236 | bug | triaged | simple-mode |  | In locked simple mode, SimpleNext's 'See all' (Upcoming) and task links look clickable but bounce back to the timeline: lockAllows only permits the timeline and entry routes |
| B-237 | bug | ready | quick-fixes | prd/quick-fixes | An @-mention that adds or imports a provider can overwrite note text: when the write finishes, useMentionPopup inserts into whatever popup is open now (a different @ query), else into the captured range, which isn't mapped through later edits |
| B-238 | bug | ready | quick-fixes | prd/quick-fixes | Log a dose's '+ New medication': switching to an existing medication and back clears the quick-add fields but keeps newDose, so choose() refills Amount with the old dose (a medication saved with no usual dose, logged as the discarded '2 tablets') |
| B-239 | bug | triaged | github-review |  | pnpm prd review: --json mode prints progress lines (asked Codex…, waiting) on stdout, so its output isn't valid JSON |
| B-240 | bug | triaged | github-review |  | pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75 |
| B-241 | bug | triaged | github-review |  | codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean |
| B-242 | bug | triaged | github-review |  | with_backlog_lock: on Linux, BSD 'stat -f %m' succeeds with non-numeric output before GNU stat is tried, breaking the lock-age arithmetic |
| B-243 | bug | landed | hosting |  | don't deploy developer previews to vercel, we don't have a dev db running and it is a waste of… |
| B-244 | chore | triaged | github-review |  | codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false |
| B-245 | plan | triaged | planner-3 |  | Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date |
| B-246 | change | triaged | quick-fixes |  | Planner: remove due doses and passes from the Planner tab (they stay on the Today card and the Medications Schedule tab) |
| B-247 | change | triaged | quick-fixes |  | Planner: Past becomes an 'Upcoming \| Past' toggle inside the Planner tab instead of its own tab |
| B-248 | change | triaged | planner-2 |  | Remove reminders: notes can no longer be dated in the future; use todos instead |
| B-249 | change | in-progress | list-filters | prd/list-filters | Collapse list filters under a shared Filter dropdown (round sliders button, count badge, removable chips): medications list, providers directory, todos, Planner |
| B-250 | bug | triaged | quick-fixes |  | lint tests seem to be failing regularly because types haven't been generated. Maybe regression… |
| B-251 | bug | triaged | quick-fixes |  | convert planner tabs to TabNav component. |
| B-252 | feature | triaged | connectors-3 |  | Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming |

## Items

### B-25 · feature · @-mentions of providers inside live notes and events

- status: staging
- prd: providers-2
- owner: prd/providers-2
- commit: 680de235

- 2026-11-18 (Robert Bo Davis): Later, after providers' linking lands. Typing @ in a note's or event's text suggests providers; a mention links the provider like the With row. Needs @tiptap/extension-mention and @tiptap/suggestion (new dependencies: the user's approval). Out of scope for the providers PRD.
- 2026-11-18 (prd/providers): Triaged to providers by its orchestrator: @-mentions need the provider table and links (slices 1 and 5). A follow-up after slice 5, not in the current plan.
- 2026-11-20 (Robert Bo Davis): Moved from providers (done) to a new providers-2 PRD, to write (the user, 2026-11-20): B-48's cross-group permission rules want an interview, and B-25 touches the live-notes editor. Same commit: the PRD table's done rows shortened, rows added for providers-2 and appointments-2. -- backlog agent
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): B-25 is slices 1-2 (mentions; deps approved), B-48 slices 3-5 (import as a copy: writer here, any member there; three entry points; notes not copied). -- backlog agent

### B-31 · feature · Demo group for every new user: a seeded, fictional care group to explore the app

- status: triaged
- prd: onboarding
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): From the invites interview (2026-11-18): out of scope there, noted for later. Each new account gets a private demo group with fictional seed data (timeline, notes, vitals; later meds and providers) it can explore and delete.
- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'onboarding' (to write): a private fictional demo group for each new account, made from the seeds' data on sign-up (or on demand from /app home), deletable. Builds on invites (done).

### B-33 · plan · Production hosting and launch: hosted Postgres, production migrations, PowerSync Cloud, Vercel deploy, staging environment

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Not planned yet; the user will say when. Covers the open questions in AGENTS.md: hosted database (same region as Vercel functions, pooling), how production migrations run, PowerSync Cloud (replication role with column-limited grants, sslmode verify-full, how it reaches the JWKS), rate-limit storage, env and secrets, a real staging environment, and confirming the first Vercel deploy runs pnpm 12. Invites (B-30) and marketing (B-32) need it to go live.
- 2026-11-18 (prd/invites orchestrator): Email sending setup for launch (tracking off, SPF/DKIM/DMARC, bounce webhooks, the outbox cron, rate-limit storage) is filed as B-68.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-4 and S-6 (launch): separate database roles (app, migrations, column-limited replication), named and audited human access, a break-glass procedure; and a register of every data copy (Postgres, backups, PowerSync storage, Resend, logs) with region, encryption at rest, retention, access and breach terms.
- 2026-11-19 (Robert Bo Davis): Triaged to a new hosting PRD: the user picked deployment (Vercel and the other providers) as the next PRD to write, 2026-11-19.
- 2026-11-19 (Robert Bo Davis): PRD and plan written (plans/hosting-prd.md, hosting-plan.md): staging and production, Vercel Pro cle1, Neon aws-us-east-2, PowerSync Cloud US, a GitHub Action deploy, generated least-privilege roles, ops/ runbook, data-copy register and break-glass. Done after slice 7 (going live).
- 2026-11-20 (slice/hosting/2): hosting slice 2: PowerSync 1.28.3 snapshots tables with SELECT * (modules/module-postgres/src/replication/SnapshotQuery.ts), so column-only grants fail its initial snapshot on the 8 partly synced tables (user, care_group, care_group_member, care_recipient, care_recipient_details, member_contact_share, note_update). Needs a decision before slice 7.
- 2026-11-20 (slice/hosting/2): Correction: that's 7 partly synced tables, not 8.
- 2026-11-20 (prd/hosting): Decided with the user: six partly-synced tables get their timestamp/audit columns in the streams; the replication role gets table-level SELECT on user only (PowerSync's snapshot runs SELECT *). Ask PowerSync Cloud at slice 7.
- 2026-11-20 (slice/hosting/5): slice 5 (d9aa875): deploy.yml + admin-grant/seed-staging/db-access Actions, pnpm deploy:smoke, CLIs pinned in .github/cli-versions.env (vercel@65.16.0, powersync@0.10.3), Vercel Git deploys off. Confirm at slice 7: PowerSync Cloud /probes/liveness, Vercel rootDirectory with vercel build from the repo root.
- 2026-11-20 (slice/hosting/6): Slice 6 (24a3f02): ops/runbook.md, ops/data-copies.md, ops/break-glass.md written from the code. Gaps found: BETTER_AUTH_SECRET rotation breaks the jwks private key (no tool to clear it); personal db roles read every table incl. auth tables; SEED_USER_PASSWORD rotation doesn't reset seeded accounts.
- 2026-11-20 (prd/hosting): Hosting waves 1-4 landed in dev (a187dc2, 8b7f683); prd/hosting removed. Slice 7 (going live per ops/runbook.md, staging first) is being run by the user through a hotfix session, which should claim B-33 and mark it done when production is live. To confirm on staging: PowerSync refetches the JWKS after pnpm auth:rotate-jwks; PowerSync Cloud's snapshot uses SELECT *; Vercel runs pnpm 12.
- 2026-11-20 (Robert Bo Davis): Released the stale claim (prd/hosting is gone). Waves 1-4 are in dev; only slice 7 (going live per ops/runbook.md, staging first) remains. The user's going-live session claims B-33 and marks it done when production is live.
- 2026-11-20 (hotfix/go-live): 2026-11-20: staging live (hotfix/go-live): deploy, seed, staff, invite mail and two-device sync checked; JWKS rotation check skipped. Production not started (needs paid Neon and PowerSync plans, B-183 first).

### B-40 · chore · Real app screenshots for the marketing site before launch

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-18 (prd/marketing): The marketing site shows SVG placeholders (apps/web/public/screenshots/<name>.svg) to keep the repo small while the app's screens change. Before launch: run scripts/browser-checks/marketing-screenshots.mjs on a freshly reset stack (CARETOOK_BROWSER_SLOTS=4 pnpm prd browser marketing-screenshots --timeout 300), commit the WebP images, and point site/screenshots.ts and the Screenshot component back at them (light and dark sources, srcset).
- 2026-11-18 (Robert Bo Davis): Timing (the user, 2026-11-18): one of the last tasks before launch. Do it after the launch-ready product map and once the screens it shows have stopped changing, alongside the launch work in B-33, so the images match what ships. Not part of any current marketing wave.

### B-48 · feature · Allow import of providers from other care groups that you have access to.

- status: staging
- prd: providers-2
- owner: prd/providers-2
- commit: fc0d2e20

- 2026-11-18 (Robert Bo Davis): Proposed as a providers follow-up (the PRD is done, like B-25): copy a provider from another group you belong to into this one (a copy, not a shared row, since providers are per group and synced per group). Needs a small PRD addendum or a quick-fixes slice once scoped.
- 2026-11-20 (Robert Bo Davis): Moved from providers (done) to a new providers-2 PRD, to write (the user, 2026-11-20): B-48's cross-group permission rules want an interview, and B-25 touches the live-notes editor. Same commit: the PRD table's done rows shortened, rows added for providers-2 and appointments-2. -- backlog agent
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): B-25 is slices 1-2 (mentions; deps approved), B-48 slices 3-5 (import as a copy: writer here, any member there; three entry points; notes not copied). -- backlog agent
- 2026-11-21 (prd/providers-2): slice 3 (import sheet) merged into prd/providers-2 as 0de633e1; slices 4, 5 remain

### B-52 · feature · Ability to download all data from the app to a file for backup or transfer to another device.

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'data-rights' (to write): export everything you can see (per group and per account) to a file. Compliance (AGENTS.md) already requires user data deletion; export belongs with it.

### B-53 · feature · Ability to delete ALL data from the app.

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for 'data-rights' with B-52. Needs scoping in the PRD: 'delete ALL data' could mean this device's copy, one group (owners), or the whole account. Ties to the open question about a last owner deleting their account.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-1 is filed as B-84 for data-rights: soft delete scrubs content; plan it with delete-all.

### B-54 · feature · privacy policy and terms of service.

- status: triaged
- prd: marketing
- owner:
- commit:

- 2026-11-18 (prd/marketing): Proposed for marketing (orchestrator): draft /privacy, /terms and /health-data-privacy landed with marketing slice 3 (DRAFT banners, [Review: …] notes). What's left is the user's legal review and removing the banners; no slice planned until the user reviews the text.
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md), S-4: the draft pages promise staff see care data only with permission, recorded, and encryption at rest; neither is built yet. Promise only what's built, or build S-4 first (open, 2026-11-19).

### B-56 · feature · ability to upload photos of patient drivers license, insurance card, DNR, etc.

- status: triaged
- prd: documents
- owner:
- commit:

- 2026-11-18 (Robert Bo Davis): Proposed for a new PRD 'documents' (to write): photos and files (ID, insurance card, DNR) per recipient. Needs file storage, which waits on hosting (B-33), plus encryption and sync decisions (files likely online-first, not in PowerSync). Pairs with profiles (B-45).
- 2026-11-19 (plan/encryption): Security review (plans/security-review.md): E2E decision (2026-11-19) is option C for files: plan end-to-end encrypted uploads (a group key wrapped per member device, recovery codes) as part of the documents PRD.
- 2026-11-19 (Robert Bo Davis): planning opened on plan/documents (.loops/plan-documents). Building it waits on hosting (file storage) and includes option C from the security review (E2E for files only)

### B-60 · feature · Recurring appointments (weekly PT, dialysis three times a week)

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: f1cc1dbc

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-61 · feature · Appointment reminders by email and push before the appointment

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: edfcedf0

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-62 · feature · iCal feed of a care group's upcoming appointments

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: 6e343bd8

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2

### B-63 · feature · Google Calendar sync of a care group's appointments

- status: staging
- prd: appointments-2
- owner: prd/appointments-2
- commit: f1cc1dbc

- 2026-11-18 (plan/appointments): Follow-up to the appointments PRD (B-47), decided in its interview 2026-11-18: not in the first PRD.
- 2026-11-20 (Robert Bo Davis): Moved from appointments (done) to a new appointments-2 PRD, to plan now (the user, 2026-11-20). Touches timeline-ux's Today card, so start it after timeline-ux wave 2; B-61's push needs a decision in the interview. -- backlog agent
- 2026-11-20 (plan/appointments-2): Planned 2026-11-20: plans/appointments-2-prd.md and -plan.md, 10 slices in 4 waves. B-60 slices 1,2,3,10; B-62 slice 5; B-61 slices 6,8 (email only, push later); B-63 slices 7,9 (two-way Google sync, polling). New deps approved: rrule 2.8.1, ical-generator 11.1.4, @googleapis/calendar 20.2.0, google-auth-library 11.3.4. -- plan/appointments-2
- 2026-11-20 (slice/appointments-2/9): Slice 9 (pull + smoke) handed off: calendarPullService (googlePull cron step, 5-min pacing), interpretGoogleChange in google/pullPlan.ts, pnpm calendar:google-smoke (manual; not run against Google).

### B-84 · feature · Deleting an entry, provider or medication scrubs its content everywhere

- status: triaged
- prd: data-rights
- owner:
- commit:

- 2026-11-19 (plan/encryption): From the security review (plans/security-review.md on plan/encryption), S-1 (launch): soft-deleted rows keep title, body, details and the document, and sync to every member's device. Scrub to a tombstone and purge later. The undo window and retention are open for the data-rights interview (user, 2026-11-19).

### B-85 · feature · Two-factor sign-in, required for owners, admins and staff; breached-password check

- status: triaged
- prd: account-security
- owner:
- commit:

- 2026-11-19 (plan/encryption): From the security review (plans/security-review.md on plan/encryption), S-9 (later): Better Auth's twoFactor and haveIBeenPwned plugins (built in). Required for owners, admins and global staff, optional for others (decided 2026-11-19). The PRD settles group creation, promotion, a grace period for existing owners, and recovery.

### B-145 · question · Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for…

- status: triaged
- prd: encryption
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): From the inbox: Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. / Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- 2026-11-20 (backlog agent): Triage: a decision for the encryption review (plans/security-review.md, option A for launch), not a build item yet. It only becomes work with Capacitor (SQLCipher, secure storage); on the web the browser profile is the boundary. Needs the user's answer; no PRD to start.

### B-174 · bug · Back from an entry page drops the timeline's loaded pages: paging is useState in useTimelineData, so the list remounts with one page

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 592a29ab

- 2026-11-20 (prd/timeline-ux): Found by timeline-ux slice 6 in the component-test router; check with the real ScrollRestoration before fixing.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-175 · chore · Remove the timeline's now-unused care-period place query (placeNamesQuery, the loader's placeRows, periods.placeName) after timeline-ux slice 6

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 970ff782

- 2026-11-20 (prd/timeline-ux): Slice 6 dropped places from the timeline; left in place to stay clear of slice 5.
- 2026-11-20 (Robert Bo Davis): Triaged to timeline-ux: found by its slice 6 and touches its hot files (timeline route, useTimelineData); its orchestrator can add a slice or a follow-up after slice 5 lands.
- 2026-11-20 (plan/quick-fixes): Retriaged 2026-11-20 (backlog session, the user's pick): timeline-ux is done, so quick-fixes wave 14.

### B-180 · bug · Component tests still read synchronously right after render in expect(X()!.textContent…), expect(X()!.querySelector…) and .focus()/.blur() (entry, today, entryWithRow, visitPrep, providerSheets): the next likeliest load races

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-20 (prd/check-migration): Left by slice 24 (B-176's sweep covered the click/fill/hover/type/clear sites). Convert to await expect.poll(...) or found(), keeping what each assertion reads. Proposed for check-migration. -- check-migration orchestrator
- 2026-11-20 (prd/check-migration): Also: two timelineLayout tests now inline the same 'wait until the element stops moving' loop (the author tooltip and the viewer's ⋯, both after the quick-entry chips shift the rows). A shared helper beside found() would fit. -- check-migration orchestrator
- 2026-11-20 (Robert Bo Davis): Moved from check-migration (done, c7fd1390) to quick-fixes (the user, 2026-11-20): the next quick-fixes wave appends them as slices (B-180 is a sweep across component tests; B-182 one test). -- backlog agent
- 2026-11-20 (Robert Bo Davis): Hotfix: the user started hotfix/test-fixes for the reported test issues (B-180, B-182, B-210), 2026-11-20.
- 2026-11-20 (Robert Bo Davis): Not in hotfix/test-fixes after all (user narrowed it to B-210); still for the next quick-fixes wave.

### B-181 · feature · A conditions list on the care recipient's profile (diagnoses), so helpers and a connected assistant's recipient_profile can see them

- status: staging
- prd: conditions
- owner: prd/conditions
- commit: bd045d7d

- 2026-11-20 (prd/connectors): From connectors slice 4 (B-104): story 22 promises the assistant reads the recipient's conditions, but no conditions field exists; recipient_profile returns allergies, code status, blood type and the note for helpers. The user chose (2026-11-20) to drop 'conditions' from the privacy text for now and file this. When built, add it to recipient_profile and the privacy page.
- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20: the user asked for a conditions PRD and plan, planned in this session
- 2026-11-20 (Robert Bo Davis): PRD and plan written 2026-11-20 (plans/conditions-prd.md, conditions-plan.md); the assistant's write tool is B-197

### B-182 · bug · providers.browser.test.tsx 'a practice's name finds its clinicians too; the Clinicians chip keeps the search…' flakes under load: after tapping Clinicians, the 'Current providers' list still has Dr. Samuel Patel when its expect.poll times out

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-20 (prd/connectors): Seen in connectors slices 1, 2 and 5 and in the connectors landing check (2026-11-20, load ~14, 410 s run); passes alone. The connectors PRD changes nothing under providers/. Line 73: expect.poll(listNames('Current providers')).toEqual(['Dr. Elena Alvarez']).
- 2026-11-20 (Robert Bo Davis): Moved from check-migration (done, c7fd1390) to quick-fixes (the user, 2026-11-20): the next quick-fixes wave appends them as slices (B-180 is a sweep across component tests; B-182 one test). -- backlog agent
- 2026-11-20 (Robert Bo Davis): Hotfix: the user started hotfix/test-fixes for the reported test issues (B-180, B-182, B-210), 2026-11-20.
- 2026-11-20 (Robert Bo Davis): Not in hotfix/test-fixes after all (user narrowed it to B-210); still for the next quick-fixes wave.

### B-183 · chore · Mask manual Actions' inputs in public run logs before production (staff emails, Database access and Rotate JWT keys reasons)

- status: triaged
- prd: hosting
- owner:
- commit:

- 2026-11-20 (hotfix/go-live): Repo is public (B-33), so run logs are public for 7 days. Use ::add-mask:: on email/reason inputs in admin-grant.yml, db-access.yml, rotate-jwks.yml; secrets are already masked.
- 2026-11-20 (Robert Bo Davis): Triage: hosting, part of going live (B-33): add ::add-mask:: in admin-grant.yml, db-access.yml, rotate-jwks.yml before production

### B-191 · bug · clicking the next entry in the upcoming section of the simple timeline should expand the section,…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 5a7d7238

- 2026-11-20 (prd/quick-fixes): From the inbox: clicking the next entry in the upcoming section of the simple timeline should expand the section, not take you to the next entry. once expanded, clicking on any item should take you to the full view of that item.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small simple-mode timeline fix (the Upcoming block's next entry expands the block; once open, each item opens its page). A slice in a later wave; the user reviews.

### B-192 · bug · undo when checking off a todo should list all the todos that were checked off, not just the last…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: f9109cad

- 2026-11-20 (prd/quick-fixes): From the inbox: undo when checking off a todo should list all the todos that were checked off, not just the last one that was checked off.
- 2026-11-20 (prd/quick-fixes): Proposed for quick-fixes (orchestrator, 2026-11-20): a small tasks fix (the undo after checking off names every task checked off since, not just the last). A slice in a later wave; the user reviews.

### B-193 · feature · In-app guide to connect an assistant: copyable /mcp URL and steps for Claude (web, desktop, mobile) and ChatGPT with links, on Group settings → Assistants and Settings → Devices; the switch-off states

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: c691be06

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): today nothing in the app tells a member the URL or where to add it; connectors-2 PRD, to write
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-194 · feature · A member can ask the group's owners to turn assistants on (email or in-app notice) instead of a dead end when the switch is off

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: ea3cbc02

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): connectors-2 PRD, to write; touches notifications
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent
- 2026-11-21 (slice/connectors-2/2): Slice 2 built (90383609, eab9dfe4): assistant_request + migration 0030, assistantsRequested email, connector.requestEnable/myRequest, ask button on Assistants and /connect's empty state.

### B-195 · feature · Starter prompts for connected assistants: MCP server instructions and a few MCP prompts, plus a 'connected to <group>, try asking…' success state

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: 0b8c30f7

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): MCP prompts were out of scope in connectors; connectors-2 PRD, to write
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-196 · feature · List Caretook in Anthropic's connector directory and ChatGPT's apps directory, for one-click connecting

- status: triaged
- prd: connectors-2
- owner:
- commit:

- 2026-11-20 (Robert Bo Davis): Backlog session 2026-11-20 (the user chose): after the production launch (B-33) and the privacy policy and terms (B-54); vendor review
- 2026-11-20 (Robert Bo Davis): Left out of the connectors-2 PRD (the user, 2026-11-20): after the launch (B-33) and the privacy policy (B-54); the PRD's Out of Scope lists what a listing needs. -- backlog agent

### B-197 · feature · Connector write tool add_condition (and resolve): a connected assistant adds or resolves a care recipient's condition through recipientConditionService

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: ea3cbc02

- 2026-11-20 (plan/conditions): Conditions planning 2026-11-20 (the user): conditions ship read-only to assistants; the writer is a follow-up, after the conditions PRD lands
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-198 · bug · rotating placeholder in the timeline entry box is distracting and confusing. Use a static…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 28d637a9

- 2026-11-20 (prd/conditions): From the inbox: rotating placeholder in the timeline entry box is distracting and confusing. Use a static placeholder that is a prompt to type something. and move to a ? with tooltip to explain the format/power.
- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Undoes timeline-ux's rotating placeholder (B-170ish) for a static prompt plus a ? tooltip on the format; quick entry only.
- 2026-11-20 (Robert Bo Davis): Correction to the note above: the rotating placeholder came from a timeline-ux slice (quick entry); ignore the 'B-170ish' guess.

### B-199 · bug · ability to add a medication quickly from the log a dose screen.

- status: staging
- prd: medications-3
- owner: prd/medications-3
- commit: b44af440

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. A small 'new medication' path from the log-a-dose sheet; reuses the medications form. If it needs B-200's type field, run after it.
- 2026-11-20 (plan/quick-fixes): 2026-11-20 (backlog session, the user): moved to medications-3, out of quick-fixes wave 14. The user's flow: an inline add in the log-a-dose sheet with name, dose and type (B-200's field), a link to add details on the medication's page, and the new medication picked for the dose; also offered in the no-medications empty state. Plan it with B-200.
- 2026-11-20 (plan/medications-3): PRD and plan written (plan/medications-3): 4 slices, 1 then (2, 3, 4). Types prescription/otc/supplement/other, required on new (default Rx), existing unset; Rx fields collapse for other types; list badge and ?type=, print grouped by type, search and list_medications; no change entry. B-199 is slice 4: '+ New medication' in the Dose sheet (name, dose, type; as needed), one local transaction, an 'Add details' toast, also the empty state.

### B-200 · bug · medications need a type field: rx, otc, supplement, etc.

- status: staging
- prd: medications-3
- owner: prd/medications-3
- commit: 26213ec5

- 2026-11-20 (Robert Bo Davis): Triage: medications-3 (to write). A new synced column (migration, sync rules, form, list filter, connector list_medications) with open choices (the type list, required or not, prescriber link); conditions is running and touches medications, so plan it to start after conditions lands.
- 2026-11-20 (plan/medications-3): PRD and plan written (plan/medications-3): 4 slices, 1 then (2, 3, 4). Types prescription/otc/supplement/other, required on new (default Rx), existing unset; Rx fields collapse for other types; list badge and ?type=, print grouped by type, search and list_medications; no change entry. B-199 is slice 4: '+ New medication' in the Dose sheet (name, dose, type; as needed), one local transaction, an 'Add details' toast, also the empty state.

### B-201 · bug · simple timeline date header should show the care period as well

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: b1f0a6d0

- 2026-11-20 (Robert Bo Davis): Triage: quick-fixes, wave 14. Simple mode's day header gains the care period label that the full day header already has.

### B-203 · feature · Now that we are we have github fixed, we should start using it for some of the merge management so…

- status: landed
- prd: github-review
- owner: prd/github-review
- commit: 6ece6441

- 2026-11-20 (Robert Bo Davis): From the inbox: Now that we are we have github fixed, we should start using it for some of the merge management so codex can review PRs. I do NOT want PRDs or plans to be in github, only the code. Instead of merging to dev locally, we need to start pushing working branches to github and creating a PR into dev, then waiting for codex to review, then addressing any comments, then merging to dev.
- 2026-11-20 (Robert Bo Davis): Triage: github-review (to write): pnpm prd land pushes the branch and opens a PR into dev, waits for Codex's review, addresses comments, then merges. Open: plans/ and the PRDs are already on origin/dev and origin/main (public repo), so 'code only on GitHub' means moving plans out of the repo or into an untracked/separate store; the live backlog commits onto dev, which then can't be PR-only.
- 2026-11-20 (Robert Bo Davis): User 2026-11-20: keep plans/ tracked as now; only code branches go through PRs and Codex review; backlog commits stay direct onto dev. Planning session: github-review.
- 2026-11-20 (plan/github-review): Planned in plans/github-review-plan.md (3 slices, waves 1 -> (2, 3)): Codex verdict and pnpm prd review; pnpm prd pr, land's PR path (prd/ always, hotfix --pr/--local asked each time, --no-review on the user's word), dev-sync; ready, prompts, rm. Plans, backlog and small changes stay local; the tooling pushes dev. Wave 1 lands locally, wave 2 through the new path.

### B-204 · feature · connector should be able to edit notes and events so it can help you draft questions or add…

- status: staging
- prd: connectors-2
- owner: prd/connectors-2
- commit: c8c655b8

- 2026-11-20 (prd/appointments-2): From the inbox: connector should be able to edit notes and events so it can help you draft questions or add information to the entries.
- 2026-11-20 (Robert Bo Davis): Triage 2026-11-20: connectors-2 (a write tool beside add_note/add_event, like B-197). Notes and events are live Yjs docs, so an edit tool must append a server-side Yjs update (note_update) rather than overwrite, so open editors merge it; likely append-or-section-edit, not full replace. Same via tag and confirm-each-write as the other writes.
- 2026-11-20 (Robert Bo Davis): PRD and plan written in the backlog session (2026-11-20): slices 1 (B-193), 2 (B-194, a migration), 3 (B-195), 4 (B-204: append and title or time, any live note or event), 5 (B-197: add, update, resolve; after conditions lands). -- backlog agent

### B-205 · bug · mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails at some times of day: give_pass on w.evening returns isError (line 160)

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 56b50a96

- 2026-11-20 (prd/conditions): Failed in conditions slice 4's full check (~21:20 EST 2026-11-20) and again alone on prd/conditions without slice 4 at 21:24 EST, load 31. Looks time-of-day dependent (the Evening pass vs now, or the Metformin dose logged a minute earlier covering it). Not caused by conditions.
- 2026-11-20 (prd/quick-fixes): Taken into quick-fixes as slice 58 (wave 14) at conditions' request; blocks evening full checks.
- 2026-11-20 (prd/conditions): Cause (conditions slice 2's agent): the test logs a Metformin dose 1 minute ago; between 20:00 and ~22:00 that dose answers the Evening (20:00) slot, so give_pass returns assistantActionService:nothingLeft ('Nothing is left to give in Evening today').

### B-206 · bug · mcpWrites.int.test.ts 'log vitals, a symptom, a dose and a pass's Given all' fails in the evening: its Metformin dose a minute earlier fills the Evening pass, so give_pass says 'Nothing is left to give in Evening today'

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 56b50a96

- 2026-11-20 (prd/appointments-2): Found by appointments-2 at 21:52 EST, 3/3 alone, on a branch with no connectors diff. Time-of-day dependent: pin the test's clock or log the dose against the morning pass. Fails pnpm check in the evening for every PRD.
- 2026-11-20 (prd/quick-fixes): Duplicate of B-205: quick-fixes slice 58 fixes both; done with it.

### B-207 · bug · pnpm prd stack up fails at migrate with 'Connection terminated unexpectedly': the compose Postgres healthcheck (pg_isready -U caretook -d caretook) passes against the socket-only init server; use -h 127.0.0.1 (powersync-storage has the same pattern)

- status: staging
- prd: quick-fixes
- owner: hotfix/stack-healthcheck
- commit: fc373a34

- 2026-11-20 (prd/quick-fixes): Found by quick-fixes slice 56 (failed 4x at low load; -h 127.0.0.1 locally fixed it). Proposed for a later quick-fixes wave.
- 2026-11-20 (hotfix/pg-healthcheck): Hotfix started and dropped (user's call); back to quick-fixes. Same socket-only race in docker-compose.shared-test.yml:41 (tmpfs, re-inits on every start) and scripts/loops/recover.sh wait_for_pg (docker exec pg_isready, no -h); docker-compose.test.yml inherits via extends. recover.test.mjs:458 matches only the prefix, so adding -h keeps it green.
- 2026-11-20 (prd/medications-3): medications-3 slice 1 (2026-11-20): `pnpm prd slice` failed at the stack's migrate in packages/data; `pnpm prd stack up` succeeded on retry.
- 2026-11-21 (hotfix/stack-healthcheck): Landed via hotfix/stack-healthcheck as fc373a34 (--force, no check, user's call): -h 127.0.0.1 on both docker-compose.yml healthchecks, docker-compose.shared-test.yml and recover.sh wait_for_pg.

### B-208 · change · you should be able to edit all entries, search, and filter in simple mode.

- status: staging
- prd: simple-mode
- owner:
- commit: 4e5e0187

- 2026-11-20 (Robert Bo Davis): Triage: a new small PRD (simple-mode), not a quick fix: simple mode drops the row ⋯ menus, search and filters on purpose, and the lock limits locked members to the timeline and entries/*, so it needs decisions (which edits, whether search/filter are a simple variant or the full ones, whether the lock still allows /search). Hot files: SimpleTimeline.tsx, TimelineEntryList, simpleModeLock.ts.
- 2026-11-20 (plan/simple-mode): Decision (user, 2026-11-20): simple mode reuses the full timeline's controls for now: the row ⋯ menus and edit sheets as on the full timeline, its magnifier/search, Filter button and chips (kind icons and authors as links). No simple variants yet. Done as hotfix/simple-mode, not a PRD.
- 2026-11-20 (hotfix/simple-mode): Landed as hotfix/simple-mode (4e5e0187): simple mode has the full ⋯ menus and sheets (locked too), FilterChips, kept filtered URLs; header search in simple mode unless locked (lock still blocks /search); row kind icons and initials stay plain (user's call).

### B-209 · feature · react-i18next or some other internationalization library to support multiple languages for all text…

- status: triaged
- prd: i18n
- owner:
- commit:

- 2026-11-20 (prd/conditions): From the inbox: react-i18next or some other internationalization library to support multiple languages for all text in the app.
- 2026-11-20 (Robert Bo Davis): Triage: a new big PRD (i18n). It touches every user-facing string (routes, ui/, emails, MCP text, dates and plural rules), so it should run alone or with tooling-only PRDs, ideally after the feature PRDs settle. Needs your approval for a new dependency (react-i18next/i18next, or a lighter alternative such as Lingui or FormatJS). Decide which languages and when it matters before launch.

### B-210 · bug · Browser specs left stale by dev's timeline hotfixes: app-shell ([data-simple-toggle] gone), layout-offline ([aria-label="Cards"] gone) since 76375c07 (one View options menu); invites (first main a[href*=/entries/] is the collapsed Today card's Next link) since 1ff53864

- status: staging
- prd: quick-fixes
- owner:
- commit: 570293a2

- 2026-11-20 (prd/conditions): Found in conditions' landing --suite on prd/conditions (9/12, 2026-11-20 23:15); invites failed alone too at load 6. Not caused by conditions. Logs in .git/worktrees/conditions/caretook-browser/.
- 2026-11-20 (Robert Bo Davis): Hotfix: the user started hotfix/test-fixes for the reported test issues (B-180, B-182, B-210), 2026-11-20.
- 2026-11-20 (prd/conditions): Also test/device.browser.test.tsx:57 'fixtures render on a real route': getByText('Lisinopril 10 mg').first() can pick the collapsed Today card's hidden link (failed once in conditions' quick check at load 5, passed alone 2x): a race to fix, not rerun.
- 2026-11-20 (hotfix/test-fixes): Fixed in hotfix/test-fixes (570293a2): app-shell waits for View options and keeps search in unlocked simple mode (B-208 made the toHaveCount(0) stale too); layout-offline picks the layout from View options; invites looks in main ol > li; device test finds Lisinopril's row by role. Named tests only: the device file 3x, the three specs on a stack, lint, format, typecheck; landed --force on the user's word.

### B-211 · change · link to group details edit page from the edit profile screen for editing the care recipient's…

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-20 (Robert Bo Davis): From the inbox: link to group details edit page from the edit profile screen for editing the care recipient's timezone.
- 2026-11-20 (Robert Bo Davis): Triage: one link on the profile edit screen to group settings' details: a quick-fixes slice.

### B-212 · bug · icon order at top of medications page is not great. Add medication button should be a + icon. Print…

- status: staging
- prd: medications-3
- owner: prd/medications-3
- commit: a4308e4a

- 2026-11-21 (prd/medications-3): From the inbox: icon order at top of medications page is not great. Add medication button should be a + icon. Print should just be the printer icon. Passes should be labeled between the two.
- 2026-11-21 (prd/medications-3): Proposed for medications-3 as slice 5 (wave 3, after slice 2: both touch the medications list header). Order the header: + icon (Add medication), the labeled Passes button, then a printer icon only (Print).
- 2026-11-21 (Robert Bo Davis): 2026-11-21: the user approved it as medications-3 slice 5 (wave 3, after slice 2).
- 2026-11-21 (prd/medications-3): medications-3 slice 5 started 2026-11-21. Overlap: timeline-ux-2 slice 1 later wraps this header in PageHeader; keep the order: + Add, labeled Passes, printer-only Print.

### B-213 · bug · medications today schedule layout is confusing especially on mobile. Plan an improved layout for…

- status: landed
- prd: medications-tabs
- owner:
- commit: 07a6b59a

- 2026-11-21 (prd/medications-3): From the inbox: medications today schedule layout is confusing especially on mobile. Plan an improved layout for passes, scheduled, and as needed.
- 2026-11-21 (prd/medications-3): Proposed for a follow-up PRD, medications-4: a redesign of Today's schedule (passes, scheduled, as needed) on mobile needs a PRD and plan, not a slice in medications-3.
- 2026-11-21 (backlog agent): Resolved by the Schedule | Medications tab split (B-226, 07a6b59a): the user, 2026-11-21, finds Today's schedule fine since. No redesign; medications-4 is not needed. The list's filters move under a Filter dropdown in list-filters instead.

### B-214 · bug · don't need patient name on the providers, medications, upcoming, or tasks page page, just need it…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: f58cd4b9

- 2026-11-21 (prd/medications-3): From the inbox: don't need patient name on the providers, medications, upcoming, or tasks page page, just need it in the print version where applicable. it shows in the header all the time. Can also remove entire profile section in top left of the timeline to reduce clutter. Move eyeball icon inline with search and filter icons and size them appropriately.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): timeline-ux-2, a declutter PRD to write: no recipient name in page headers (print only) and no profile corner on the timeline, the eye icon inline with search and filter, the day-summary expand icon on the left, the group dropdown reordered (no care-period line, New care group under the groups, Group settings last).
- 2026-11-21 (plan/timeline-ux-2): Planned (plans/timeline-ux-2-plan.md): slice 1 PageHeader and page headers without the name, Timeline h1 (B-214); slice 2 one toolbar with the eye at the right, icon circles (B-214); slice 3 chevron left (B-218); slice 4 group menu order (B-223). Waves (1, 3, 4) -> 2.

### B-215 · bug · move due now and usual around now into a dialog with an icon to toggle it on timeline quick entry…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (prd/medications-3): From the inbox: move due now and usual around now into a dialog with an icon to toggle it on timeline quick entry box.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 5 (wave 1): the three suggestion rows in a popover behind a Sparkles icon inside the box (dot when a pass is due; simple mode too), the help ? and examples dropped, Matching names as an overlay under the field.

### B-216 · bug · suggestion dropdown for quick entry box should appear above elements instead of pushing elements…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (prd/medications-3): From the inbox: suggestion dropdown for quick entry box should appear above elements instead of pushing elements below down the page.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 5 (wave 1): the three suggestion rows in a popover behind a Sparkles icon inside the box (dot when a pass is due; simple mode too), the help ? and examples dropped, Matching names as an overlay under the field.

### B-217 · bug · If today is empty on the timeline, we need some kind of placeholder/prompt to add an entry. Page…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: f58cd4b9

- 2026-11-21 (prd/medications-3): From the inbox: If today is empty on the timeline, we need some kind of placeholder/prompt to add an entry. Page looks goofy without it.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 6 (wave 2, after slice 5): "Nothing logged today yet." and "Add an entry" (focuses quick entry), writers in the full view with no filter.

### B-218 · bug · expand icon for day summary on timeline should be at the left of the day summary, not the right.

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (Robert Bo Davis): Triage (user's choice): timeline-ux-2, a declutter PRD to write: no recipient name in page headers (print only) and no profile corner on the timeline, the eye icon inline with search and filter, the day-summary expand icon on the left, the group dropdown reordered (no care-period line, New care group under the groups, Group settings last).
- 2026-11-21 (plan/timeline-ux-2): Planned (plans/timeline-ux-2-plan.md): slice 1 PageHeader and page headers without the name, Timeline h1 (B-214); slice 2 one toolbar with the eye at the right, icon circles (B-214); slice 3 chevron left (B-218); slice 4 group menu order (B-223). Waves (1, 3, 4) -> 2.

### B-219 · bug · can the tooltip in the quick entry box appear inside the box instead of outside? That icon is also…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (prd/medications-3): From the inbox: can the tooltip in the quick entry box appear inside the box instead of outside? That icon is also not very good.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 5 (wave 1): the three suggestion rows in a popover behind a Sparkles icon inside the box (dot when a pass is due; simple mode too), the help ? and examples dropped, Matching names as an overlay under the field.

### B-220 · change · Improve quick entry box to be more powerful and flexible. Things like "fell" creates an event,…

- status: ready
- prd: quick-entry
- owner: prd/quick-entry
- commit: b5252045

- 2026-11-21 (prd/medications-3): From the inbox: Improve quick entry box to be more powerful and flexible. Things like "fell" creates an event, providers do suggest like they should, but creates a note instead of an appointment. "Dr. Elena Alvarez on the 25th" creates a note as do most provider auto completes when it should be an event. Need to improve the logic for this.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): its own PRD to write, quick-entry: the parser picks the entry kind ("fell" makes an event, provider autocompletes and dates make appointments, not notes). It runs after quick-fixes' quick-entry slices (B-215, B-216, B-219).
- 2026-11-21 (Robert Bo Davis): 2026-11-21: now waits for timeline-ux-2 (B-215, B-216, B-219 moved there from quick-fixes).
- 2026-11-21 (Robert Bo Davis): Planned: plans/quick-entry-prd.md and -plan.md (4 slices, waves 1 → (2, 3, 4)); starts after timeline-ux-2 and tasks-2 are in dev.

### B-221 · feature · locked simple mode is really confusing. We may want to just add a new user type at this point for…

- status: triaged
- prd: simple-mode
- owner:
- commit:

- 2026-11-21 (prd/medications-3): From the inbox: locked simple mode is really confusing. We may want to just add a new user type at this point for locked simple mode. Or just review and fix all of the nits.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): a simple-mode PRD to write. Its interview decides between a new member type for locked simple mode and fixing the nits (touches roles and permissions).

### B-222 · feature · Tasks and todos are confusing. We should rename tasks "todos" or something similar and move them to…

- status: staging
- prd: tasks-2
- owner: prd/tasks-2
- commit: 1495e01a

- 2026-11-21 (prd/medications-3): From the inbox: Tasks and todos are confusing. We should rename tasks "todos" or something similar and move them to the Upcoming section... and maybe rename the upcoming page to something that covers both.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): a tasks-2 PRD to write: rename tasks to todos (or similar), fold them into Upcoming, and maybe rename Upcoming to cover both (routes, appUrls, sync, connector tool names).
- 2026-11-21 (plan/tasks-2): Planned (tasks-2, 2026-11-21): tasks become todos down to the table (one-step migration, production not live), Upcoming + Tasks merge into Planner (tabs Planner, Todos, Past; /planner, /planner/past, /todos; no redirects); 4 slices, waves 1 → 2 → (3, 4); starts after timeline-ux-2 is in dev.

### B-223 · bug · in header care group drop down, we don't need to show the current care period line. New care group…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (Robert Bo Davis): From the inbox: in header care group drop down, we don't need to show the current care period line. New care group should be below the care group selector section, not at the bottom of the drop down. group settings should be the last entry in the drop down.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): timeline-ux-2, a declutter PRD to write: no recipient name in page headers (print only) and no profile corner on the timeline, the eye icon inline with search and filter, the day-summary expand icon on the left, the group dropdown reordered (no care-period line, New care group under the groups, Group settings last).
- 2026-11-21 (plan/timeline-ux-2): Planned (plans/timeline-ux-2-plan.md): slice 1 PageHeader and page headers without the name, Timeline h1 (B-214); slice 2 one toolbar with the eye at the right, icon circles (B-214); slice 3 chevron left (B-218); slice 4 group menu order (B-223). Waves (1, 3, 4) -> 2.

### B-224 · bug · in the add timeline entry dropdown, vitals should be a menu entry with an expandable submenu for…

- status: staging
- prd: timeline-ux-2
- owner: prd/timeline-ux-2
- commit: 95ac03f3

- 2026-11-21 (Robert Bo Davis): From the inbox: in the add timeline entry dropdown, vitals should be a menu entry with an expandable submenu for each vitals type instead of a separate entry for each vitals type.
- 2026-11-21 (Robert Bo Davis): Triage (user's choice): quick-entry and timeline UI nits, one quick-fixes slice each in wave 15. B-215, B-216 and B-219 touch quick entry, so they share a wave with B-220's quick-entry PRD only if their hot files are coordinated.
- 2026-11-21 (Robert Bo Davis): 2026-11-21: moved from quick-fixes wave 15 to timeline-ux-2 (user's call): the same timeline and quick-entry files.
- 2026-11-21 (plan/timeline-ux-2): Planned as timeline-ux-2 slice 7 (wave 1): ui/Menu gains inline expandable groups (no flyout: poor on touch); Vitals is one group in the + menu.

### B-225 · bug · Component tests fail between midnight and about 5 a.m.: they put entries a few hours before now, which lands on yesterday (entryPrint 'an event's: title, time…' gets 'Yesterday, 10:18 PM' for /^Event · Today/; timelineCarePeriods 'a period at a place…' gets 'day 2'; timelineSimple 'a day header names the care period…' times out)

- status: staging
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 33adfc0a

- 2026-11-21 (prd/connectors-2): Found by connectors-2's landing check at 3:18 a.m. on 2026-11-21; reproduced alone at low load. Fix: a fixed clock, or times anchored to the start of today.
- 2026-11-21 (Robert Bo Davis): Also covers B-227 (dropped as its duplicate): timelineSummaries and the minutesAgo(40) day-summary fixtures fail the same way from 00:00 to ~02:30 LA; fix them in the same pass.
- 2026-11-21 (slice/quick-fixes/61): slice 61: fixed 12:00 test clock in apps/web/test/setup.ts; VITE_TEST_CLOCK overrides

### B-226 · change · Medications page should be tabbed into Schedule and Medications

- status: landed
- prd: medications-tabs
- owner: prd/medications-tabs
- commit: 3f8c4d1c

- 2026-11-21 (Robert Bo Davis): Triaged to medications-4: splitting the page into Schedule and Medications tabs is part of B-213's redesign of the Today schedule, and the two touch the same files.
- 2026-11-21 (Robert Bo Davis): Moved to quick-fixes at the user's word (wave 15), out of medications-4.
- 2026-11-21 (Robert Bo Davis): Its own small PRD, medications-tabs, at the user's word (out of quick-fixes). It shares the medications page with medications-4 (B-213), so the two don't run at once.
- 2026-11-21 (Robert Bo Davis): Planned: plans/medications-tabs-prd.md and -plan.md (2 slices; slice 2 after timeline-ux-2 is in dev).

### B-227 · bug · Component tests fail just after midnight America/Los_Angeles: 'today' fixtures made minutes or hours before now fall on yesterday (timelineSummaries, entryPrint 'an event's', timelineCarePeriods 'places', timelineSimple 'a day header names the care period')

- status: dropped
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/timeline-ux-2): 2026-11-21 (prd/timeline-ux-2): 14 failures in timeline-ux-2's full check at 00:20 PST, e.g. 'Event · Yesterday, 10:17 PM' vs /^Event · Today, /; minutesAgo(40) day-summary fixtures. Fails every pnpm check from 00:00 to ~02:30 LA (03:00-05:30 EST). Fix: pin the clock (fixClock) or build today's fixtures after local midnight.
- 2026-11-21 (Robert Bo Davis): Duplicate of B-225 (same tests, same midnight cause); its cases are noted on B-225. Dropped at the user's word.
- 2026-11-21 (prd/quick-fixes): Same bug as B-225; quick-fixes slice 61 covers it (timelineSummaries added to its brief, 2026-11-21). Marked done with B-225. -- quick-fixes orchestrator

### B-228 · bug · Component tests still read attributes and values synchronously right after render: about 40 expect(X()!.getAttribute|value|dataset|checked|placeholder|innerText…) sites (staff, entry, provider, timelineSheetUrls…), outside B-180's sweep

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-21 (prd/quick-fixes): Found by quick-fixes slice 59 (B-180), 2026-11-21: same fix (await expect.poll / found()); proposed for a later quick-fixes wave. -- quick-fixes orchestrator
- 2026-11-21 (prd/quick-fixes): The tasks Undo test's sync reads after undoing were fixed in prd/quick-fixes 71dfbde4 (failed the wave 15 full check under load). -- quick-fixes orchestrator

### B-229 · bug · on timeline page, header and Today section should be in same column width as the rest of the…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/tasks-2): From the inbox: on timeline page, header and Today section should be in same column width as the rest of the timeline on large screens.
- 2026-11-21 (prd/quick-fixes): Proposed for quick-fixes (the user reviews): a small layout fix on the timeline at large widths; one slice in a later wave. -- quick-fixes orchestrator

### B-230 · bug · reminders.int.test.ts 'reminds a task's assignee, and skips a suppressed address' times out at 5000 ms under load in a full check (then 'turns reminders off from the email's unsubscribe link' gets Invalid URL); passes alone

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: d5701923

- 2026-11-21 (prd/quick-fixes): Seen in quick-fixes wave 15's third full check (2026-11-21 05:18, a 1523 s run under contention); 6/6 alone 3x. Likely a longer per-test timeout or less setup per test; the second failure looks like a knock-on. -- quick-fixes orchestrator

### B-231 · bug · "Nothing logged today yet." message should be in a border box like a timeline entry box to match…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (prd/quick-entry): From the inbox: "Nothing logged today yet." message should be in a border box like a timeline entry box to match the rest of the page.
- 2026-11-21 (Robert Bo Davis): Triage: quick-fixes (the user reviews): a small style fix to timeline-ux-2's empty-Today placeholder (TimelineEntryList), one slice alongside B-229 (same timeline route, same wave). Avoid running it while quick-entry touches the empty Today's Add an entry.

### B-232 · bug · Google Calendar keeps pushing to a disabled account: calendarSyncService connectionsFor never checks user.disabledAt (the feed and pull paths do), so disabling a member doesn't stop new appointments and todos reaching their calendar

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P1, a data-access gap. accountAdminService.disable keeps the Google connection; calendarFeedService.resolve and calendarPullService.memberContext both refuse disabled users. Fix: join user and skip disabledAt in connectionsFor (or disconnect on disable), with an int test. Proposed first in the next quick-fixes wave, or a hotfix before the staging PR merges.
- 2026-11-21 (Robert Bo Davis): User 2026-11-21: nothing is live, so Codex findings go to follow-ups unless critical and breaking; this one waits for a normal quick-fixes wave, no hotfix.

### B-233 · bug · A repeating all-day visit today can't move to a new series: the server's pastVisit check uses occurredAt < now, but the UI and planSeriesEdit use isPastVisit (all-day visits count until the day ends), so the upload rejects today's visit and leaves it on the old series

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2. timelineEntryService update (the 'A series edit never rewrites a started visit' check) should call the shared isPastVisit from packages/data/src/db/schema/appointments/seriesEdit.ts with the group's time zone. One slice with an int test.

### B-234 · bug · Editing a 'last Friday' monthly series turns it into '4th Friday' when opened from a month with four Fridays: choiceOfRule keeps monthly.by but drops nth, and choiceRule rebuilds it from the visit's date (BYDAY=-1FR from 2027-02-26 becomes 4FR)

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2, confirmed in apps/web/app/lib/appointments/repeatChoice.ts. Keep the stored ordinal and weekday unless the user changes the repeat; a unit test round-tripping -1FR.

### B-235 · bug · After Back restores the timeline, picking the current filter again in the same minute blanks the medication names (doses show 'Medication'): restored goes undefined, useTimelineMedications' initial becomes NO_ROWS, and useLiveQuery resets its rows without restarting the watch

- status: in-progress
- prd: quick-fixes
- owner: prd/quick-fixes
- commit:

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2, an edge case. useTimelineData passes restored?.medicationRows with no loader fallback (links fall back to initial.linkRows, and useLiveRows keeps rows on a same-key initial change). Fix: a stable fallback, or have useLiveQuery keep rows when the key is unchanged.

### B-236 · bug · In locked simple mode, SimpleNext's 'See all' (Upcoming) and task links look clickable but bounce back to the timeline: lockAllows only permits the timeline and entry routes

- status: triaged
- prd: simple-mode
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 9 (dev → staging), checked against dev 2026-11-21: Codex P2. Belongs with B-221's rethink of locked simple mode (allow those pages, or hide the links when locked). tasks-2 renames Upcoming to Planner and tasks to todos, so fix it after tasks-2 lands; if simple-mode isn't planned soon, a quick-fixes slice that hides the links when locked.

### B-237 · bug · An @-mention that adds or imports a provider can overwrite note text: when the write finishes, useMentionPopup inserts into whatever popup is open now (a different @ query), else into the captured range, which isn't mapped through later edits

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 7f84efb1

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 11 (dev → staging, cadadd63), checked against dev 2026-11-21: Codex P2, a follow-up (nothing live). In apps/web/app/components/notes/useMentionPopup.ts pick(): (live.current.open ?? current).insert. Fix: tie the insert to the original suggestion and map its range through the edits since, or drop the insert when that suggestion has closed; a component test with a slow add.

### B-238 · bug · Log a dose's '+ New medication': switching to an existing medication and back clears the quick-add fields but keeps newDose, so choose() refills Amount with the old dose (a medication saved with no usual dose, logged as the discarded '2 tablets')

- status: ready
- prd: quick-fixes
- owner: prd/quick-fixes
- commit: 8fd57267

- 2026-11-21 (Robert Bo Davis): From Codex's review of PR 11 (dev → staging, cadadd63), checked against dev 2026-11-21: Codex P2, a follow-up (nothing live). In DoseForm.tsx, QuickAddFields remounts on the switch and resets while the parent's newDose stays. Fix: keep the draft across switches, or reset newDose with the fields. DoseForm is in medications-4's hot files (not written yet), so not alongside it.

### B-239 · bug · pnpm prd review: --json mode prints progress lines (asked Codex…, waiting) on stdout, so its output isn't valid JSON

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (review.sh:72), verified. Send progress to stderr when --json.

### B-240 · bug · pnpm prd review --again --wait: if Codex never takes up the re-review within 5 min it falls through to the old verdict instead of exiting 75

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (review.sh:77), verified. Exit 75 when the summary never changes.

### B-241 · bug · codex-review: PR_QUERY reads only the first 100 review threads (and 50 comments each), so a PR with more could read as clean

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (codex-review.mjs:37), verified. Paginate, or refuse clean when hasNextPage.

### B-242 · bug · with_backlog_lock: on Linux, BSD 'stat -f %m' succeeds with non-numeric output before GNU stat is tried, breaking the lock-age arithmetic

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): Codex finding on PR #12 (lib.sh:328), verified. Macs are fine today; check the output is numeric before falling back.

### B-243 · bug · don't deploy developer previews to vercel, we don't have a dev db running and it is a waste of…

- status: landed
- prd: hosting
- owner:
- commit: 8532372b

- 2026-11-21 (Robert Bo Davis): From the inbox: don't deploy developer previews to vercel, we don't have a dev db running and it is a waste of action credits. Only staging (branch: staging) and production (branch: main) should be deployed to vercel.
- 2026-11-21 (Robert Bo Davis): Checked 2026-11-21: already true. deploy.yml runs only on pushes to staging and main; Vercel's Git deploys are off (apps/web/vercel.json); GitHub has only staging and production deployments, no previews. Done inline on dev by the backlog session: workflows.test.mjs now fails if deploy.yml gains another trigger or branch, or another workflow runs on anything but workflow_dispatch.
- 2026-11-21 (Robert Bo Davis): Triaged by the backlog session: hosting (deploys). Already true and guarded by the test in 8532372b, so recorded as done at that commit.

### B-244 · chore · codex-review: trust Codex's summary for the head; outdated Codex threads stop blocking once its codex-review-state on the head says has_unresolved_findings:false

- status: triaged
- prd: github-review
- owner:
- commit:

- 2026-11-21 (prd/github-review): User's decision 2026-11-21. One-line change in openFindings (scripts/loops/codex-review.mjs) plus a test on the outdated.json fixture. Declined, non-outdated threads still need reply + resolve. Update docs/agents/orchestrator.md _Landing a wave_ step 4, docs/orchestration.md and the orchestrator prompt line in prompt.sh (+ prompt.test.mjs): only declined threads need --resolve.

### B-245 · plan · Attach a todo to a note: a note can carry a todo (with its own due day and assignee) instead of a note having a future date

- status: triaged
- prd: planner-3
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the backlog session, 2026-11-21, at the user's request: the future replacement for reminders (future-dated notes), which are to be removed from the Planner. Not triaged; no PRD yet.
- 2026-11-21 (Robert Bo Davis): Follows planner-2 (B-248 remove reminders).
- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, proposed: its own PRD to write, planner-3 (a note carries a todo with its own due day and assignee), after planner-2 (B-248 remove reminders) is in dev, since it builds on notes being past-only. PRD table row added. For the user to check.

### B-246 · change · Planner: remove due doses and passes from the Planner tab (they stay on the Today card and the Medications Schedule tab)

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, agreed with the user: the Planner is for appointments and todos. Drop withDueDoses, UpcomingDoseRow and the pass rows from the Planner (lib/appointments/upcomingDoses.ts, plannerPasses tests); check whether the connector's upcoming tool lists doses and say so before changing it. UI only.

### B-247 · change · Planner: Past becomes an 'Upcoming | Past' toggle inside the Planner tab instead of its own tab

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, agreed with the user: keep the /planner/past route and URL (Back, deep links, sheets closing back), drop Past from PlannerHeader's tab nav, add a two-option control of links in the filter row with the Planner tab active on both; Past stays events only (done todos stay under Todos). UI only.
- 2026-11-21 (Robert Bo Davis): Also, at the user's request (2026-11-21): the Planner tab's filter chips become All, Events, Todos (today All, Appointments, Reminders, with todos hidden under any chip). Events is ?kind=event; Todos is a new todos-only filter (not a timeline kind: upcomingFilters, showsTodos in lib/todos/plannerTodos.ts, useUpcomingData, PlannerFilterChips, the empty text). The Reminders chip goes; until B-248 removes reminders they show only under All. Rework the filter row once, with the Upcoming | Past control.

### B-248 · change · Remove reminders: notes can no longer be dated in the future; use todos instead

- status: triaged
- prd: planner-2
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Backlog session 2026-11-21, the user's decision: a reminder (a future-dated note) goes away in favour of todos. Notes become past-only on the device and the server; remove Reminder from the Planner's + menu, the Planner rows and kind filter, the Today card and simple mode's next, the calendar projection's reminder kind (feed, Google push and pull, reminder emails, Remind me), quick entry's future-note reading and the connector's upcoming and add_note. No data migration (nothing live): seeds change, existing future notes are not converted. Starts after quick-entry (B-220) is in dev: it rewrites the same date rules. B-245 (attach a todo to a note) is the later follow-up.

### B-249 · change · Collapse list filters under a shared Filter dropdown (round sliders button, count badge, removable chips): medications list, providers directory, todos, Planner

- status: in-progress
- prd: list-filters
- owner: prd/list-filters
- commit:

- 2026-11-21 (backlog agent): Backlog session 2026-11-21, the user's request while planning B-213: the medications list's status and type chips collapse under a Filter icon styled like the timeline's round controls; a shared ui/ component; also the providers directory, todos and the Planner (its slice waits for B-247). The search boxes stay visible; the timeline keeps its Filter sheet.

### B-250 · bug · lint tests seem to be failing regularly because types haven't been generated. Maybe regression…

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): From the inbox: lint tests seem to be failing regularly because types haven't been generated. Maybe regression introduced by reordering the steps in check?
- 2026-11-21 (Robert Bo Davis): Triage: tooling bug in the check pipeline (lint needs React Router's generated types; suspect the reordered steps in pnpm check). Small and self-contained, so quick-fixes next wave; if it blocks checks now, a hotfix on dev is the faster path.

### B-251 · bug · convert planner tabs to TabNav component.

- status: triaged
- prd: quick-fixes
- owner:
- commit:

- 2026-11-21 (Robert Bo Davis): Triage: small UI change next to the other Planner tab items (B-246, B-247) in quick-fixes; do it with or after B-247, which changes the same tabs.

### B-252 · feature · Connector: a tool to read the dosing schedule beyond today (tomorrow's or this week's rounds and times), separate from upcoming

- status: triaged
- prd: connectors-3
- owner:
- commit:

- 2026-11-21 (plan/planner-2): From the planner-2 planning interview, 2026-11-21, the user's request: upcoming returns appointments and dated todos only; the dosing schedule gets its own read tool (a new one, or a day parameter on todays_doses). Proposed topic connectors-3, a PRD to write; for the user to check.
