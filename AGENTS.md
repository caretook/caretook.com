# Caretook — Project Context

Read this first. It records the plans and decisions made so far, so a new session can pick up without re-deriving them.

**Do not build product features until the user asks.** The project is still at the framework stage. The user will supply example patterns for other parts of the system, and we'll choose dependencies together. Don't add dependencies on your own initiative.

## Product

Caretook (caretook.com) is a mobile-responsive collection of tools and dashboards that help caretakers manage someone else's care. It may later be packaged for the app stores with Capacitor.

Planned feature areas, listed only to inform stack decisions:

- **Care timeline:** daily entries, symptoms, events and appointments. **Hard requirement:** real-time sync and offline sync between multiple users.
- **Medication list:** current, past and discontinued medications, plus a printable medication sheet.
- **Provider and contact directory.**
- **Later:** AI features (reviewing timelines, taking notes during appointments, preparing questions for doctor visits) and calendar integrations (iCal feeds, Google Calendar).

## Status legend

- ✅ **Decided**: implemented, or agreed with the user.
- 🟡 **Proposed**: the current plan, but not installed or confirmed yet.
- ❓ **Open**: still needs a decision.

## Decisions

### Language and repository

- ✅ TypeScript everywhere, with types **inferred** from backend to frontend (no code generation).
- ✅ A pnpm workspaces monorepo: `apps/*` and `packages/*`.
- ✅ Node **24 LTS** (pinned in `.nvmrc`). React Router 8 needs Node ≥22.22. Run `nvm use` first; the machine's default Node is older.
- ✅ pnpm **12.21.0** (pinned in `packageManager`; an older pnpm switches to this version on its own). Settings live in `pnpm-workspace.yaml`. pnpm 11+ no longer reads them from `.npmrc` or the `"pnpm"` field in `package.json`, and it fails on unknown keys.
  - `minimumReleaseAge` keeps its default (a package must be at least 1 day old). Keep it on: it's a supply-chain guard. If an install fails because a package is too new, wait a day rather than relaxing it.
  - Build scripts must be approved in `allowBuilds`, otherwise the install fails. Only `esbuild` (needed by drizzle-kit) is approved so far.
  - Vercel: the lockfile still says `lockfileVersion: '9.0'`. Check that the first deploy actually runs pnpm 12.
- ✅ TypeScript **5.9**, matching the official React Router template. TS 7 exists, but tooling support for it is still uneven.
- ✅ Lint, format and test tooling, all installed at the root:
  - **ESLint 10**, flat config in `eslint.config.js`. It uses `typescript-eslint` **type-aware** rules (`recommendedTypeChecked` with `projectService`), which catch floating promises and unsafe `any`. Also `consistent-type-imports` (separate `import type` lines) and `react-hooks` for `apps/web`.
  - **Prettier 3** (`.prettierrc.json`: `printWidth` 110), run on its own, with `eslint-config-prettier` turning off conflicting lint rules. We don't use `eslint-plugin-prettier`.
  - **Vitest 5**: projects are declared in the root `vitest.config.ts`. `data:unit` runs `*.test.ts` with no database. `integration` runs every package's `*.int.test.ts` against the test Postgres (port 5435), as one project because they share that database. Its `globalSetup` clears and migrates that database once per run, refuses any other host or port, and runs files one at a time. Tests build their own fixtures (`packages/data/test/fixtures.ts`), not seed data. Its env sets a test-only `BETTER_AUTH_SECRET`. No `apps/web` test project yet.
- ❓ Turborepo is still undecided.

### Web framework: React Router v8

- ✅ **React Router 8.5.1** in framework mode, with Vite 8. The user prefers React Router and chose it over Next.js and TanStack Start.
- Why it fits: with a local-first sync engine, most reads come from the local database rather than server loaders. That makes server-centric frameworks less useful, and Next.js is the poorest fit for a static Capacitor bundle.

### Two build targets, one codebase

- ✅ `BUILD_TARGET` (see `apps/web/build-target.ts`) selects one of two targets:
  - **web** (the default): SSR, deployed to Vercel, output in `apps/web/build/web/`.
  - **native**: `ssr: false`, a static SPA with output in `apps/web/build/native/client/` (including `index.html`). This is the bundle Capacitor will ship.
- ✅ Route layout (`apps/web/app/routes.ts`):
  - `/app/*` holds the shared app screens (`app/routes/app/`) and is part of both targets.
  - `/` is the marketing home (`app/routes/marketing/`) and is web only.
  - In the native target, `/` is `app/routes/native-index.tsx`, which redirects to `/app`.
- ✅ **Rule: routes under `/app` never export a server `loader` or `action`.** They load data with `clientLoader`/`clientAction` or hooks, reading from the local sync database and calling the oRPC client for anything server-side. React Router enforces this: the native build fails with "SPA Mode: invalid route export(s)".
- Server loaders and actions are fine in web-only routes such as marketing pages and auth callbacks.
- In SPA mode, `HydrateFallback` may only be exported from `root.tsx`.
- Why: Capacitor runs the client bundle, but it has no server to answer route data requests. Pointing Capacitor at the live URL instead would break offline use and risk App Store rejection under guideline 4.2.

### API: oRPC

- ✅ **oRPC** over tRPC. It has built-in OpenAPI output (useful later for AI tool calls, MCP and third-party integrations), an optional contract-first mode, native file and blob support, streaming, and adapters for fetch, Node and Lambda. Trade-offs: it's younger and has a smaller community than tRPC.
- ✅ The API logic lives in its own package (`packages/api`, `@caretook/api`), with no dependency on any runtime, so it can be mounted in several places:
  - in a React Router **resource route** on Vercel (e.g. `/rpc/*`), called over HTTP by the web and native apps;
  - called **directly on the server** from web-only server loaders, with no HTTP hop;
  - in an **AWS worker** for long-running jobs.
- `/app` routes call the oRPC client from `clientLoader`, so they run the same way on web and native.
- ✅ Built as follows:
  - **Procedures:** `publicProcedure` and `authedProcedure` (`procedures.ts`). The context is `{ authUser }`, resolved by the mount point with `getAuthUser`; procedures never read requests.
  - **Errors:** handlers call services and `unwrap()` the results. `toORPCError` maps an `AppError`'s `statusCode` to an oRPC code (400 `BAD_REQUEST`, 401, 403, 404, 409), with `data: { code, issues? }`. Anything else becomes a generic 500 and is logged, never leaked.
  - **Procedures so far:** `me.get`, `careGroup.listMine`, `careGroup.members` (public profiles only: name, image, role, **no email**), and `timeline.list`/`create`/`update`/`remove`.
  - **Responses:** `dto.ts` turns Postgres timestamps into ISO 8601. Inputs reuse the client-safe Zod schemas from `@caretook/data/schema`.
  - **HTTP:** `createRpcHandler({ prefix, allowedOrigins })` returns a fetch-style `(request, authUser) => Response`. CSRF protection comes from oRPC's `SimpleCsrfProtection` plugins: every call needs `x-csrf-token`, which the client link adds. CORS allows only listed origins (Capacitor's plus `AUTH_TRUSTED_ORIGINS`), and GET is refused.
  - **Mounting:** apps/web mounts it at `/rpc/*` (`routes/rpc.ts`, web only) through `app/.server/api.ts`. The browser client is `app/lib/rpc.ts` (`RouterClient<Router>`, a **type-only** import of the router), which sends cookies.
  - **Tests:** `router.int.test.ts` calls procedures through `createRouterClient` and tests the HTTP handler with real `Request`s (CSRF, CORS, 401 and 404).

### Hosting

- 🟡 A split deployment:
  - **Vercel** handles request/response work: CRUD, auth, the endpoint that receives queued offline writes, and calendar cron jobs and webhooks.
  - **AWS** handles anything long-running: AI jobs (SQS with Lambda or ECS) and the sync service if we self-host it.
- Live audio for appointment notes should connect from the client straight to the AI provider, using a short-lived token, rather than holding a websocket open on Vercel.
- What the split costs us:
  - JWT-based auth that works in both places (not cookie-only sessions), plus CORS setup.
  - Postgres connection pooling for serverless functions.
  - Vercel functions in the same region as the database.

### Data and sync

