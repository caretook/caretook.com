# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all. Or say it to the inbox session (`pnpm prd inbox`), which pushes the line for you.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

- Offline banner flashes too often when the connection hasn't actually dropped (B-840)
  Needs a longer timeout before marking the site as offline.
- Right nav links overlap the recipient selector and header menu on medium-sized screens (B-848)

## Change requests

- App first load is way too long. (B-764)
  We need to either speed it up or make the loading message more friendly with a progress bar.
- Include captain name and backlog agent name so other agents can find it. (B-799)
  The backlog agents are named after Star Trek captains for the user, but not their internal names, so other agents can't find them by captain name.
- Orchestrator summary for backlog handoff should include the ability to pass on directives from the user more clearly and directly. (B-815)
- Appointment-setting example in easy menu tips should use a doctor from the user's providers (B-833)
- Time limit gate for component tests to keep them from growing too long (B-837)
  5 minute goal, 6 minute hard cutoff.
- Rename timeline View menu labels from Rows and Cards to Condensed and Full (B-849)
- Timeline Full view should show live notes with their rich text formatting (B-850)

## Feature requests

- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- Tags on everything so users can organize data how they want. (B-548)
- nested todos (B-550)
- Connector: tags and tagging (list tags, filter by a tag, add and remove tags on records) for groups that have turned on sharing medical information with connectors (B-861)
  The user's word 2026-11-25: connectors DO need tags when the group shares medical information; the tags PRD (B-548) keeps them out, so this follows it.

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- Can the PWA sync in the background after offline work, or does the user have to open it to sync? (B-805)
- Should the orchestrator PRDQ be slice-based instead of PRD-based? (B-816)
- Research: compare Care Book to Caring Village (B-829)
  Review feature sets and identify overlap, places where we can surpass them, and places where we already do.

## Chores
