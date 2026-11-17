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
- ❓ How a membership removal propagates to devices that have already synced the group's data offline (PowerSync sync rules plus local data wipe).
- 🟡 Co-members can read each other's full user row in the data layer, including `role` and `emailVerified`. The API exposes only public profiles (`careGroup.members`: name, image, role), so keep it that way for any new procedure.

### Shared timeline (iteration 1, in progress)

The first full vertical slice: a seeded user signs in, picks one of their care groups, then can add, edit, delete and view timeline entries on the web target. It's online only (oRPC from `clientLoader`/`clientAction`). PowerSync comes next, so the API reuses the same services its upload endpoint will call.

- ✅ One `timeline_entry` table with a `kind` column:
  - `group_id` is stored directly on the row, because PowerSync sync rules filter by column, not by join. `recipient_id` is stored too, ready for several recipients per group.
  - `occurred_at` (when it happened, as opposed to `created_at`, the upload time) plus the device's IANA `time_zone`.
  - `title` (optional) and `body`, with kind-specific fields in a `details` jsonb validated by a Zod discriminated union.
  - Index on `(group_id, occurred_at desc, id)`.
- ✅ Kinds: `note | symptom | event`. **No appointments in iteration 1.** Symptoms are a free-text `name` with optional `severity` 0–10; suggested names are a later UX addition.
- ✅ Permissions: read/list for any member; create, update and delete for `owner`, `admin` and `caretaker` (any writer may edit any entry). "Only the author or managers edit" may come later as a per-group option. `groupId`, `recipientId` and `kind` are `system`-only on update.
- ✅ **Soft delete** (`deleted_at`): the service's `remove` sets it, checked against the **delete** permission, and `list` hides deleted rows. Group or account deletion still hard-deletes through the cascade.
- ✅ Keyset pagination on `(occurred_at, id)`, not offset: offline devices insert older entries.
- ✅ **Phase 1 is built** (`db/schema/timelineEntry.ts`, `models/timelineEntry/`, `services/timelineEntryService.ts`, seeds, `timelineEntry.int.test.ts`). Details settled while building it:
  - A composite FK `(group_id, recipient_id) → care_recipient(group_id, id)` makes the database guarantee an entry's recipient is in its group. It's `NO ACTION`: deleting a recipient fails while entries exist, but deleting the group still cascades.
  - `create` defaults `recipientId` to the group's recipient. It checks the group first (as the actor), so non-members get `unauthorized` and learn nothing about the group.
  - The Zod schemas live in the schema file and are client-safe: `timelineEntryContentZSchema` (a union on `kind`), `timelineEntryCreateZSchema`, and `timelineEntryUpdateZSchema` (strict, content only). `update` validates the **merged** row, so a note can't lose its body.
  - Model: `get`/`getById`/`listPage` hide soft-deleted rows unless `includeDeleted` is set; `update` refuses deleted rows; `remove` is the soft delete; `purge` (hard delete) is system only. `listPage` returns `{ data, nextCursor }` with an opaque base64url cursor. There's no unvalidated `upsert`: the PowerSync upload endpoint will need one that goes through the service's validation.
  - `occurredAt` is read back as Postgres text (`2026-11-17 10:00:00.000+00`), not ISO. Normalise it at the API layer if clients need ISO.
- 🟡 Phases:
  1. ✅ Timeline data layer (schema, permissions, model, service, seeds, independent integration tests).
  2. ✅ Auth (`packages/auth`, Better Auth 1.7.25, pinned exactly). See _Auth_ below.
  3. ✅ API (`packages/api`, oRPC 1.16.2). See _API: oRPC_.
  4. Screens: sign in, a plain list of my groups (skipped when there's only one), and `/app/groups/:groupId/timeline`.
- Out of scope: sign-up and create-group UI, invite accept and consent, email verification and reset, PowerSync, appointments, attachments, Playwright, deploy.
- ✅ Sign-in: **email + password** in iteration 1, so no email provider is needed yet. Better Auth's `emailAndPassword` hashes passwords into `account`. Seeds create password accounts for the `@example.com` dev users (a shared dev password from `.env`, hashed with Better Auth's own hasher). The seeds also hold the only care group (Dev Family), so there's no sign-up or create-group UI in this iteration; both come with Resend and invites.
- 🟡 **Resend** is coming in a near-term follow-up iteration. It brings email verification, password reset, invite emails, and possibly magic link or email OTP. Keep that path cheap:
  - All outgoing email goes through `packages/notifications` (see _Notifications_), never through Better Auth callbacks calling a provider directly.
  - Leave `requireEmailVerification` off until Resend lands, and don't build UI that assumes passwords are the only sign-in method.

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
- ✅ **UI:** Tailwind v4 (`tailwindcss` + `@tailwindcss/vite`), **daisyUI 5** for styling, and **React Aria Components** for accessible behavior. Mobile-first. Not installed yet; it arrives with the timeline slice. We considered shadcn/ui (more dependencies and copied code) and Preline (its vanilla-JS plugins run outside React and clash with re-renders). Three layers:
  1. Native elements styled with daisyUI by default: buttons, inputs, cards, alerts, `<details>`, and `<dialog>` opened with `showModal()` for simple confirms. No JS.
  2. React Aria Components only where HTML falls short: DatePicker/TimeField (time-zone aware through `@internationalized/date`, which matches `occurred_at` + `time_zone`), ComboBox, Menu, Select, Tabs and Toast. Style them with daisyUI classes plus Tailwind `data-[focused]:`-style variants on RAC's state attributes.
  3. `eslint-plugin-jsx-a11y` for apps/web (check it supports ESLint 10 flat config before adding it), and `@axe-core/playwright` once Playwright lands.
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
docker-compose.yml     dev Postgres (port 5434); docker-compose.test.yml → test (5435)
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
  app/routes/app/          shared screens (no server loaders/actions)
  app/routes/marketing/    web-only pages
  app/routes/native-index.tsx  native-only "/" → "/app" redirect
apps/web/app/.server/data.ts  re-exports @caretook/data (server-only door); auth.ts → @caretook/auth
  app/lib/             auth-client.ts (browser auth), redirect.ts (safeRedirect), form.ts
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
                       migrate.ts, clear.ts, seeds/, migrations/
  src/db/schema/       tables + Zod schemas (client-safe)
  src/models/          base/ (CRUD + query helpers), user/, careGroup/, careGroupMember/,
                       careRecipient/, careGroupInvite/, timelineEntry/
  src/services/        baseService, userService, careGroup*, careRecipientService, timelineEntryService
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
3. Finish the timeline slice (Phase 4 screens), then the Resend iteration (invites, accept and consent), then a test PowerSync round trip (sync rules by group membership).