- 🟡 **PowerSync**, with **Postgres** as the source of truth:
  - Each client keeps a SQLite copy, so reads and writes work fully offline.
  - Queued writes are uploaded through _our_ API, which handles permission checks, validation and auditing.
  - Typed queries through its Drizzle and Kysely integrations, and it has a Capacitor SDK.
- Alternatives we ruled out:
  - Zero: offline writes aren't a first-class feature.
  - ElectricSQL: it only syncs data down to clients, so we'd build the offline write queue ourselves.
  - Convex: weak offline support and lock-in to their database.
  - InstantDB, Triplit and Jazz: less control over the data.
- 🟡 Sharing model: a **care group**, where users sync only the groups they belong to. See _Care groups_.
- 🟡 Conflicts: last write wins per row by default. Timeline entries are mostly append-only.
- ✅ **Drizzle ORM 0.45** (latest stable; 1.0 is still RC) with the `pg` driver, and `drizzle-zod` + **Zod 4** for schemas shared by client and server. Migrations are generated into `packages/data/src/db/migrations/` and applied in-process with drizzle-orm's migrator (`src/db/migrate.ts`). `0000` creates `user`; `0001` the care group tables; `0002` `timeline_entry`. drizzle-kit doesn't always order statements by dependency (in `0002` it emitted a unique constraint after the FK that needs it), so read generated SQL before applying it. **Until the first deploy, it's fine to delete and regenerate migrations** rather than stacking up early ones.
- ✅ **UUID primary keys** on every table (`id()` in `db/schema/columns.ts`). PowerSync clients create rows offline, so ids must be generatable on the client; `create`/`upsert` accept a caller-supplied `id`.
- ✅ Every table spreads `timestamps` (`created_at`, `updated_at`, timestamptz in string mode) and `audits` (`created_by`, `updated_by`, set by the model layer, not FKs).

### Data access layer: `packages/data` (`@caretook/data`)

- ✅ Patterned on the user's cn-time-by-project `app/.server` layout, but in a **package** so `packages/api`, web server loaders and AWS workers can all use it.
- ✅ Layers, bottom up (a generic `Omit<DbInsert<K>, …>` silently drops optional columns such as `id`, so arg types use `WithoutProtected<T>` in `queryHelpers.ts`):
  - `errors/`: **typescript-errors**. Every code lives in `errors/constants.ts`. Errors are **returned, not thrown**; callers narrow with `isError()`. Wrap db calls in `dbMayFail(() => ..., code)` (a thunk, so synchronous throws are caught too).
  - `permissions/`: the RBAC map `PERMISSIONS[schemaName][create|read|update|delete|list][role] = all | owned | none`, plus `ownerField` per table and field-level write restrictions (`fields`). Roles are `admin`, `member` (stored on `user.role`), `system` and `unauthenticated`. Entries can also list **group roles** (`group: [...]`), which grant access through care group membership (see _Care groups_). A resolved scope is `all`, or an OR of rules (`owned`, `group`, `groupUser`). It's client-safe, and `hasPermission()` is for UI checks (group rules use the optional `authUser.groupRoles`).
  - `models/`: data access **with RBAC enforced in SQL**. `baseModel.getFunctions({ schemaName, dbToModel, getWith })` returns `create/get/getById/list/update/remove/upsert`, and every query is ANDed with the actor's permission scope. Group rules become subqueries on `care_group_member`. Creates (and updates that set a scoped field) must land inside the scope, so rows can't be written into, or moved to, a group the actor can't manage. Update and remove refuse an empty filter. Filters are serializable (`{ field: { type: "eq", value } }`) and checked against the table's columns at runtime.
  - `services/`: `getService(model)` with a `ServiceContext = { authUser, tx? }`. Business rules, side effects and multi-model transactions go here. Services never read requests or cookies; the caller (oRPC handler, loader, worker) resolves `authUser`. Use `SYSTEM_USER` for internal work.
- ✅ `withTransaction(fn, { tx })` **rolls back when `fn` returns an AppError**. Without it, a returned (not thrown) error would commit.
- ✅ The DB pool is created lazily on first query (importing never needs `DATABASE_URL`) and kept across HMR by `utils/remember.ts`.
- ✅ Entry points: `@caretook/data` is **server only**. `@caretook/data/schema`, `/errors` and `/permissions` are client-safe. In apps/web, server code imports through `app/.server/data.ts`, so React Router's `.server` guard keeps it out of client bundles. **Never import `@caretook/data` (the root) from client code.**
- Adding a table: write `db/schema/<name>.ts` (table, types, Zod schemas) and export it from `db/schema/index.ts`, add a `PERMISSIONS` entry (the type requires one), add `models/<name>/` and `services/<name>Service.ts`, then register both in their `index.ts`.
- ✅ **Local datastore: Docker Compose** with `postgres:18.7-alpine` and `wal_level=logical` (PowerSync needs logical replication). Dev runs on host port **5434** and test on **5435**, so it can run next to other projects' Postgres on 5432. Data lives in `.postgres/` (gitignored).
- ✅ Env loading: `src/utils/loadEnv.ts` loads `.env.<NODE_ENV>` then `.env` from `packages/data`. It uses Node's `process.loadEnvFile` instead of dotenv-flow, and real environment variables always win. `.env.test` is committed; `.env` is not (copy `.env.example`).
- ✅ Safety: `datastore:clear` refuses any database that isn't on localhost, and `datastore:seed` refuses `NODE_ENV=production`. Seeds use `@example.com` accounts only.
- ❓ Database host, and PowerSync Cloud vs self-hosted.

### Care groups

The shared space care data belongs to: the caretakers looking after one care recipient. "Care group" is the term everywhere (code, DB, UI); "care circle" is retired.

**Decided**

- ✅ Tables:
  - `care_group`: just `name`.
  - `care_group_member`: `group_id`, `user_id` and `role`, unique per (group, user).
  - `care_recipient`: a **profile, not an account**, 1:1 with the group via a unique `group_id`. Drop that constraint to allow several recipients later.
  - `care_group_invite`: email, role, SHA-256 `token_hash`, status `pending | accepted | declined | revoked`, `expires_at` and `accepted_by`. At most one pending invite per (group, email).
  - Deleting a group cascades to members, recipient and invites. Deleting a user cascades to their memberships.
- ✅ Two role systems:
  - **Global roles** (`admin`, `member`, on `user.role`) cover account-level access only.
  - **Group roles** (`constants/roles.ts`) live on the membership row: `owner`, `admin`, `caretaker`, `viewer`.
- ✅ The permission matrix (`permissions.ts`):

  | Table             | read/list                                 | create                             | update                     | delete                            |
  | ----------------- | ----------------------------------------- | ---------------------------------- | -------------------------- | --------------------------------- |
  | care_group        | any member                                | any signed-in user (becomes owner) | owner, admin               | owner                             |
  | care_group_member | any member                                | owner, admin                       | owner, admin (role only)   | owner, admin, or yourself (leave) |
  | care_recipient    | any member                                | owner, admin                       | owner, admin, caretaker    | owner, admin                      |
  | care_group_invite | owner, admin                              | owner, admin                       | owner, admin (status only) | owner, admin                      |
  | user              | self, staff, **co-members** (incl. email) | staff                              | self (no role/email)       | self, staff                       |

  `system` has `all` everywhere. Ids that point at the group (`groupId`, `userId`) can't be changed except by `system`.

- ✅ **Staff get no default access to care data.** Global `admin` grants nothing in a group. A staff member sees a group only through their own membership. Support access, if needed, comes later as an explicit, audited grant.
- ✅ Rules the map can't express live in the services, so **write memberships and invites through the services**, not the models:
  - `careGroupService.create`: makes the creator the first owner (and optionally the recipient) in one transaction.
  - `careGroupMemberService`: only owners add, promote to, demote from or remove owners. A group always keeps at least one owner, and owner rows are locked `FOR UPDATE` while that's checked.
  - `careGroupInviteService.create`: only owners invite owners. It returns the raw token once (7-day expiry). `revoke` withdraws a pending invite.
- ✅ Seeds: "Dev Family", with member@ as owner, caretaker@ as caretaker and viewer@ as viewer. admin@ is deliberately not a member.

**Open questions**

