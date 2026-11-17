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
- ✅ The repository starts minimal. ❓ Turborepo, linting/formatting and testing tools are all still to be decided.

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
- 🟡 The API logic lives in its own package (planned as `packages/api`), with no dependency on any runtime, so it can be mounted in several places:
  - in a React Router **resource route** on Vercel (e.g. `/rpc/*`), called over HTTP by the web and native apps;
  - called **directly on the server** from web-only server loaders, with no HTTP hop;
  - in an **AWS worker** for long-running jobs.
- `/app` routes call the oRPC client from `clientLoader`, so they run the same way on web and native.

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
  - Queued writes are uploaded through *our* API, which handles permission checks, validation and auditing.
  - Typed queries through its Drizzle and Kysely integrations, and it has a Capacitor SDK.
- Alternatives we ruled out:
  - Zero: offline writes aren't a first-class feature.
  - ElectricSQL: it only syncs data down to clients, so we'd build the offline write queue ourselves.
  - Convex: weak offline support and lock-in to their database.
  - InstantDB, Triplit and Jazz: less control over the data.
- 🟡 Sharing model: a "care circle", where users sync only the circles they belong to.
- 🟡 Conflicts: last write wins per row by default. Timeline entries are mostly append-only.
- ✅ **Drizzle ORM 0.45** (latest stable; 1.0 is still RC) with the `pg` driver, and `drizzle-zod` + **Zod 4** for schemas shared by client and server. Migrations are generated into `packages/data/src/db/migrations/` and applied in-process with drizzle-orm's migrator (`src/db/migrate.ts`). `0000` creates `user`. **Until the first deploy, it's fine to delete and regenerate migrations** rather than stacking up early ones.
- ✅ **UUID primary keys** on every table (`id()` in `db/schema/columns.ts`). PowerSync clients create rows offline, so ids must be generatable on the client; `create`/`upsert` accept a caller-supplied `id`.
- ✅ Every table spreads `timestamps` (`created_at`, `updated_at`, timestamptz in string mode) and `audits` (`created_by`, `updated_by`, set by the model layer, not FKs).

### Data access layer: `packages/data` (`@caretook/data`)
- ✅ Patterned on the user's cn-time-by-project `app/.server` layout, but in a **package** so `packages/api`, web server loaders and AWS workers can all use it.
- ✅ Layers, bottom up:
  - `errors/`: **typescript-errors**. Every code lives in `errors/constants.ts`. Errors are **returned, not thrown**; callers narrow with `isError()`. Wrap db calls in `dbMayFail(() => ..., code)` (a thunk, so synchronous throws are caught too).
  - `permissions/`: the RBAC map `PERMISSIONS[schemaName][create|read|update|delete|list][role] = all | owned | none`, plus `ownerField` per table and field-level write restrictions (`fields`). Roles are `admin`, `member` (stored on `user.role`), `system` and `unauthenticated`. With several roles, the most permissive scope wins. It's client-safe, and `hasPermission()` is for UI checks.
  - `models/`: data access **with RBAC enforced in SQL**. `baseModel.getFunctions({ schemaName, dbToModel, getWith })` returns `create/get/getById/list/update/remove/upsert`, and every query is ANDed with the actor's permission scope. Update and remove refuse an empty filter. Filters are serializable (`{ field: { type: "eq", value } }`) and checked against the table's columns at runtime.
  - `services/`: `getService(model)` with a `ServiceContext = { authUser, tx? }`. Business rules, side effects and multi-model transactions go here. Services never read requests or cookies; the caller (oRPC handler, loader, worker) resolves `authUser`. Use `SYSTEM_USER` for internal work.
