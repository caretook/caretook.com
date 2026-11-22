# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

- call and directions icons on planner schedule should be below the time, not beside the title/description to free up space on mobile. (B-256)
- plus button on timeline day header should be on far right so all actions are on right. Care period can swap with it. change link which adds care period can be an icon button. (B-412)
- don't collapse past providers on list providers page, it breaks search and isn't needed. This list will never be THAT long. (B-413)
- owner pill on planner/planner list should be below time/date field. Too busy under title. (B-416)
- on providers page, import from another group is too wordy. Import icon is fine. It is for power users anyway. Move the add button (just a + icon) and import icons to the right side of the header. Add is primary, import is secondary. and they should be similarly sized/styled. (B-419)
- planner add button can just be a plus icon. Maybe wait on button component. every main page header can have a + icon button in the top right of header to add a new item. other secondary buttons should be to left of the + button. (B-420)
- type pill on medication list items should float right. (B-421)

## Change requests

## Feature requests

- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- animations are cool. add some to actions, hovers, etc... be classy about it. For instance the expand carat on the timeline today header animates, the expand on the day summary does not. search toggle should animate, etc... (B-414)
- choose a more modern font set. (B-415)
- We are getting close to feature complete. We need another marketing content pass that updates copy and layout to reflect the new features. Also improve ui to meet modern design standards. NO SCREENSHOTS yet. No videos. (B-417)
- In providers list page, contact links in rows make it too hard to know what to click. Make those clickable in the details sheet and remove the information from the rows. Most of the time we want notes open during contact anyway. (B-422)
- Standardize on single Button design component. Can have options like primary, secondary, danger, etc. Can have sizes like small, medium, large. Can have variants like icon, text, etc. Can have shape like pill, square, round, etc. use it for every interactive link icon or text button in the app other than header and footer, expand actions, and hamburgers. Ask me if there should be other exceptions. (B-423)
- medications page should have passes as a tab, not in header. + button should be a dropdown with add selection like other pages. Should probably wait on button component and standardized header add button. (B-424)

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.

## Chores
