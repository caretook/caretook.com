# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs

- clicking the next entry in the upcoming section of the simple timeline should expand the section, not take you to the next entry. once expanded, clicking on any item should take you to the full view of that item. (B-191)
- undo when checking off a todo should list all the todos that were checked off, not just the last one that was checked off. (B-192)
- rotating placeholder in the timeline entry box is distracting and confusing. Use a static placeholder that is a prompt to type something. and move to a ? with tooltip to explain the format/power. (B-198)
- ability to add a medication quickly from the log a dose screen. (B-199)
- medications need a type field: rx, otc, supplement, etc. (B-200)
- simple timeline date header should show the care period as well (B-201)

## Change requests

## Feature requests

- Allow import of providers from other care groups that you have access to. (B-48)
- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- Now that we are we have github fixed, we should start using it for some of the merge management so codex can review PRs. I do NOT want PRDs or plans to be in github, only the code. Instead of merging to dev locally, we need to start pushing working branches to github and creating a PR into dev, then waiting for codex to review, then addressing any comments, then merging to dev. (B-203)
- connector should be able to edit notes and events so it can help you draft questions or add information to the entries. (B-204)

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.

## Chores
