# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

- clicking the next entry in the upcoming section of the simple timeline should expand the section, not take you to the next entry. once expanded, clicking on any item should take you to the full view of that item. (B-191)
- undo when checking off a todo should list all the todos that were checked off, not just the last one that was checked off. (B-192)
- rotating placeholder in the timeline entry box is distracting and confusing. Use a static placeholder that is a prompt to type something. and move to a ? with tooltip to explain the format/power. (B-198)
- ability to add a medication quickly from the log a dose screen. (B-199)
- medications need a type field: rx, otc, supplement, etc. (B-200)
- simple timeline date header should show the care period as well (B-201)
- icon order at top of medications page is not great. Add medication button should be a + icon. Print should just be the printer icon. Passes should be labeled between the two. (B-212)
- medications today schedule layout is confusing especially on mobile. Plan an improved layout for passes, scheduled, and as needed. (B-213)
- don't need patient name on the providers, medications, upcoming, or tasks page page, just need it in the print version where applicable. it shows in the header all the time. Can also remove entire profile section in top left of the timeline to reduce clutter. Move eyeball icon inline with search and filter icons and size them appropriately. (B-214)
- move due now and usual around now into a dialog with an icon to toggle it on timeline quick entry box. (B-215)
- suggestion dropdown for quick entry box should appear above elements instead of pushing elements below down the page. (B-216)
- If today is empty on the timeline, we need some kind of placeholder/prompt to add an entry. Page looks goofy without it. (B-217)
- expand icon for day summary on timeline should be at the left of the day summary, not the right. (B-218)
- can the tooltip in the quick entry box appear inside the box instead of outside? That icon is also not very good. (B-219)
- in header care group drop down, we don't need to show the current care period line. New care group should be below the care group selector section, not at the bottom of the drop down. group settings should be the last entry in the drop down. (B-223)
- in the add timeline entry dropdown, vitals should be a menu entry with an expandable submenu for each vitals type instead of a separate entry for each vitals type. (B-224)
- on timeline page, header and Today section should be in same column width as the rest of the timeline on large screens. (B-229)
- "Nothing logged today yet." message should be in a border box like a timeline entry box to match the rest of the page. (B-231)
- don't deploy developer previews to vercel, we don't have a dev db running and it is a waste of action credits. Only staging (branch: staging) and production (branch: main) should be deployed to vercel. (B-243)
- lint tests seem to be failing regularly because types haven't been generated. Maybe regression introduced by reordering the steps in check? (B-250)
- convert planner tabs to TabNav component. (B-251)
- default filter on todos should be "everyone" and then reduce the list.

## Change requests

- you should be able to edit all entries, search, and filter in simple mode. (B-208)
- link to group details edit page from the edit profile screen for editing the care recipient's timezone. (B-211)
- Improve quick entry box to be more powerful and flexible. Things like "fell" creates an event, providers do suggest like they should, but creates a note instead of an appointment. "Dr. Elena Alvarez on the 25th" creates a note as do most provider auto completes when it should be an event. Need to improve the logic for this. (B-220)
- Medications page should be tabbed into Schedule and Medications (B-226)

## Feature requests

- Allow import of providers from other care groups that you have access to. (B-48)
- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- Now that we are we have github fixed, we should start using it for some of the merge management so codex can review PRs. I do NOT want PRDs or plans to be in github, only the code. Instead of merging to dev locally, we need to start pushing working branches to github and creating a PR into dev, then waiting for codex to review, then addressing any comments, then merging to dev. (B-203)
- connector should be able to edit notes and events so it can help you draft questions or add information to the entries. (B-204)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- locked simple mode is really confusing. We may want to just add a new user type at this point for locked simple mode. Or just review and fix all of the nits. (B-221)
- Tasks, todos, and appointments/events are confusing. We should rename tasks "reminders". remove the "reminder notes" from the upcoming system (and the note field for dates) and standardized the naming of "events vs appointments" (B-222)

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.

## Chores
