# Seeded test accounts

`pnpm datastore:start` (and `datastore:reset`) seeds these accounts. Every one signs in with email and password, and they all share the `SEED_USER_PASSWORD` from `packages/data/.env` (no password is set when it's missing). Staging uses its own secret `SEED_USER_PASSWORD`. Everything here is fictional.

The seeds live in `packages/data/src/db/seeds/`. Add a new account there and here.

## Accounts

| Account                    | Name              | Care groups (role)                                                     | Good for                                                     |
| -------------------------- | ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `member@example.com`       | Dev Member        | Dev Family (owner), Dev Family 2 (owner)                               | the everyday account; two groups                             |
| `caretaker@example.com`    | Dev Caretaker     | Dev Family (caretaker)                                                 | a caretaker's view                                           |
| `viewer@example.com`       | Dev Viewer        | Dev Family (viewer)                                                    | read-only view                                               |
| `easyhelper@example.com`   | Dev Easy Helper   | Dev Family (easy helper)                                               | the easy roles                                               |
| `onboarding@example.com`   | Dev Onboarding    | none; nothing set up                                                   | the setup flow; reset with `pnpm datastore:reset:onboarding` |
| `easyviewer@example.com`   | Dev Easy Viewer   | Dev Family (easy viewer)                                               | the easy roles                                               |
| `trio@example.com`         | Dev Trio          | Rivera Family (owner), Okafor Family (caretaker), Chen Family (viewer) | one person, three roles                                      |
| `groupadmin@example.com`   | Dev Group Admin   | Rivera Family (admin)                                                  | the group admin role                                         |
| `viewer2@example.com`      | Dev Viewer Two    | Rivera Family (viewer), Okafor Family (viewer)                         | a viewer in two groups                                       |
| `owner2@example.com`       | Dev Owner Two     | Okafor Family (owner), Chen Family (owner)                             | owning more than one group                                   |
| `solo@example.com`         | Dev Solo          | Solo Care (owner, the only member)                                     | a group of one                                               |
| `tedder@example.com`       | Dev Tedder        | Tedder Family (owner)                                                  | trying the app by hand: fullest data                         |
| `tedderhelper@example.com` | Dev Tedder Helper | Tedder Family (caretaker)                                              | the Tedder Family as a helper                                |
| `joiner@example.com`       | Dev Joiner        | none; has a pending request to join Dev Family                         | the join request flow                                        |
| `admin@example.com`        | Dev Admin         | none; site role `admin`                                                | `/admin`                                                     |
| `support@example.com`      | Dev Support       | none; site role `support`                                              | `/admin` as support staff                                    |

## Care groups

| Group         | Cared for                 | Notes                                                                                 |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Dev Family    | Pat Example (Grandma Pat) | the main dev group, with most of the seeded data; assistants (connectors) are allowed |
| Dev Family 2  | Lou Example (Grandpa Lou) | a few days of timeline                                                                |
| Rivera Family | Ana Example (Abuela Ana)  | a small group for trying roles                                                        |
| Okafor Family | Ben Example               | a small group for trying roles                                                        |
| Chen Family   | Mei Example               | a small group for trying roles                                                        |
| Solo Care     | Ray Example               | one member                                                                            |
| Tedder Family | Hal Tedder (Grandpa Hal)  | fully set up (providers, medications, events, todos, profile); no test reads it       |

## Other seeded things

- **Invites to Dev Family:** an email invite waiting for `sam.invited@example.com` (caretaker), opened at `/invite/DevFamilyEmailInvite-seeded-0001`, and a viewer link at `/invite/DevFamilyViewerLink-seeded-0001`.
- **Access code** for starting a new care group: `/join/CARE-DEMO-0001` (no use limit).

## On staging

Seeding staging also makes every real account (any address not at `@example.com`) an owner of every seeded group, so whoever tests staging sees the fictional data without an invite, and moves the seeded accounts to the current `SEED_USER_PASSWORD`.
