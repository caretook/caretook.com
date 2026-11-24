# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all. Or say it to the inbox session (`pnpm prd inbox`), which pushes the line for you.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

- After a long idle tab (and a staging deploy), clicking the main header nav didn't do anything on staging; had to reload the page. (B-735)
- On the timeline, after jumping to a day, trying to scroll always takes you back to that day. (B-736)
  Jump to day should probably be a quick action with no URL query string (or the query string should be removed after the jump).
- Inbox agent opened with Opus medium instead of low. (B-739)
- On installed PWA on iOS, the bottom navigation bar floats too high up; it needs to be closer to the bottom of the screen.

## Change requests

- Placeholder and search bar on timeline should read "Type to search". (B-748)
- App first load is way too long.
  We need to either speed it up or make the loading message more friendly with a progress bar.

## Feature requests

- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- We are getting close to feature complete. We need another marketing content pass that updates copy and layout to reflect the new features. Also improve ui to meet modern design standards. NO SCREENSHOTS yet. No videos. (B-417)
- Tags on everything so users can organize data how they want. (B-548)
- Symomtons need to be repeatble and filterable need multi filter. (B-549)
- nested todos (B-550)
- A link icon on each timeline day header and item so users can easily send links to other people. should NOT prevent scrolling later (B-737)
- Ability to open live notes full screen.

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.

## Chores
