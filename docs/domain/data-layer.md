# Data layer: `packages/data` (`@caretook/data`)

The data layer area's rules and decisions, moved out of AGENTS.md (whose core rules still apply). An orchestrator folds a landing's lasting decisions for this area in here.

- **Entry points:**
  - `@caretook/data` is **server only**: never import the root from client code.
  - `/schema`, `/errors` and `/permissions` are client-safe.
  - In apps/web, server code imports through `app/.server/data.ts`.
- **Layers, bottom up:**
  - `errors/`: typescript-errors, with every code in `errors/constants.ts`. Errors are **returned, not thrown**; narrow with `isError()`. Wrap db calls as `dbMayFail(() => …, code)`.
  - `permissions/`: `PERMISSIONS[table][create|read|update|delete|list][role] = all | owned | none | { group: [...] }`, plus `ownerField`, field-level write restrictions and **`groupFields`**: a read reached only through a group rule returns just those fields (`user`: `PUBLIC_PROFILE_FIELDS`, id, name, image). The model enforces it in SQL (each hidden column is `CASE WHEN <the other rules> THEN col END`; filters and orders on a hidden field match whole rows only). User reads return `publicOnly`; code that needs a co-member's email reads `userModel.getWhole*`/`listWhole` as `SYSTEM_USER` (else `userModel:notWhole`).
    - Roles are `admin`, `support` and `member` (`user.role`), `system` and `unauthenticated`. `support` gets `owned` wherever members do; staff-only tables use `STAFF_PERMISSION_ENTRY`. A resolved scope is `all` or an OR of `owned`, `group` and `groupUser` rules.
    - `hasPermission()` is for UI checks.
  - `models/`: `baseModel.getFunctions(...)` gives `create/get/getById/list/update/remove/upsert`, with **RBAC enforced in SQL**.
    - Every query is ANDed with the actor's scope; group rules become subqueries on `care_group_member`.
    - Writes must land inside the scope.
    - Update and remove refuse an empty filter.
    - Filters are serializable (`{ field: { type: "eq", value } }`) and checked against the table's columns.
  - `services/`: `getService(model)` with `ServiceContext = { authUser, tx? }`. Business rules, side effects and transactions go here. Services never read requests; use `SYSTEM_USER` for internal work.
- **`withTransaction(fn)` rolls back when `fn` returns an AppError.** A returned error would otherwise commit.
- **Arg types use `WithoutProtected<T>`:** a generic `Omit<DbInsert<K>, …>` silently drops optional columns such as `id`.
- **Table conventions:**
  - UUID PKs via `id()`: clients create rows offline, so `create`/`upsert` accept a caller-supplied id.
  - Every table spreads `timestamps` (timestamptz, string mode) and `audits` (`created_by`/`updated_by`, set by models, not FKs).
- **Adding a table:**
  1. Write `db/schema/<name>.ts` (table, types, Zod) and export it from `db/schema/index.ts`.
  2. Add a `PERMISSIONS` entry (the type requires one).
  3. Add `models/<name>/` and `services/<name>Service.ts`, and register both.
  4. If it syncs: `ALTER PUBLICATION powersync ADD TABLE …` in a migration, plus a stream query and a device schema entry.
- **Migrations:** generated into `src/db/migrations/` and applied in-process (`src/db/migrate.ts`). There are 0000–0020 so far.
  - **drizzle-kit can emit a unique constraint after the FK that needs it.** Read the generated SQL and reorder by hand.
  - Until the first deploy it's fine to delete and regenerate migrations.
- **DB client:** the pool is created lazily (importing never needs `DATABASE_URL`). Only the **pool** survives HMR (`utils/remember.ts`); the drizzle wrapper is rebuilt, so new tables work without a restart.
- **Env:** `loadEnv.ts` loads `.env.<NODE_ENV>`, then `.env`, from `packages/data` (Node's `process.loadEnvFile`). Real env vars win. `.env.test` is committed; `.env` isn't (copy `.env.example`).
- **Local Postgres:** Docker `postgres:18.7-alpine` with `wal_level=logical`, dev on :5434 and test on :5435, data in `.postgres/`.
  - Integration tests: the main checkout uses its test database on :5435; a `.loops` worktree uses its own `caretook_test_<worktree>` database on the shared test Postgres (:5436, [loops](../loops.md)). The guard, `src/db/testDatabase.ts` (pure, tested), refuses a non-local host, a port other than `PG_TEST_PORT` and, on the shared server, any other database name.
  - `datastore:clear` refuses a non-localhost database, and drops the publication.
  - `datastore:seed` refuses production and uses `@example.com` accounts only.
- ❓ The hosted database (same region as Vercel functions, with pooling), and how production migrations run.