- ✅ `withTransaction(fn, { tx })` **rolls back when `fn` returns an AppError**. Without it, a returned (not thrown) error would commit.
- ✅ The DB pool is created lazily on first query (importing never needs `DATABASE_URL`) and kept across HMR by `utils/remember.ts`.
- ✅ Entry points: `@caretook/data` is **server only**. `@caretook/data/schema`, `/errors` and `/permissions` are client-safe. In apps/web, server code imports through `app/.server/data.ts`, so React Router's `.server` guard keeps it out of client bundles. **Never import `@caretook/data` (the root) from client code.**
- Adding a table: write `db/schema/<name>.ts` (table, types, Zod schemas) and export it from `db/schema/index.ts`, add a `PERMISSIONS` entry (the type requires one), add `models/<name>/` and `services/<name>Service.ts`, then register both in their `index.ts`.
- ❓ Care-circle sharing needs a `circle` permission scope. See **Care circles** below.
- ✅ **Local datastore: Docker Compose** with `postgres:18.7-alpine` and `wal_level=logical` (PowerSync needs logical replication). Dev runs on host port **5434** and test on **5435**, so it can run next to other projects' Postgres on 5432. Data lives in `.postgres/` (gitignored).
- ✅ Env loading: `src/utils/loadEnv.ts` loads `.env.<NODE_ENV>` then `.env` from `packages/data`. It uses Node's `process.loadEnvFile` instead of dotenv-flow, and real environment variables always win. `.env.test` is committed; `.env` is not (copy `.env.example`).
- ✅ Safety: `datastore:clear` refuses any database that isn't on localhost, and `datastore:seed` refuses `NODE_ENV=production`. Seeds use `@example.com` accounts only.
- ❓ Database host, and PowerSync Cloud vs self-hosted.

### Care circles (next up; mostly undecided)
The shared space that care data belongs to: a group of caretakers looking after one person. Only the first two points below are agreed; the rest is groundwork from the data-layer design and open questions to settle with the user before building.

**Agreed so far**
- 🟡 Users sync only the circles they belong to (PowerSync sync rules filter by membership). See *Data and sync*.
- ✅ Two separate role systems:
  - **Global roles** (`admin`, `member`) live on `user.role` and cover account-level access only.
  - **Circle roles** live on the membership row (user ↔ circle) and cover access to a circle's data. Placeholder names in `constants/roles.ts`: owner, caretaker, viewer. They aren't final.

**What the existing code implies** (see *Data access layer*)
- `RolePermission` needs a new scope, `circle`: rows whose circle the actor is a member of. Today `getPermissionScope` handles `all | owned | none`, and `scopeToSql` turns the result into a WHERE clause. `circle` would become a subquery, roughly `<circleField> IN (SELECT circle_id FROM <membership> WHERE user_id = :actor)`, so RBAC stays in SQL.
- Circle roles differ per circle, so the scope may need to vary by role, e.g. a viewer can `read`/`list` but not `update`. That means one membership subquery per required role set, not a single global check. The `PERMISSIONS` map is keyed by global role today, so it needs a way to express circle-role rules. **This is the main design question.**
- Tables owned by a circle would declare a `circleField` (e.g. `circleId`) next to the existing `ownerField`. The circle table itself would use `id`, the way `userSchema` uses `ownerField: "id"`.
- The TODO in `PERMISSIONS.userSchema.read`: members must be able to read other users who share a circle with them, but only safe profile fields (name, image, not email?).
- Both new tables follow the existing conventions: a UUID `id()` (clients create rows offline), `timestamps` and `audits`, Zod schemas in `db/schema/<name>.ts`, a `PERMISSIONS` entry, `models/<name>/`, `services/<name>Service.ts`, and seeds for the dev accounts in `db/seeds/`.
- Creating a circle should make the creator its owner in the same transaction (`withTransaction`). The service layer is where that rule goes.

