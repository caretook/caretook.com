# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs

- When viewing the member page as an owner, the simple mode and locked buttons make the data too wide for the container. Stack those radios on top of each other (B-184)
- The today bar on timeline should always be collapsed unless there is something overdue or upcoming. (B-185)
- vitals section in today block doesn't expand when you click see all, it filters the data instead. It should expand the number of rowsto show all the vitals if there are more than fit, and shouldn't appear if they fit in the container. (B-186)
- timeline filter interface is overwhelming on mobile and confusing on desktop, especially the vitals subfilters. Maybe move into a "filter" button that opens a modal with the filters. (B-187)
- when signing up mcp connector, the oauth request just returns json, not the accept flow (B-188)
- mcp connector for medication change records on the timeline, it isn't providing information about what what kind of change it was (started, stopped, or a new dose), and there are no before-and-after values. (B-189)
- mcp connector returning truncated notes on doses, and maybe other things (B-190)
- clicking the next entry in the upcoming section of the simple timeline should expand the section, not take you to the next entry. once expanded, clicking on any item should take you to the full view of that item. (B-191)
- undo when checking off a todo should list all the todos that were checked off, not just the last one that was checked off. (B-192)
- rotating placeholder in the timeline entry box is distracting and confusing. Use a static placeholder that is a prompt to type something. and move to a ? with tooltip to explain the format/power.
- ability to add a medication quickly from the log a dose screen.
- medications need a type field: rx, otc, supplement, etc.
- simple timeline date header should show the care period as well

## Change requests

- Stop blocking every /app navigation on a session request: use the session confirmed in the last few minutes and recheck in the background. (B-136)
  `requireSession` (apps/web/app/lib/session.ts) awaits `get-session` on each navigation, with no timeout, so every tap waits a round trip and can hang on a weak connection.
  Add a timeout of about 3 s that counts as "no answer". The server still checks every upload and sync token.
- Prefetch the group section tabs, so the first tap on a section doesn't download its route chunk (and works offline). (B-137)
  The links in routes/app/layout/SectionNav.tsx (SectionNav and TabBar) have no `prefetch`; sheets already use `prefetch="render"`.
- Highlight the tapped section tab at once, from the pending navigation (`useNavigation`), not only after the loaders finish. (B-138)
- Add `content-visibility: auto` to timeline entries: the list grows by 30 rows with no virtualization. (B-139)
- Cut the per-request auth cost on /rpc: `getAuthUser` runs a session lookup and two queries on every call, public procedures included. (B-140)
  A short cookie cache, or skipping the lookup for public procedures (packages/auth/src/authUser.ts, routes/rpc.ts).
- In simple mode, Reorder so that "What happend" is directly above the timeline, basically like the full layout. Replace "Now" heading with "Upcoming". Reduce size of quick action buttons so that they are one row with smaller buttons so they are one row."Tap the microphone on your keyboard to say it instead of typing." should only appear on devices that support voice input via keyboard (ios/andriod?). All text is too large and should be reduced in size. Assume users that can't see well will have there devices set to larger text, or zoom their browsers. (B-162)
- "Try “bp 130/85 hr 72”, “gave metformin”, “pain 4 left knee” or “appt Dr Lee Friday 2pm”. Commas separate entries; start with “n:” for a note." should be a tooltip. (B-163)
- "day/date" heder for full timeline is too small compared to the + button. Make text larger. (B-164)
- Move "author" tile below hamburger menu on timeline entries, it takes up valuable text space. (B-165)
- Using back to timeline from timeline live-note entry (or any browse action) takes you back to the timeline, causes all lazy loaded header elements to reload. Can we cache their state with a visual indicator (maybe greyed out) and load in the background so that it doesn't cause page shift? Maybe keep a placeholder in the header so that it doesn't cause a flash on load any time? (B-166)
- Make day summary part of sticky header so it is always visible when scrolling up the timeline. (B-167)
- timeline group titles that are too long wrap to multiple lines on small screens. Truncate the provider on small screens. (B-168)
- vitals, upcoming, medication due, and todo overdue can be combined into a single tile that is collapsible. They should all have a right side link to the full view that is formatted similarly. (B-169)
- When creating a new timeline entry for a note or event, we should navigate to edit page on save so the user can add more info to the live document immediately without an extra tap. (B-170)
- your recent lines should exclude notes and events. vitals should only show the vital key, not the value so that the user can log those quickly without deleting the value. (B-171)

## Feature requests

- Allow import of providers from other care groups that you have access to. (B-48)
- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload works offline (docs/domain/sync.md already notes the gap). (B-144)

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.

## Chores

- Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and carry slice and backlog history that git already holds. (B-148)
- Break up the browser checks by flow: 18,500 lines in all, medications.mjs alone 4,373. (B-151)
- Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first chunk. (B-155)
- Check whether `loadSettings` in the timeline loader waits on the network before using its cache. (B-156)
