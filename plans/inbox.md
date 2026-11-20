# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs

- simple entry box on timeline seems to have replaced the old add entry icons entirely. This is a regression that may block B-98. (B-135)

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
- Back the rate limits with Postgres before launch (Better Auth's and packages/api/src/rateLimit.ts). (B-141)
  Both are in memory per serverless instance, which matters with 6-digit sign-in codes.
- Put the Capacitor origins (`capacitor://localhost`, `https://localhost`) behind an env flag until the native app ships, and define them once. (B-142)
  They are hard-coded as trusted, with credentials, in routes/rpc.ts and packages/auth/src/auth.ts.
- Simple mode's timeline has too much plain-text instruction: drop the quick-entry typing tips under the big box, and the tiles hint ("These follow what's logged most. The group's owners can choose them."). (B-157)
  Tips: `QuickEntrySuggestions` (`data-quick-tips`) could take a `showTips` prop that `QuickEntryBox` turns off for `size="lg"`; the dictation hint stays.
  Tiles: in `SimpleTiles.tsx`, show only the "Choose the tiles" link to those who can choose, and nothing to members. Update `timelineSimpleTiles.browser.test.tsx` (the hint text) and docs/domain/timeline.md (the first-run hint).
- Take the client IP for rate limits from the host's own header: `clientIpOf` (routes/rpc.ts) trusts the first `x-forwarded-for` entry, which is spoofable off Vercel (the planned AWS side). (B-143)

## Feature requests

- Allow import of providers from other care groups that you have access to. (B-48)
- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- Todos list with assignment to group members, due dates, and completion status. (B-55)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- Service worker for the web app: a precached shell, so repeat loads are near-instant and a reload works offline (docs/domain/sync.md already notes the gap). (B-144)

## Big plans

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.

## Chores

- Shrink what every agent loads: split AGENTS.md (31 KB, changed 97 times in 30 days) and docs/loops.md (52 KB, bullets up to 3.4 KB) by reader (loop agent, orchestrator, user), and keep the core to rules only. (B-147)
- Trim the domain docs to current contracts: timeline.md and medications.md are about 19 KB each and carry slice and backlog history that git already holds. (B-148)
- Split the shared registries by area, each composed by a thin index, so concurrent PRDs stop conflicting on them. (B-149)
  The most-edited files in 30 days: scripts/loops/check-areas (69 commits), routes.ts (46), appUrls.ts (32), errors/constants.ts (28), db/schema/index.ts (26), permissions.ts, router.ts.
- Group apps/web/app/lib/ by domain: about 140 flat files named by prefix (`medication*`, `period*`, `quickEntry*`). Folders let an agent read one area, and check-areas use one rule per folder. (B-150)
- Break up the browser checks by flow: 18,500 lines in all, medications.mjs alone 4,373. (B-151)
- Batch the backlog commits: 714 of the last 30 days' commits are `chore(backlog)`, which buries the history agents read. (B-154)
- Add a bundle-size budget to the build check, so the editor and PowerSync stay out of the first chunk. (B-155)
- Check whether `loadSettings` in the timeline loader waits on the network before using its cache. (B-156)