**Open questions**
- ❓ Name: "care circle" (used so far) or "care group" (the user's latest wording)? Pick one term for the code, the UI and the DB.
- ❓ Is a circle about exactly one care recipient? Is the recipient a member (with an account) or just a profile record?
- ❓ The final list of circle roles, and what each may do (e.g. who can invite, remove members, delete the circle, edit vs. only view the timeline and medications).
- ❓ Can a circle have more than one owner? What happens when the last owner leaves or deletes their account (data deletion requirement)?
- ❓ Invitations: by email, by link, or both? Pending invite state, expiry, and accepting before vs. after sign-up. Better Auth isn't installed yet.
- ❓ Consent: inviting someone shares health data, and the compliance rules require consent before sharing. What does the inviter or recipient confirm, and where is it recorded?
- ❓ Should global `admin` (Caretook staff) have `all` access to circle data? Least privilege for health data suggests no, and support access should be explicit and audited.
- ❓ How a membership change (removal) propagates to devices that have already synced the circle's data offline.

### Compliance
- ✅ **We are deliberately staying out of HIPAA scope.** That means no BAAs and no working on behalf of providers, insurers or agencies (covered entities).
- Rules that still apply to a consumer health app: the FTC Health Breach Notification Rule and state laws such as Washington's My Health My Data Act. In practice:
  - no ad or analytics tools that can see health data;
  - consent before sharing data, and a way for users to delete their data;
  - encryption at rest;
  - AI vendors that don't retain our data or train on it.

### Other proposed choices (not installed)
- 🟡 **Auth:** Better Auth (works with Drizzle, issues JWTs that PowerSync can verify, bearer tokens for Capacitor).
- 🟡 **UI:** Tailwind v4 and shadcn/ui, mobile-first.
- 🟡 **Printing:** print-specific CSS first, `@react-pdf/renderer` if we need real PDFs.
- 🟡 **AI:** the Vercel AI SDK with Claude, run as server or worker jobs.
- 🟡 **Calendar:** an iCal feed endpoint and Google Calendar OAuth sync.
- 🟡 **Testing:** Vitest and Playwright.
- 🟡 **Mobile:** Capacitor, with `webDir` set to `apps/web/build/native/client`.

## Current layout

```
.nvmrc                 Node 24.22.3
docker-compose.yml     dev Postgres (port 5434); docker-compose.test.yml → test (5435)
package.json           root scripts; packageManager pnpm@12.21.0
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
apps/web/app/.server/data.ts  re-exports @caretook/data (server-only door)
packages/data/         @caretook/data: Drizzle schema, models, services, RBAC
  drizzle.config.ts    drizzle-kit config
  scripts/             tsx CLI runners: migrate, seed, clear
  .env.example, .env.test
  src/constants/       roles, SYSTEM_USER, page sizes
  src/errors/          typescript-errors codes + helpers
  src/permissions/     RBAC map + helpers (client-safe)
  src/db/              client (lazy pool, txOrDb, dbMayFail, withTransaction), types,
                       migrate.ts, clear.ts, seeds/, migrations/
  src/db/schema/       tables + Zod schemas (client-safe)
  src/models/          base/ (CRUD + query helpers), user/
  src/services/        baseService, userService
```

## Commands (run from the repo root after `nvm use`)

| Command | What it does |
|---|---|
| `pnpm dev` | web dev server (SSR) |
| `pnpm --filter @caretook/web dev:native` | dev server in native (SPA) mode |
| `pnpm build` | web build → `apps/web/build/web/` |
| `pnpm build:native` | native SPA build → `apps/web/build/native/client/` |
| `pnpm datastore:start` | first-time setup or daily start: starts Postgres (waits for healthy), migrates, seeds. Needs `packages/data/.env` (copy `.env.example`). |
| `pnpm datastore:up` / `datastore:stop` / `datastore:logs` | start, stop or tail the dev Postgres container |
| `pnpm datastore:generate` | generate a migration from schema changes (no database needed) |
| `pnpm datastore:migrate` | apply pending migrations |
| `pnpm datastore:seed` | insert dev data (idempotent) |
| `pnpm datastore:clear` | drop everything (localhost only) |
| `pnpm datastore:reset` | clear, migrate and seed |
| `pnpm datastore:studio` | Drizzle Studio |
| `pnpm datastore:start:test` / `datastore:reset:test` / `datastore:stop:test` | the test database on port 5435 (migrated, not seeded) |
| `pnpm typecheck` | runs tsc on every package. For apps/web it runs typegen and tsc on the **web** target only. The native typegen pass overwrites the web types, and the web target already includes every shared file. |

## Likely next steps
1. **Care circles:** settle the open questions in *Care circles* with the user first, then add the circle and membership tables, the `circle` permission scope, and seeds.
2. Choose the hosted database (it must be in the same region as the Vercel functions, with pooling) and decide how production migrations run.
3. Pick a test setup (🟡 Vitest) and add unit tests for `queryHelpers` and `permissions`, plus integration tests for the models.
4. `packages/api` (oRPC) calling the services, mounted in a React Router resource route.
5. Auth (Better Auth, against the existing `user` table), then a test PowerSync round trip.
