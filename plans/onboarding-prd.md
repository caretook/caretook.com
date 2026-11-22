# PRD: Guided setup, legal acceptance and an installable app (onboarding)

Backlog items B-31 (guided onboarding), B-359 (record terms, privacy and 18+ acceptance) and B-360 (the app isn't installable).

## Decisions

| Decision                                                                                                                                                                                          | Why                                                                                               | Source                                                                                       | Cost to change later                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Existing accounts are not asked to accept. Acceptance is asked at new sign-ups and invite accepts only                                                                                            | The user's call                                                                                   | asked: recommended asking existing accounts once, chose new sign-ups and invite accepts only | medium: a gate on `/app` later                                   |
| No demo group here, per user or shared. The demo is its own topic, `demo-site`                                                                                                                    | The user's call, through the backlog session                                                      | asked: recommended a later demo group in `onboarding-2`, chose a separate topic              | none here                                                        |
| Guided setup happens in the person's real care group                                                                                                                                              | The user's call, through the backlog session                                                      | asked: as recommended                                                                        | high                                                             |
| The checkbox also links the Consumer Health Data Privacy Policy, and each record names its version                                                                                                | The user's call; past records can't gain it later                                                 | asked: as recommended                                                                        | high: a migration                                                |
| One acceptance record per acceptance, append-only, written by the system, naming the terms, privacy, health-data privacy and wording versions and where it was given. No IP address or user agent | Matches `care_group_consent`, and the site promises not to store them with forms                  | assumed                                                                                      | high: a migration, and past rows can't gain what wasn't recorded |
| Deleting an account deletes its acceptance records                                                                                                                                                | Same as `care_group_consent`; AGENTS.md requires user data deletion                               | assumed                                                                                      | medium: a migration and a retention rule                         |
| One checkbox covers 18+ and the three legal documents                                                                                                                                             | The smallest form that records them all                                                           | assumed                                                                                      | low: one wording version                                         |
| An invite accept asks only when the account has no acceptance of the current versions                                                                                                             | A new person isn't asked twice in a minute; an existing account accepting an invite is asked once | assumed                                                                                      | low                                                              |
| No re-ask or notice for a changed policy is built here. A new version applies to later sign-ups and invite accepts; a material change needs its own notice first, as the privacy policy promises  | Keeps this topic to the user's answer without deciding how a material change is handled           | assumed                                                                                      | medium: a follow-up item                                         |
| Only the person can read their acceptance rows; staff read none through the app                                                                                                                   | Same as `care_group_consent`; no staff screen needs it                                            | assumed                                                                                      | low: one permission                                              |
| Creating another care group from inside the app doesn't ask                                                                                                                                       | It's neither a sign-up nor an invite accept                                                       | assumed                                                                                      | low                                                              |
| The setup card appears for 14 days after a person joins a group, until finished or dismissed                                                                                                      | Established members aren't nagged, with no backfill or migration                                  | assumed                                                                                      | low                                                              |
| Steps complete from the group's real data, on the device. Only the dismissal is stored, on the account's preferences                                                                              | Works offline, needs no table, and follows the person across devices                              | assumed                                                                                      | low                                                              |
| Owners, admins and caretakers get the checklist. Viewers and both Easy roles get a short welcome for their role                                                                                   | They can't do the setup steps                                                                     | assumed                                                                                      | low                                                              |
| The app opens at `/app` when installed, in its own window. Existing icons are used                                                                                                                | B-360's words; no new asset                                                                       | assumed                                                                                      | low                                                              |

**The skeptic's pass changed:** slices 1 and 3 now own the browser checks they affect, and seeded members start with the card dismissed; a changed policy is no longer treated as settled; staff can't read acceptance rows; the new table sits in the `auth` area; signed-in members get links to the legal pages; hot paths are listed. It declined nothing. Its question on the health-data policy went to the user, who chose to link and record it.

## Problem

A new member lands on a nearly empty timeline with one prompt to invite someone. Nothing shows them what to set up, what their role can do, or that they can connect their own AI assistant. The terms require people to be 18 or older, but nothing records that anyone agreed to the terms or the privacy policy. And on a phone, Caretook can't be installed as an app: the manifest opens the marketing home page in a browser and is linked only from marketing pages.

## Solution

People who sign up, or accept an invite, tick one box confirming they are 18 or older and agree to the Terms, the Privacy Policy and the Consumer Health Data Privacy Policy, and the app records which versions they agreed to. Someone who just joined or created a care group sees a short setup card on its timeline, suited to their role, whose steps tick themselves off as the real work gets done. Caretook can be installed to a phone's home screen and opens straight into the app.

## User stories

1. As someone signing up with an access code, I want to confirm I'm 18 or older and agree to the Terms, Privacy Policy and Consumer Health Data Privacy Policy, so that I know what I'm agreeing to.
2. As someone signing up from an email invite or invite link, I want the same confirmation, so that every new account has agreed.
3. As someone with an account accepting an invite, I want to be asked only if I haven't agreed to the current versions, so that I don't tick the same box twice.
4. As someone reading the form, I want to open each legal page without losing what I typed, so that I can read them first.
5. As the operator, I want a record of who agreed to which versions and when, so that I can show it if asked.
6. As an existing member, I want to keep using the app without a new prompt, so that nothing interrupts care.
7. As a new owner, admin or caretaker, I want a short list of what to set up in my group, so that I know where to start.
8. As that member, I want each step to tick itself off when I've done it, on any device and offline, so that the list stays true.
9. As an owner or admin alone in a group, I want the list to include inviting someone, so that I can share the work.
10. As a member who can use an AI assistant, I want the list to point me to the connect guide, so that I find it without being told.
11. As a member, I want to dismiss the setup card, and have it stay gone on my other devices, so that it doesn't get in my way.
12. As a new viewer or Easy role member, I want a short welcome that says what I can do, so that I'm not shown tasks I can't do.
13. As a member on a phone, I want to install Caretook to my home screen and have it open in its own window at the app, so that it feels like an app.
14. As a member opening the installed app offline, I want it to open my care group, so that it works where I need it.

## Implementation decisions

- **Legal rules (pure, client-safe):** the current terms, privacy, health-data privacy and wording versions and the checkbox wording. The three document versions equal the legal pages' last-updated dates; a unit test holds them equal, so a page edit can't go unversioned. Shared screens never import marketing code.
- **`legal_acceptance` (new table, adds a migration):** in the `auth` area (schema, permissions, errors, check-areas). User (cascading), the versions, `source` (`access_code`, `invite_signup`, `invite_accept`), timestamps and audits. Not synced. Read only by the person; written only by `system`.
- **Legal acceptance service:** `record(tx?, …)` and `hasCurrent(user)`. Everything else goes through it.
- **API:** access-code and invite sign-up require `legal: true`. `invite.accept` takes an optional `legal: true` and returns a typed `legalRequired` error when the account has no current acceptance and it isn't given. An authed read says whether the signed-in person needs to be asked.
- **Sign-up atomicity:** access-code sign-up records acceptance in its existing transaction. Invite sign-up records it directly after creating the account; if that write fails, the accept step sees no current acceptance and asks again.
- **An address that already has an account** gets the same answer as today and no row, so sign-up still reveals nothing about who has an account.
- **The legal links** open in a new tab. On the native target, where `/terms`, `/privacy` and `/health-data-privacy` don't exist, they use the web origin. Account settings carries the same links, so a signed-in member can reach them, including in the installed app with no address bar.
- **Getting-started steps (pure):** `gettingStartedSteps({ role, facts })` returns the role's steps with done states, or a welcome. Writers: profile basics (an allergy or condition recorded, or "none known"), a medication, a first entry. Managers add: invite someone. Roles that may use connectors add the connect guide, an unticked link that doesn't count toward completion, pointing to Assistants for owners and to Devices for others when the group has connectors on.
- **The setup card:** a timeline region, reading facts from the device's synced data. It takes the place of the existing invite card while it shows, and its invite step keeps that card's `data-invite-card` hook, so the checks that look for it still hold. The Easy timeline shows the role's welcome. Seeded members start with their seeded groups dismissed, so the card doesn't appear across every check.
- **Dismissal:** an additive field on `user.preferences`, a list of group ids, saved through the existing settings path, so it works offline.
- **Install:** the manifest gets `id` and `start_url` of `/app`, `scope` `/`, and `display: standalone`. It's linked from the root for every page; iOS gets its web-app meta tags. The service worker already serves `/app` offline.

## Testing decisions

- **Unit:** legal versions match the pages; `gettingStartedSteps` for each role and state; the 14-day window; the manifest's fields.
- **Integration:** the acceptance service and permissions; each sign-up refused without `legal`; an existing address writes no row; accept with and without a current acceptance. Prior art: `careGroupInvite.int.test.ts`, `invites.int.test.ts`.
- **Component:** the checkbox on `/join/:code` and `/invite/:token`; the setup card by role, self-ticking and dismissal; the Easy welcome.
- **End to end:** extend the `invites` check's existing sign-up flows so they tick the box (the access-code flow in slice 1, invites in slice 4). Rerun `first-sync` for the new-group card. Extend `layout-offline` only if the installed start URL isn't already covered by its offline reload. No new check.

## Out of scope

- The demo environment (`demo-site`) and any seeded demo group.
- Asking existing accounts, or re-asking anyone when the legal text changes.
- Finalising the legal text: the pages stay drafts until the user says otherwise.
- Ownership transfer, an accessibility statement and app-store prerequisites (noted on B-360, not asked for by it).
- A custom install prompt, maskable icons, and push notifications.

## Notes

- The legal pages still carry a DRAFT banner and placeholders. Acceptances recorded now name those draft versions, so the final text needs a version change. Since existing accounts aren't re-asked (the user's call), anyone who accepted a draft stays on that record.