- ❓ Invitations: sending the email, and the accept/decline flow (match the signed-in user's email to the invite, then create the membership as `system`). Comes with Better Auth.
- ❓ Consent: inviting someone shares health data. What does the inviter or recipient confirm, and where is it recorded? Probably a field on the invite, or an audit row, at accept time.
- ❓ Account deletion by a group's last owner: today the cascade leaves the group without an owner. Block deletion until ownership is handed over, delete their sole-owner groups, or promote someone automatically?
- 🟡 Membership removal: the next sync drops that group's buckets from the device (Sync Streams). Not yet tested end to end; a device that stays offline keeps its copy until it reconnects.
- 🟡 Co-members can read each other's full user row in the data layer, including `role` and `emailVerified`. The API exposes only public profiles (`careGroup.members`: name, image, role), so keep it that way for any new procedure.

### Shared timeline (iteration 1, done)

The first full vertical slice: a seeded user signs in, picks one of their care groups, then can add, edit, delete and view timeline entries on the web target. It's online only (oRPC from `clientLoader`/`clientAction`). PowerSync comes next, so the API reuses the same services its upload endpoint will call.

- ✅ One `timeline_entry` table with a `kind` column:
  - `group_id` is stored directly on the row, because PowerSync streams filter on columns of the synced row. `recipient_id` is stored too, ready for several recipients per group.
  - `occurred_at` (when it happened, as opposed to `created_at`, the upload time) plus the device's IANA `time_zone`.
  - `title` (optional) and `body`, with kind-specific fields in a `details` jsonb validated by a Zod discriminated union.
  - Index on `(group_id, occurred_at desc, id)`.
- ✅ Kinds in iteration 1: `note | symptom | event`. Iteration 2 added `vital`; see _Entry kinds: what goes where_. **No appointments yet.**
- ✅ Permissions: read/list for any member; create, update and delete for `owner`, `admin` and `caretaker` (any writer may edit any entry). "Only the author or managers edit" may come later as a per-group option. `groupId`, `recipientId` and `kind` are `system`-only on update.
- ✅ **Soft delete** (`deleted_at`): the service's `remove` sets it, checked against the **delete** permission, and `list` hides deleted rows. Group or account deletion still hard-deletes through the cascade.
- ✅ Keyset pagination on `(occurred_at, id)`, not offset: offline devices insert older entries.
- ✅ **Phase 1 is built** (`db/schema/timelineEntry.ts`, `models/timelineEntry/`, `services/timelineEntryService.ts`, seeds, `timelineEntry.int.test.ts`). Details settled while building it:
  - A composite FK `(group_id, recipient_id) → care_recipient(group_id, id)` makes the database guarantee an entry's recipient is in its group. It's `NO ACTION`: deleting a recipient fails while entries exist, but deleting the group still cascades.
  - `create` defaults `recipientId` to the group's recipient. It checks the group first (as the actor), so non-members get `unauthorized` and learn nothing about the group.
  - The Zod schemas live in the schema file and are client-safe: `timelineEntryContentZSchema` (a union on `kind`), `timelineEntryCreateZSchema`, and `timelineEntryUpdateZSchema` (strict, content only). `update` validates the **merged** row, so a note can't lose its body.
  - Model: `get`/`getById`/`listPage` hide soft-deleted rows unless `includeDeleted` is set; `update` refuses deleted rows; `remove` is the soft delete; `purge` (hard delete) is system only. `listPage` returns `{ data, nextCursor }` with an opaque base64url cursor. There's no unvalidated `upsert`: the PowerSync upload endpoint will need one that goes through the service's validation.
  - `occurredAt` is read back as Postgres text (`2026-11-17 10:00:00.000+00`), not ISO. Normalise it at the API layer if clients need ISO.
- ✅ Phases:
  1. ✅ Timeline data layer (schema, permissions, model, service, seeds, independent integration tests).
  2. ✅ Auth (`packages/auth`, Better Auth 1.7.25, pinned exactly). See _Auth_ below.
  3. ✅ API (`packages/api`, oRPC 1.16.2). See _API: oRPC_.
  4. ✅ Screens (all shared and client-only):
     - `/sign-in`.
     - `/app`: your groups, which redirects straight to the timeline when there's only one. A user with no group sees an empty state.
     - `/app/groups/:groupId/timeline`:
       - the recipient's name, then entries grouped by the viewer's calendar day, with "Show older entries" (keyset cursor);
       - times in the viewer's zone, plus the entry's own zone when it differs ("11:27 AM in Los Angeles");
       - authors' names from `careGroup.members`.
     - Writers get the add form (note, symptom or event; React Aria `DateField` for "When"), and a ⋯ menu per entry (React Aria `Menu`) with Edit (inline form) and Delete (native `<dialog>` confirm). Viewers get the timeline only.
     - Mutations go through the route's `clientAction` (`intent` = create, update or remove), then React Router revalidates. Field errors map API issue paths to plain-language messages.
     - `/app` has its own `ErrorBoundary` (Not found, or Something went wrong). It keeps the frame, and avoids React's "script tag" warning that the root boundary triggers when it replaces the whole page in the browser.
     - Verified in headless Chrome at phone width (19 checks: add, validate, edit, delete, viewer read-only, someone else's group is a 404, staff empty state, no console errors) and by screenshots.
- Out of scope: sign-up and create-group UI, invite accept and consent, email verification and reset, PowerSync, appointments, attachments, Playwright, deploy.
- ✅ Sign-in: **email + password** in iteration 1, so no email provider is needed yet. Better Auth's `emailAndPassword` hashes passwords into `account`. Seeds create password accounts for the `@example.com` dev users (a shared dev password from `.env`, hashed with Better Auth's own hasher). The seeds also hold the only care group (Dev Family), so there's no sign-up or create-group UI in this iteration; both come with Resend and invites.
- 🟡 **Resend** is coming in a near-term follow-up iteration. It brings email verification, password reset, invite emails, and possibly magic link or email OTP. Keep that path cheap:
  - All outgoing email goes through `packages/notifications` (see _Notifications_), never through Better Auth callbacks calling a provider directly.
  - Leave `requireEmailVerification` off until Resend lands, and don't build UI that assumes passwords are the only sign-in method.

### Timeline iteration 2 (in progress, before Resend)

The user chose to do this feature work before the Resend iteration. There are four phases, in order. **All four phases are done** (phases 3 and 4 are uncommitted until the user asks). New dependencies still need the user's approval as each phase starts.

#### Entry kinds: what goes where

Every timeline entry is one of four kinds. When someone proposes a new type of thing to log, place it with these definitions before writing code.

- ✅ **Note:** free text about the day ("Ate most of lunch"). A body is required. A live document can be attached to a note or an event (phase 4); the note itself stays plain text.
- ✅ **Symptom:** something the care recipient **feels or reports**, or a problem a caretaker describes in words: pain, nausea, dizziness, fatigue, confusion, low mood.
  - A free-text `name`, plus an optional `severity` from 0 to 10.
  - **Pain is a symptom** ("Knee pain", severity 4), never a vital. That's why it was removed from vitals.
  - Suggested names (from the group's history) are a later UX addition.
- ✅ **Vital:** something **measured, counted or observed**, with a fixed type and a unit or scale. It covers the classic vital signs and also body output and routine.
  - Typed values, stored in canonical units, which later makes them chartable.
  - The 10 types: blood pressure, heart rate, temperature, SpO₂, breathing rate, weight, blood sugar, bowel movement (Bristol scale), urine output, sleep (hours).
- ✅ **Event:** something that happened: a visit, a fall, a pharmacy pickup. A title is required. Appointments (with time, place and provider) come later as a richer kind.
- **Rule of thumb: if you measure or count it, it's a vital. If they feel it, or it's a problem described in words, it's a symptom.** A new vital must have a fixed unit or an agreed scale. Without one (mood, confusion), it's a symptom.
- Gray areas settled: pain → symptom; bowel movement and urine output → vital (observed output); sleep → vital (hours slept).

#### Phases

1. ✅ **Vital signs** (built 2026-11-17; no new dependencies; migration `0004`):
   - The `vital` kind. `details` = `{ readings: [...] }`, at most one reading per type, as a Zod discriminated union on `type`. The types are:
     - `bloodPressure`: systolic and diastolic, and diastolic must be lower;
     - `heartRate`, `temperature`, `spo2`, `respiratoryRate`, `weight`, `bloodGlucose`;
     - `bowelMovement`: Bristol type 1–7, optional;
     - `urineOutput`: volume, optional;
     - `sleep`: hours, in 0.25 steps.
     - `painScore` existed briefly and was removed (pain is a symptom).
   - **One spec drives everything:** `db/schema/vitals.ts`. `VITALS` holds the labels, fields, hard limits and typical ranges, and the Zod schemas, form fields, error messages and card text all come from it. Adding a type means a `VITAL_TYPES` entry, a `VITALS` entry and one `reading(...)` line. Any new field `key` also goes in `VitalFieldSpec["key"]`.
   - **Units:**
     - Values are stored in **one canonical unit per measure** (°C, kg, mg/dL, mL) at full precision.
     - Display and entry follow the **per-user unit setting**: `user.preferences` (jsonb, default `{}`), validated by `userPreferencesZSchema` and read through `resolveUnits()`. Defaults: °F, lb, mg/dL, mL.
     - The form converts typed values with `fromDisplay`, and the card converts for display with `toDisplay` and `formatReading`.
     - The form posts the units it displayed (a hidden `units` field), so the clientAction converts back with the same units.
     - `user.preferences` is the place for future per-user settings (e.g. time zone). Every field is optional, so new settings need no migration.
   - **API:** `me.get` returns `preferences` and the resolved `units`; `me.updatePreferences` merges into your own preferences. The `/app/settings` screen (Units) is linked from the header.
   - **Validation:**
     - Hard limits reject impossible values, with a message naming the range in the user's units.
     - A value outside the typical range gets the warning "That's unusual. Double-check it", but still saves.
     - The typical ranges are adult guesses, easy to tune in `VITALS`.
   - **UI:**
     - A **Vitals ▾** menu in the kind picker (`VitalTypeMenu`, a RAC `MenuTrigger`). The user asked for a "submenu"; a single dropdown was chosen as better on phones.
     - "+ Add a reading" uses the same menu, leaving out types already added. Each reading can be removed.
     - The fields are in `VitalReadingsFields`. Cards show one compact line ("BP 128/82 mmHg · HR 71 bpm").
   - **Forward compatibility:** `isKnownReading()` filters out reading types this build doesn't know, so screens skip them instead of crashing. This matters once PowerSync syncs rows from newer or older app versions.
   - **Storage:** jsonb rather than a child table. Groups hold thousands of entries, and charts can read local SQLite (`json_extract`) after PowerSync.
   - **Tests:**
     - `vitals.test.ts`: conversion round trips, limits, formatting;
     - vitals in `timelineEntry.int.test.ts`;
     - preferences in `router.int.test.ts`;
     - a headless Chrome run (see _Browser checks_ below).
   - **Seeds:** see _Dev seed data_ under phase 2.
   - Out of scope: alert thresholds, per-recipient baselines, charts.

2. ✅ **Timeline layout and scanning** (built 2026-11-17; added `lucide-react` 1.73.0, pinned exactly; no migration). The user picked these from ASCII mockups:
   - **Two layouts, switchable per user:** dense **rows** (the default) or compact **cards**. It's stored as `user.preferences.timelineView` (`rows | cards`, read through `resolveTimelineView()`), returned by `me.get` and saved with `me.updatePreferences`. The ViewToggle sits in the page header; switching is instant and the save is best effort.
     - Rows (`TimelineEntryRow`): one panel per day, with dividers between rows. Each row has the kind icon, the time, the summary, the author's initials and the ⋯ menu. Long text is clamped to 2 lines, with More/Less (measured, so the toggle only shows when text overflows). About 9–11 entries fit on a 420×900 screen; before, it was 7, and they started below the fold.
     - Cards (`TimelineEntryCard`): summary and time on one line, then the full text, then the author (and the entry's time zone).
     - Both views render from `entrySummary()` (`lib/entryDisplay.ts`) and take entries as props, so they carry over to PowerSync unchanged.
   - **Kind icons and colors** (`KIND_META`): note `NotebookPen` (neutral), symptom `Bandage` (warning), event `CalendarCheck` (info), vitals `HeartPulse` (secondary, pink). **Not green**, because green reads as "all good". The icon is decorative; the kind is also given as sr-only text.
   - **Quick-add bar + sheet:** four tiles (Note, Symptom, Event, Vitals ▾). Each opens `EntrySheet` (RAC `ModalOverlay`/`Modal`/`Dialog`: a bottom sheet on phones, a centered dialog from `sm`) with `EntryForm` preset to that kind (`initialKind`/`initialVitalType`). **Edit uses the same sheet**, not an inline form. The form remounts on each open, so "When" defaults to the current time. There's one `ConfirmDialog` and one remove fetcher for the whole list (in the route).
   - **Sticky day headers.**
   - **Kind filter chips:** links that set `?kind=note|symptom|event|vital`. The clientLoader passes `kinds` to `timeline.list` (on the server, so "Show older" pages are filtered too).
   - **Latest vitals strip:** the new `timeline.latestVitals({ groupId })` → `timelineEntryService.latestVitals` → `timelineEntryModel.latestReadings`. That's one RBAC-scoped SQL query (`DISTINCT ON` over `jsonb_array_elements(details->'readings')`, skipping soft-deleted entries). It returns the newest reading per type, sorted most recent first; phones show 4 plus "+N more". After PowerSync, this becomes a local `json_each` query.
   - The time zone note ("11:27 AM in Los Angeles") is **kept** in both views (the user didn't choose to quiet it): a small line under the row, or after the author on a card.
   - Verified in headless Chrome (21 checks: above the fold, density, sticky header, no horizontal scroll, add/validate/edit/delete through the sheet, the Vitals menu, Esc, clamping, filter, the view surviving a reload, viewer read-only, no console errors), plus screenshots at 420 and 1280 in light and dark.
   - **Dev seed data** (`seeds/timelineEntries.ts`): Grandma Pat in Dev Family has about 180 entries over eight weeks, so layout and paging can be judged with realistic volume and lengths.
     - The story: knee arthritis and PT, dizziness on standing (a BP dose change), late-afternoon confusion, hiring an aide (Maria), an OT home safety visit, a urine infection that showed up as sudden confusion (urgent care → ER, logged hour by hour), respite research, pharmacy and insurance admin. Two long notes (a phone-call rundown and a full doctor's visit) test clamping and long cards.
     - **All seed data is fictional.** Never put real people's health information in the repo, even anonymized: in this session the user decided against seeding an anonymized real family timeline.
     - `SEED_ENTRIES = [...ENTRIES, ...MORE_ENTRIES, ...routineVitals()]`. An entry is placed either `hoursAgo` (relative to seeding time) or `at: { daysAgo, time: "HH:MM" }` (a local time in `America/Los_Angeles`), so times written in the text match the timestamp.
     - `routineVitals()` generates daily sleep, bowel movements, morning BP every 3 days and a weekly weight from a fixed pseudo-random sequence, so every seed gives the same values.
     - Ids follow position in `SEED_ENTRIES` and inserts skip existing ids. **Adding to `ENTRIES` or `MORE_ENTRIES` shifts the ids of everything after it**, so run `pnpm datastore:reset` afterwards (changing an existing entry also needs a reset).
     - `seeds/timelineEntries.test.ts` (in `data:unit`) checks every seed entry against `timelineEntryContentZSchema`, because seeds insert straight into the table without the service's validation.

3. ✅ **PowerSync round trip** (built 2026-11-17; migration `0005`). Moved ahead of Resend because collaborative notes need it.
   - **Decisions (the user's):**
     - PowerSync Cloud in production, the self-hosted service in Docker locally.
     - The Drizzle driver.
     - The upload endpoint is an oRPC procedure.
     - `me` settings are cached on the device, not synced.
     - No latency spike first.
   - **Dependencies:** `@powersync/web` 2.7.0, `@powersync/drizzle-driver` 0.8.0, `@journeyapps/wa-sqlite` 2.0.10 and `drizzle-orm` (apps/web). Docker image `journeyapps/powersync-service:1.28.3`.
   - **Sync Streams, not Sync Rules** (Sync Rules are deprecated). `powersync/sync-config.yaml` (`config: edition: 3`) defines two streams:
     - `care_groups`: one bucket per group the user belongs to. It carries `care_group`, `care_group_member`, `care_recipient` (name and preferred name only) and every `timeline_entry` column, including soft-deleted rows.
     - `member_profiles`: co-members' `id`, `name` and `image`.
     - The service reads the file only at startup: run `docker compose restart powersync` after changing it.
   - **Publication** (migration `0005`): `CREATE PUBLICATION powersync` covers the care tables plus `"user" (id, name, image)`. That column list keeps emails, roles and preferences out of replication entirely. A new synced table needs `ALTER PUBLICATION powersync ADD TABLE …` in a migration. `datastore:clear` drops the publication. After `datastore:reset`, PowerSync re-snapshots on its own. Expect one 401 in the browser as it refetches the new JWKS (the reset regenerates Better Auth's keys).
   - **Local infra** (`docker-compose.yml`):
     - `powersync` on :8080, with bucket storage in its own `powersync-storage` Postgres (`.postgres/powersync-storage`), so clearing the app database never touches it.
     - It fetches Better Auth's JWKS from `PS_JWKS_URL` (default `http://host.docker.internal:5173/api/auth/jwks`). Docker Desktop forwards that only to the host's **IPv4** loopback, so `vite.config.ts` binds `127.0.0.1` and allows the `host.docker.internal` Host header. On another port, set `PS_JWKS_URL`.
     - `service.yaml` turns telemetry off.
   - **Auth:** Better Auth signs JWTs with `aud` = `POWERSYNC_URL`, which on Cloud must be the instance URL. The client connects to `VITE_POWERSYNC_URL`; both are in `apps/web/.env`. `fetchCredentials` calls `/api/auth/token`. On a 401 it returns null and the device stays local-only; any other failure is retried.
   - **Upload** (`packages/api/src/sync.ts`, `sync.upload`): takes up to 100 CRUD ops, in order, and maps them onto the **services**:
     - `PUT` → `timelineEntryService.upsert`, idempotent on the client's id. A replay is harmless, a deleted entry stays deleted, a changed group, kind or recipient → `timelineEntryService:immutable`, and an id taken in a group the actor can't see → `unauthorized`.
     - `PATCH` → `update`, or `remove` when it sets `deleted_at`.
     - `DELETE` → `remove`.
     - Other tables → `sync:readOnlyTable`.
     - 4xx outcomes are acknowledged as `rejected` (logged on the client), and the next sync restores the server's copy. Anything else throws, so the batch retries.
   - **Timestamp format:** PowerSync syncs timestamptz as `2026-11-17T21:45:25.229000Z` (ISO with microseconds; its docs show a space). Local writes use exactly that text (`toLocalTimestamp`), so rows sort correctly as strings. `fromLocalTimestamp` parses either form.
   - **Client** (`apps/web/app/lib/sync/`):
     - `schema.ts`: Drizzle sqlite tables, turned into the PowerSync schema with `DrizzleAppSchema`.
     - `client.ts`: the database (`caretook.sqlite`) and connector, loaded lazily (never imported statically).
       - The device holds one user's data at a time: the owner is kept in localStorage, and the file is wiped when someone else opens it.
       - Sign-out runs `disconnectAndClear`, then **deletes the IndexedDB/OPFS file**, because SQLite keeps freed pages. The delete completes once PowerSync's shared worker lets go (by the next reload).
     - `index.ts`: `openSync`, `getSync`, `closeSync`, `waitForFirstSync` (10 s cap), `useLiveQuery` (a watched SQL query; new loader data resets it), and `useSyncState`. Dev builds expose `window.caretookSync`.
     - `timeline.ts`: the queries (entries with keyset-free `LIMIT n+1` paging, groups, members, latest vitals via `json_each`), row → API-shape mapping (rows of unknown kinds are skipped), and local create/update/remove. Writes validate with the same Zod schemas and check the role locally; only content columns are ever updated.
   - **Routes:**
     - `lib/session.ts` `requireSession(request)`: one shared session check plus DB open, because React Router runs layout and child loaders in parallel. Offline, the last signed-in user (cached) carries on.
     - The home and timeline loaders read local data. Components use live queries, so other members' changes appear without reloading.
     - The timeline's `shouldRevalidate` skips form submissions. "Show older" grows the query's limit.
     - `lib/me.ts` caches settings per user. `components/SyncIndicator.tsx` shows Offline or Syncing… in the header.
   - **Verified** (headless Chrome, `scripts/browser-checks/`):
     - `roundtrip.mjs` (21 checks): two members see an add, edit or delete in about 0.4–0.8 s locally; audit fields in Postgres; a local validation error; viewer read-only; sign-out.
     - The offline check: browser A goes through a switchable proxy (`proxy.mjs`), since CDP network emulation doesn't cut PowerSync's open stream. An entry written offline shows locally, isn't on the server or the other device, and arrives about 1.8 s after reconnecting.
     - `phase2.mjs` (15 checks): the phase 2 layout checks against local data.
     - `signout-wipe.mjs`: the local file is gone after sign-out and a reload.
   - Not done or open:
     - ❓ **Production:** a dedicated replication role with column-limited grants, `sslmode: verify-full`, the Cloud instance setup, and how PowerSync Cloud reaches the JWKS.
     - The old oRPC reads (`timeline.list`, `latestVitals`, `careGroup.listMine`, `members`) stay for API, AI and worker use, but no screen uses them now.
     - Settings (`/app/settings`) still loads and saves online only.
     - **Offline web reload** needs a service worker (not built). Offline works within a loaded session, and will in Capacitor.
     - Removal from a group: the next sync drops that group's buckets from the device. Not yet tested end to end.

4. ✅ **Collaborative notes ("live notes")** (built 2026-11-17; migration `0006`). Several people edit the same document at once, offline included, and viewers watch it live.
   - **Dependencies (approved):** apps/web gets `yjs` 13.6.33, `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` and `@tiptap/extension-collaboration` (all 3.34.0), `@tiptap/y-tiptap` 3.3.0 and `y-protocols` 1.0.7 (the last four are Tiptap's peer dependencies). packages/data gets `yjs` 13.6.33, for compaction and plain text. All pinned exactly.
   - ✅ **A live document is something you add to an entry** (the user's decision):
     - Only **event** and **note** entries can have one (`NOTE_DOCUMENT_KINDS`); symptoms and vitals can't.
     - It's created on demand: "Add live notes" in the entry's ⋯ menu (writers).
     - The entry keeps its own `title`/`body`. Rows and cards show a two-line preview plus an "Open live notes" link, for viewers too.
   - **A document's id is its entry's id.** That makes "one per entry" true by construction. And when two devices both add live notes to an entry offline, they create the same row and their edits merge, instead of one being refused.
   - **Tables** (`db/schema/noteDocument.ts`):
     - `note_document`: `id` (= the entry's), `group_id`, `snapshot` (compacted Yjs state, base64, null until the first compaction) and `text` (derived plain text). A composite FK `(group_id, id) → timeline_entry(group_id, id)` cascades, which needed a new unique `(group_id, id)` on `timeline_entry`. drizzle-kit emitted that unique **after** the FK again; it was moved by hand.
     - `note_update`: append-only Yjs updates (base64 `data`, at most 1,000,000 chars), with a composite FK to `note_document(group_id, id)`, indexed on `(document_id, created_at)`.
     - Both are in the `powersync` publication (migration `0006`).
   - **Yjs helpers** (`db/schema/noteYjs.ts`, client-safe, shared by server and device): base64 conversion, `isYjsUpdate` (validates by applying to an empty doc), `buildNoteDoc(snapshot, updates)`, `encodeNoteDoc`, and `noteText` (one line per paragraph or heading, `• ` for list items). The Tiptap content lives in the fragment `NOTE_FRAGMENT = "default"`.
   - **Permissions:** read/list for any member. `note_document` create for writers, with `snapshot`/`text` system-only. `note_update` create for writers. Update and delete on both are **system only**: devices only ever insert.
   - **Service** (`noteDocumentService`; write through it, not the models):
     - `create`: the entry must be live, a note or event, and in the given group. It's idempotent, returning the existing document.
     - `appendUpdate`: the document must be visible and its entry not deleted. It's idempotent on the update's id.
     - `getById` hides a deleted entry's document. `currentText` includes updates not yet compacted (for AI and workers).
     - `compact(documentId)`, run as the system: it locks the document row `FOR UPDATE`, applies the snapshot plus every pending update, writes the new snapshot and text, and deletes those updates.
     - `compactIfDue`: compacts at 20 pending updates, or once the oldest has waited 60 s.
   - **Sync:**
     - Both tables are in the `care_groups` stream (the user's choice over an on-demand stream), so any document opens and edits offline, even one never opened before.
     - `sync.upload` maps a `note_document` PUT to `create` and a `note_update` PUT to `appendUpdate`. Any PATCH or DELETE on either table is refused with `sync:readOnlyTable`.
     - After each batch, the documents it touched are compacted when due (best effort: a failure is logged and the next upload retries).
     - Leftover updates (typing that stops below the threshold) stay pending until the next edit. Device previews rebuild the text locally, so they're fresh anyway. A cron sweep for stale pending updates is not built.
   - **Device** (`lib/sync/notes.ts`):
     - `createNoteDoc(initial)` builds a Y.Doc from what the loader read, so the editor opens with the text.
     - `bindNoteDoc(doc, …)` watches `note_document.snapshot` and `note_update` rows and applies them (applying twice is harmless). Local changes are merged per burst of typing (written 250 ms after the last keystroke, at least every 1 s) into one `note_update` row. A viewer's changes are never written.
     - It's split into create and bind so React StrictMode's double effects can't destroy a doc that's still in use.
     - `ensureNoteDocument` checks the kind and role locally. `groupDocumentsQuery` + `toPreviews` feed the timeline's previews.
   - **Screen:** `/app/groups/:groupId/entries/:entryId/notes` (`routes/app/entry-notes.tsx`, shared and client-only).
     - `LiveNotesEditor`: Tiptap with StarterKit (`undoRedo: false`, since Collaboration brings Yjs-aware undo; `link: false`) and a small toolbar (bold, italic, heading, bulleted and numbered lists). It's read-only for viewers.
     - A non-member, a missing entry, or a symptom or vital is a 404. A writer on an entry without a document sees "Start live notes". If the entry is deleted while it's open, the page says so.
     - The editor chunk is 140 KB gzipped and loads only on this route. Base styles are `.live-notes` in `app.css` (no typography plugin).
   - **Vite** (`vite.config.ts`): `optimizeDeps.include` pre-bundles yjs and the Tiptap packages in one pass, and `resolve.dedupe` keeps one yjs, React and ProseMirror. Without that, the browser loaded two yjs copies ("Yjs was already imported") and a mid-session re-optimize broke React hooks.
   - **DB client fix:** `getDb()` used to keep the whole drizzle instance across HMR, including the schema it was built with. A running dev server then 500'd on any new table (`db.query.<new>` was undefined). Now only the **pool** is remembered, and the drizzle wrapper is rebuilt when the module reloads.
   - **Live latency, measured:** a caretaker sees another's typing in **0.5–0.8 s** (median about 0.65 s over three runs) through local PowerSync. Offline edits arrive about 2.5–3 s after reconnecting. That's usable for appointment notes. There are **no presence or cursors**. ❓ Whether to add a websocket relay (e.g. Hocuspocus on AWS) for presence and lower latency: decide after real use, or once PowerSync Cloud latency is measured.
   - **Tests:** `noteYjs.test.ts` (unit: base64, validation, text, merge order and replay), `noteDocument.int.test.ts` (13: roles, kinds, idempotency, deleted entries, forged fields, compaction, cascade), and `sync.upload` live-document cases in `router.int.test.ts`. `test/fixtures.ts` has `typeParagraph(doc, text)` and `newYDoc()`.
   - **Browser check:** `live-notes.mjs` (18 checks, three browsers): add from the menu, viewer read-only, latency, concurrent edits converging, authorship in Postgres, offline then reconnect, a heading syncing, timeline previews for the viewer, no live notes on a symptom, and deleting the entry while it's open.
   - Not done: presence and cursors, a compaction cron sweep, a size cap on snapshots, an oRPC read for documents (only `currentText` in the service), search over `text`.

#### Browser checks

UI work is verified in headless Chrome over CDP, with a plain Node script (no Playwright yet). The pattern:

- Launch Chrome with `--headless=new --remote-debugging-port`, at a 420×900 window.
- Sign in as the `@example.com` seed users (password: `SEED_USER_PASSWORD`).
- Drive the page with `Runtime.evaluate`.
  - React Aria buttons and menu items need a `pointerdown` before `.click()`.
  - Set inputs through the native value setter, then dispatch an `input` event.
- Collect console errors and take screenshots.

The scripts live in `scripts/browser-checks/` (run them from that folder with Node 24 against the dev server; `BASE` defaults to `http://localhost:5176`). Add one per check, or replace them with Playwright when the user approves it.

- Run them with Node 24 (`~/.nvm/versions/node/v24.22.3/bin/node`, or `nvm use` first). They use the global `WebSocket`, which the machine's default Node 20 doesn't have.
- The phase 2 check (21 steps) covered: first entry above the fold at 420px; enough rows on the first screen; a sticky day header; no horizontal scroll; add, validate, edit and delete through the sheet; the Vitals menu; Esc closes the sheet; long-text clamping and More; the Symptoms filter; the view choice surviving a reload; a viewer seeing no add bar or menus; no console errors or warnings. Repeat it after any timeline change.
- The checks create and delete entries as member@ (deletes are soft), so run `pnpm datastore:reset` afterwards for clean dev data.
- After `pnpm build:native`, `pnpm lint` can report `no-unsafe-argument` errors in `routes/rpc.ts` and `routes/api/auth.ts`: the native typegen overwrote the web route types. Run `pnpm typecheck` to regenerate them.

Port 5173 may already be in use. Better Auth only trusts `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS`, so on another port start the dev server as `BETTER_AUTH_URL=http://localhost:5176 AUTH_TRUSTED_ORIGINS=http://localhost:5176 pnpm --filter @caretook/web dev --port 5176 --strictPort`. Real env vars win over `.env`.

### Auth (`packages/auth`, `@caretook/auth`)

- ✅ **Better Auth 1.7.25** with its drizzle adapter, over our own tables:
  - it adopts the existing `user` table;
  - `session`, `account`, `verification` and `jwks` are in `packages/data/src/db/schema/auth.ts` (migration `0003`).
- ✅ The auth tables are exceptions to the table conventions:
  - **no `audits`**, because Better Auth writes them, not our models;
  - **date-mode timestamps**, because Better Auth compares them with `Date` objects, and string mode would silently break session expiry;
  - `PERMISSIONS` gives them to `system` only.
- ✅ Ids: `generateId: "uuid"` lets Postgres's `gen_random_uuid()` default fill them.
- ✅ Extra user fields, declared as `user.additionalFields` with `input: false`, so requests can't set them:
  - `role`;
  - `createdBy`/`updatedBy`, defaulting to `SYSTEM_USER` (the auth flow creates accounts as the system).
- ✅ Settings:
  - `emailAndPassword` with `disableSignUp: true` and a 12-character minimum;
  - telemetry explicitly off;
  - `trustedOrigins` holds Capacitor's origins plus `AUTH_TRUSTED_ORIGINS`.
- ✅ Plugins:
  - `bearer()`, for the native app;
  - `jwt()`: 15-minute EdDSA tokens with `sub` and `role`, keys at `/api/auth/jwks`, and the private key encrypted with the secret. This is for PowerSync and workers later.
- ✅ Entry points:
  - `@caretook/auth` (server only): `getAuth()` (lazy, like the db) and `getAuthUser(headers)`. The latter turns a cookie or bearer session into `AuthUser`, with `groupRoles` loaded from memberships as `system`.
  - `@caretook/auth/client`: `createCaretookAuthClient(baseURL?)`, built on `better-auth/client` (no React dependency).
  - In apps/web, server code imports through `app/.server/auth.ts`, and browser code through `app/lib/auth-client.ts`.
- ✅ Routes:
  - `/api/auth/*` is a web-only resource route (the native app calls the deployed server's copy).
  - `/sign-in` and `/sign-out` are **shared and client-only**, because the native app needs them too; sign-out is POST only.
  - `/app/layout.tsx` checks the session in `clientLoader` and redirects to `/sign-in?redirectTo=…` (checked by `safeRedirect`: same-site paths only).
  - On the web, `/app` server-renders an empty shell, and the browser then loads the session.
- ✅ Env:
  - `apps/web/.env` (copy `.env.example`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_TRUSTED_ORIGINS` and `VITE_API_ORIGIN` (native only).
  - `vite.config.ts` loads it, then `packages/data/.env` (for `DATABASE_URL`), into `process.env`.
- ✅ Dev sign-in: `pnpm datastore:seed` gives every `@example.com` user a password account using `SEED_USER_PASSWORD` from `packages/data/.env`. It's hashed with `better-auth/crypto`, a **dev dependency** of `packages/data` used only by the seeds. Without that variable, the accounts are skipped with a warning.
- Verified in a real browser (headless Chrome):
  - `/app` redirects to sign-in, and a wrong password shows one generic message;
  - signing in lands on `/app`, and `/sign-in` bounces a signed-in user back;
  - sign-out ends the session.

  Also verified: cross-site origins get a 403, and sign-up is refused.

- ❓ Open questions:
  - **Rate limiting** uses Better Auth's in-memory default, which is per instance on serverless. Move it to database or Redis storage before launch.
  - **Native:** bearer token storage in Capacitor (secure storage), and pointing the client at `VITE_API_ORIGIN`.
  - **Deleting an account** cascades to its sessions and accounts. A sole owner's group is still left ownerless (see _Care groups_).

### Notifications (Resend iteration, planned)

The design starts from the user's cn-time-by-project `app/.server/notifications` system (a registry of named notifications, React Email templates, a shared wrapper, batch sends for cron digests, services deciding recipients) and fixes its known gaps. Nothing is built yet: iteration 1 sends no email.

**Design**

- 🟡 A server-only `packages/notifications`, usable from `packages/api`, Better Auth callbacks and the AWS worker.
- 🟡 **A typed registry:** `defineNotification({ name, data: zodSchema, email: (data, { recipient }) => ({ subject, react }), push? })`, collected in `NOTIFICATIONS = { … } as const`.
  - `notify(name, { to, actor?, data })` infers `data` from `name`. Never type the registry as `Record<string, …>`: that makes every string a valid name and loses the link between name and data.
  - Recipient, actor and data are separate fields; never one `user` meaning both.
  - Data is validated before rendering. Templates never throw on the wrong shape.
- 🟡 **One function per channel** (`email`, later `push`), not one React tree wrapped per channel, because push can't render React.
- 🟡 **Templates get plain data plus a configured `APP_URL`.** Never build links from the request's Host header (a spoofed header makes emailed links point elsewhere: password-reset poisoning), and never read `formData`. Always send a plain-text version, generated by React Email's `render(…, { plainText: true })`, never `text: ''`.
- 🟡 **A pluggable sender**, chosen by environment: `resend` (production), `log` (dev: prints the email and a preview), `memory` (tests capture what would be sent).
  - A failed send returns an `AppError`. Resend's SDK returns `{ data, error }` rather than throwing, so check `error` explicitly.
  - Production refuses to start without `RESEND_API_KEY`; never return `null` and carry on.
  - Outside production, only allowlisted recipients get real email, so `@example.com` seeds never reach Resend.
- 🟡 **An outbox for anything beyond auth emails.** A `notification_outbox` row is written in the same `withTransaction` as the change that caused it. Columns:
  - `name`, recipient, `data`;
  - a unique `idempotency_key` (e.g. `careGroup:invite:<inviteId>`), which is also passed to Resend;
  - status `queued | sent | failed | suppressed`, `attempts`, `send_after`, provider message id, error, `sent_at`.

  Delivery happens right after the response via Vercel's `waitUntil`, plus a cron sweep (checking `CRON_SECRET`) that retries with backoff. That cron is idempotent and sends batches of at most 100 (Resend's limit). The AWS worker takes over later. Purge sent rows after a few days.

- 🟡 **Previews:** the `react-email` dev server, and one snapshot test per template rendered with sample data.
- Current versions: `resend` 6.x, `@react-email/components` 1.x, `react-email` 6.x. Dependencies are still to be approved when the iteration starts.

**Caveats for a health app**

- 🟡 **No health details in subjects or bodies.** Default to content-free alerts ("New update in Dev Family's timeline") with a link that requires signing in. Any content in email is opt-in per person, with consent recorded (see _Compliance_).
- 🟡 **Turn off Resend open and click tracking.** The pixel is third-party analytics, and click tracking routes invite and reset tokens through Resend's redirect servers.
- 🟡 **Tokens:** single-use and short-lived, stored only as a hash. Never put a raw token in outbox `data`; generate the link at send time or encrypt it.
- 🟡 **Better Auth `sendResetPassword` / `sendVerificationEmail`:** don't wait on the send, because response timing would reveal whether an email has an account. But never just leave the promise running on Vercel, which can cut it off after the response; use `waitUntil` or the outbox.
- 🟡 **Bounces and complaints:** verify Resend webhooks (Svix signatures) and mark the address undeliverable.
- 🟡 **Domain setup:** send from a subdomain (e.g. `mail.caretook.com`) with SPF, DKIM and DMARC, so email problems don't affect the main domain.
- 🟡 **Recipient preferences:**
  - Account emails (reset, verification, invites) always send.
  - Optional ones (digests) need per-group preferences and one-click unsubscribe (`List-Unsubscribe` and `List-Unsubscribe-Post`, which Gmail and Yahoo require from bulk senders).
- 🟡 **Times in the recipient's time zone,** which needs a time-zone field on the user's profile.

**Order**

1. Resend iteration:
   1. Registry and sender interface, with all three senders.
   2. Better Auth password reset and email verification.
   3. Invite emails through the outbox.
   4. Tracking off, the bounce webhook, and domain DNS.
2. Later: digests, preferences, push notifications through Capacitor, and moving delivery to the AWS worker.

### Compliance

- ✅ **We are deliberately staying out of HIPAA scope.** That means no BAAs and no working on behalf of providers, insurers or agencies (covered entities).
- Rules that still apply to a consumer health app: the FTC Health Breach Notification Rule and state laws such as Washington's My Health My Data Act. In practice:
  - no ad or analytics tools that can see health data;
  - consent before sharing data, and a way for users to delete their data;
  - encryption at rest;
  - AI vendors that don't retain our data or train on it.

### Other proposed choices (not installed)

- ✅ **Auth:** Better Auth, installed (see _Auth_). Email + password first; Resend follows soon.
- 🟡 **Email:** Resend, in a near-term follow-up iteration (see _Notifications_).
- ✅ **UI:** Tailwind v4 (`tailwindcss` + `@tailwindcss/vite`), **daisyUI 5** for styling, and **React Aria Components** for accessible behavior. Mobile-first. Installed: `tailwindcss`/`@tailwindcss/vite` 4.3.5, `daisyui` 5.8.1 (dev dependencies), `react-aria-components` 1.22.1 and `@internationalized/date` 3.12.4. We considered shadcn/ui (more dependencies and copied code) and Preline (its vanilla-JS plugins run outside React and clash with re-renders). Three layers:
  1. Native elements styled with daisyUI by default: buttons, inputs, cards, alerts, `<details>`, and `<dialog>` opened with `showModal()` for simple confirms. No JS.
  2. React Aria Components only where HTML falls short: DatePicker/TimeField (time-zone aware through `@internationalized/date`, which matches `occurred_at` + `time_zone`), ComboBox, Menu, Select, Tabs and Toast. Style them with daisyUI classes plus Tailwind `data-[focused]:`-style variants on RAC's state attributes.
  3. ✅ `eslint-plugin-jsx-a11y` 6.10.2 (`flatConfigs.recommended`) for apps/web. Its declared peer range stops at ESLint 9, but it runs on 10: a test file with known violations was caught. Avoid the unofficial `eslint-plugin-jsx-a11y-x` fork unless the user agrees. `@axe-core/playwright` comes once Playwright lands.
- Wrap repeated daisyUI + RAC pairings in small components in `apps/web/app/components/` (e.g. `<Field>`, `<DateTimeField>`, `<EntryActions>`). Expect small CSS overrides where daisyUI's `modal`/`dropdown` classes meet RAC overlays.
- Theming uses daisyUI themes (`data-theme`), which also gives us a later large-text or high-contrast option.
- 🟡 **Printing:** print-specific CSS first, `@react-pdf/renderer` if we need real PDFs.
- 🟡 **AI:** the Vercel AI SDK with Claude, run as server or worker jobs.
- 🟡 **Calendar:** an iCal feed endpoint and Google Calendar OAuth sync.
- 🟡 **Testing:** Playwright for end-to-end tests (Vitest is ✅, see _Language and repository_).
- 🟡 **Mobile:** Capacitor, with `webDir` set to `apps/web/build/native/client`.

## Current layout

```
.nvmrc                 Node 24.22.3
docker-compose.yml     dev Postgres (port 5434), PowerSync (8080) + its storage; docker-compose.test.yml → test (5435)
powersync/             service.yaml (local PowerSync), sync-config.yaml (Sync Streams)
scripts/browser-checks/ headless Chrome checks (cdp.mjs harness, roundtrip, phase2, live-notes, signout-wipe, proxy)
package.json           root scripts; packageManager pnpm@12.21.0
eslint.config.js       ESLint flat config (type-aware); .prettierrc.json, .prettierignore
vitest.config.ts       Vitest projects (data:unit, integration)
pnpm-workspace.yaml    apps/*, packages/*; allowBuilds
tsconfig.base.json     strict shared compiler settings
apps/web/              @caretook/web: React Router 8, Vite 8
  build-target.ts      "web" | "native" switch (BUILD_TARGET env var)
  react-router.config.ts
  app/root.tsx
  app/routes.ts
  app/routes/app/          shared screens (no server loaders/actions): home, timeline, entry-notes (live notes),
                           settings (units)
  app/routes/marketing/    web-only pages
  app/routes/native-index.tsx  native-only "/" → "/app" redirect
apps/web/app/.server/data.ts  re-exports @caretook/data (server-only door); auth.ts → @caretook/auth
  app/app.css          Tailwind + daisyUI (light/dark themes follow the device)
  app/components/      EntryForm, EntrySheet (RAC Modal), QuickAddBar, TimelineEntryRow, TimelineEntryCard, KindIcon,
                       TimelineFilters (KindFilter, ViewToggle), LatestVitals, EntryActions (RAC Menu),
                       DateTimeField (RAC DateField), ConfirmDialog, VitalTypeMenu, VitalReadingsFields,
                       LiveNotesEditor (Tiptap + Yjs), LiveNotesPreview
  app/lib/sync/        PowerSync: schema (drizzle sqlite), client (db + connector, lazy), index (open/close,
                       useLiveQuery, useSyncState), timeline (local queries + writes), notes (live documents:
                       previews, ensureNoteDocument, createNoteDoc/bindNoteDoc)
  app/lib/             session.ts (requireSession), me.ts (cached settings),
                       auth-client.ts, rpc.ts (typed client + output types), api.ts (load/toActionResult),
                       entryDisplay.ts (KIND_META, entrySummary, initials),
                       entryForm.ts, format.ts, redirect.ts (safeRedirect), form.ts
  app/routes/api/auth.ts  Better Auth handler at /api/auth/* (web only)
  app/routes/rpc.ts    oRPC at /rpc/* (web only); app/lib/rpc.ts is the typed client
  app/routes/sign-in.tsx, sign-out.tsx  shared, client-only
  .env.example         auth env (BETTER_AUTH_SECRET, BETTER_AUTH_URL, …)
packages/auth/         @caretook/auth: Better Auth config, getAuthUser, browser client
packages/api/          @caretook/api: oRPC router, procedures, error mapping, HTTP handler
packages/data/         @caretook/data: Drizzle schema, models, services, RBAC
  drizzle.config.ts    drizzle-kit config
  scripts/             tsx CLI runners: migrate, seed, clear
  test/                integration test env guard, globalSetup, setup, fixtures
  .env.example, .env.test
  src/constants/       roles, SYSTEM_USER, page sizes
  src/errors/          typescript-errors codes + helpers
  src/permissions/     RBAC map + helpers (client-safe)
  src/db/              client (lazy pool, txOrDb, dbMayFail, withTransaction), types,
                       migrate.ts, clear.ts, migrations/
  src/db/seeds/        users, accounts (dev passwords), careGroups (Dev Family), timelineEntries
                       (+ timelineEntries.test.ts validating every seed entry)
  src/db/schema/       tables + Zod schemas (client-safe); vitals.ts (vital spec, units, conversion),
                       userPreferences.ts (per-user settings: resolveUnits, resolveTimelineView),
                       noteDocument.ts (live notes tables), noteYjs.ts (Yjs helpers, plain text)
  src/models/          base/ (CRUD + query helpers), user/, careGroup/, careGroupMember/,
                       careRecipient/, careGroupInvite/, timelineEntry/, noteDocument/, noteUpdate/
  src/services/        baseService, userService, careGroup*, careRecipientService, timelineEntryService,
                       noteDocumentService
```

## Commands (run from the repo root after `nvm use`)

| Command                                                                      | What it does                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                                   | web dev server (SSR)                                                                                                                                                                                 |
| `pnpm --filter @caretook/web dev:native`                                     | dev server in native (SPA) mode                                                                                                                                                                      |
| `pnpm build`                                                                 | web build → `apps/web/build/web/`                                                                                                                                                                    |
| `pnpm build:native`                                                          | native SPA build → `apps/web/build/native/client/`                                                                                                                                                   |
| `pnpm datastore:start`                                                       | first-time setup or daily start: starts Postgres (waits for healthy), migrates, seeds. Needs `packages/data/.env` and `apps/web/.env` (copy each `.env.example`; set `BETTER_AUTH_SECRET`).          |
| `pnpm datastore:up` / `datastore:stop` / `datastore:logs`                    | start, stop or tail the dev Postgres container                                                                                                                                                       |
| `pnpm datastore:generate`                                                    | generate a migration from schema changes (no database needed)                                                                                                                                        |
| `pnpm datastore:migrate`                                                     | apply pending migrations                                                                                                                                                                             |
| `pnpm datastore:seed`                                                        | insert dev data (idempotent)                                                                                                                                                                         |
| `pnpm datastore:clear`                                                       | drop everything (localhost only)                                                                                                                                                                     |
| `pnpm datastore:reset`                                                       | clear, migrate and seed                                                                                                                                                                              |
| `pnpm datastore:studio`                                                      | Drizzle Studio                                                                                                                                                                                       |
| `pnpm datastore:start:test` / `datastore:reset:test` / `datastore:stop:test` | the test database on port 5435 (migrated, not seeded)                                                                                                                                                |
| `pnpm lint` / `lint:fix`                                                     | ESLint over the whole repo                                                                                                                                                                           |
| `pnpm format` / `format:check`                                               | Prettier write / check                                                                                                                                                                               |
| `pnpm test`                                                                  | every Vitest project. Integration tests need `pnpm datastore:up:test` first                                                                                                                          |
| `pnpm test:unit` / `test:integration` / `test:watch`                         | a single project, or watch mode                                                                                                                                                                      |
| `pnpm check`                                                                 | typecheck, lint, format check and tests: run before committing                                                                                                                                       |
| `pnpm typecheck`                                                             | runs tsc on every package. For apps/web it runs typegen and tsc on the **web** target only. The native typegen pass overwrites the web types, and the web target already includes every shared file. |

## Likely next steps

1. Make the integration tests independent of each other, as `timelineEntry.int.test.ts` already is (a `setup()` per test). `careGroup.int.test.ts` shares one group across `describe` blocks, so a single failure cascades into others. Then widen coverage to every role against every table.
2. Choose the hosted database (it must be in the same region as the Vercel functions, with pooling) and decide how production migrations run.
3. **Timeline iteration 2** is done (see that section; phases 3 and 4 are uncommitted until the user asks). Open follow-ups for live notes: decide on presence and cursors (a websocket relay) after real use, and add a compaction cron sweep.

4. The Resend iteration (sign-up, invites with accept and consent, email verification and reset), then Capacitor (bearer token storage, `VITE_API_ORIGIN`).
