# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs

- Login link allows clicking multiple times while already loading login flow... login flow very slow. (B-1)
- date picker entry box mobile-friendly. it expands outside of elements on small screens. (B-71)
- suggested provider list is too long on mobile. (B-72)
- timeline entry add modal should take up the full screen on mobile, don't leave room for header. (B-73)

## Change requests

- Latest vitals is too busy. (B-2)
- Width of timeline entries can be larger on larger screens while still being mobile-friendly on smaller screens. (B-3)
- Hover actions on timeline author shorthand should show a tooltip with the author's name and avatar. (B-4)
- Clicking the icon on a timeline entry should filter by that type of entry. (B-5)
- Clicking on the author shorthand should filter by that author. (B-6)
- Larger/more prominent font for date entries in timeline. (B-7)
- Reorder/group "new" buttons in timeline to "note", "event", "dose", "symptom", "vital" (B-43)
- Display phone number, address, email, etc. in provider directory without a click. Use that as link to call/email/map/etc. (B-44)
- birthdate, contact information, address, and insurance information should optionally be added to the patient profile. (B-45)
- optional phone number, address, etc on group members that can be published to the group for contact. Flags for "emergency contacts" and "primary contact" for display later. (B-46)
- improve timeline page display for vitals and upcoming banner. They should be limited. We should replace the word "latest" with the vitals icon and match the style of the upcoming header. Width should be limited on very large screens. larger than the timeline column, but not too wide. (B-78)
- need an upcoming medication banner on the timeline page and a way to quickly add doses to the timeline from it (or some other simplification). This needs to wait on medication groups. (B-86)
- PRD tooling needs improvements: remove references to gh issues. Have orchestrator agent ask if the user wants to prompt for landing or just work through everything and which slices to land automatically. Add command to spin up new planning session. (B-88)
- Seed data with multiple care groups and user mix for improved manual testing. (B-90)
- Email link and code shouldn't really be two different login options, should they? Can't we email a link and a code at the same time? (B-96)
- Vitals filter on timeline should bring up a sub-filter for vital type. (B-97)
- Hide add to timeline buttons behind a + icon in the timeline header. (B-98)
- Don't display recent vitals in the timeline header in mobile, (B-99)
- Add "recent vita averages" to the profile page. (B-100)
- Hide add to timeline buttons behind a + icon in the timeline header. (B-101)
- Don't display recent vitals in the timeline header in mobile, (B-102)
- Add "recent vita averages" to the profile page. (B-103)

## Feature requests

- Use avatar for "user" in header with a dropdown menu for user related actions/settings. (B-8)
- Use dropdown on current care group to change care group settings or switch to another care group. (B-9)
- Timeline should infinite scroll through all entries without clicking. (B-10)
- Need to add elasticsearch based search to the timeline. (B-11)
- Split app routing/nesting into subpaths for each page instead of using a single root route. (B-23)
- Prefer well abstracted components over single-file components and refactor existing components to be more abstracted. (B-24)
- Deal with future event display (appointments) notes can be set to the future date as well. Symptoms and vitals cannot. Medication reminders may be a specialized type of future item on the timeline. Display of future events on timeline should be toggled somehow. (B-47)
- Allow import of providers from other care groups that you have access to. (B-48)
- Once we have agentic integration, Add ai generated summary to each day on the timeline and the option to view a condensed summary of days for quick scanning. (B-49)
- Add ability to add timeline groupings, like "at home - start date-end date", "in hospital - start date-end date", "at home on hospice - start date-end date", etc. These will be useful in the summary and for filtering. (B-50)
- printable medication schedule sheet that can be printed to be checked off with a pen at patient's bedside. (once we have ai, we can allow photo of the sheet to be used to update timeline) (B-51)
- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- Todos list with assignment to group members, due dates, and completion status. (B-55)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- medications need to keep a history of past dose changes, frequency changes, etc. on each medication entry. (B-75)
- medication groups for doses. Often the same medication is taken at different times of the day every day. We need to be able to group doses together so that they can be taken at the same time as part of the schedule and allow for setting status of each medication in the group on dose logging in the timeline. (B-76)
- PRD tooling streamlining. We are using way too many resources for full docker stacks and browser tests. We should discuss options for reducing the overhead. (B-89)
- Need an Admin panel for caretook global administrators to manage users, care groups, and settings. (B-91)

## Big plans

- Plan lightweight agentic chat options (with voice support) for quick actions (like adding a note, symptom, event, vital, etc.) and for asking questions about the timeline. (B-12)
- Add in providers directory with search and linking to event entries in timeline. (B-13)
- Add provider linking/suggestions to event entries in timeline and live notes. (B-14)
- Work on medication list management and tracking in timeline. (B-15)
- Discuss options for end to end encryption of data in transit and at rest where owner of the data is the only one who can decrypt it and share decryption keys with others. (B-57)
- Add ability to use AI to review timeline, explain concerns, and generate a cheat sheet of questions for provider appointments. (B-58)
- Data security and encryption review. (B-77)
- "simple mode" for the timeline page. We need a way for less tech savvy users to easily add items to and view the timeline without having to learn the full interface. This is a pre-launch feature once other features are in place. (B-87)

## Questions

- How does timeline format persist? (B-16)

## Chores

- Clean up/truncate this file and the backlog periodically. (B-59)
