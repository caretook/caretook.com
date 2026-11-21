# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

- on timeline page, header and Today section should be in same column width as the rest of the timeline on large screens. (B-229)
- "Nothing logged today yet." message should be in a border box like a timeline entry box to match the rest of the page. (B-231)
- call and directions icons on planner schedule should be below the time, not beside the title/description to free up space on mobile. (B-256)
- Bottom menu on mobile need a better deign. I like floating menus. It needs to be a different bg color than the rest of the page and we can probably move to pure icon buttons instead of text buttons with aria tips (B-399)
- plus button on timeline day header should be on far right so all actions are on right. Care period can swap with it. change link which adds care period can be an icon button. (B-412)
- don't collapse past providers on list providers page, it breaks search and isn't needed. This list will never be THAT long. (B-413)
- owner pill on planner/planner list should be below time/date field. Too busy under title. (B-416)

## Change requests

- Timeline header has room for "Easy Mode" toggle now. move it out of eyeball menu and into the header on the full app header to match simple mode. (B-400)

## Feature requests

- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- locked simple mode is really confusing. We may want to just add a new user type at this point for locked simple mode. Or just review and fix all of the nits. (B-221)
- animations are cool. add some to actions, hovers, etc... be classy about it. For instance the expand carat on the timeline today header animates, the expand on the day summary does not. search toggle should animate, etc... (B-414)
- choose a more modern font set. (B-415)
- We are getting close to feature complete. We need another marketing content pass that updates copy and layout to reflect the new features. Also improve ui to meet modern design standards. NO SCREENSHOTS yet. No videos. (B-417)

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.

## Chores
