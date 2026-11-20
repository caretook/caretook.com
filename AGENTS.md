# Caretook: Project Context

The **core**: rules every session needs, and pointers to the role and area docs (_Area index_): read what your work touches. Read history with `pnpm log`; docs say what's true now. ✅ built · 🟡 proposed · ❓ open.

## Working rules

- **Build only what the user asks for.** Planned work is in the backlog and PRDs; start a PRD or slice only when the user says so.
- **No new dependencies without the user's approval.** Pin approved ones exactly.
- **Commit only when the user explicitly asks** ("run before committing" isn't asking). Exceptions: loops, on their `slice/` branch; `pnpm backlog`; an orchestrator's `pnpm prd land` on the user's word (or landing mode). Never commit on `staging` or `main`.
- **Small changes go straight onto `dev`** in the main checkout (a docs, tooling or config tweak, a contained fix). Work that needs a stack, runs alongside other work, touches a running PRD's hot file or adds a migration is a PRD or a `quick-fixes` slice; a small fix in its own worktree is a [hotfix](docs/agents/hotfix.md). **Unsure? Ask the user.**
- **Checks:** `pnpm check` before handing off. If every changed file is Markdown or tooling (`scripts/loops/`, `scripts/backlog/`, `.githooks/`), only `pnpm exec prettier --check <files>` and the tooling's own tests. Any other file, even a comment, needs `pnpm check`.
- **Commit subjects are [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**, merges included (the hook refuses others): `<type>(<scope>)!: <description>`. Types: `feat` (user-visible), `fix`, `docs` (plans, AGENTS.md, `docs/`), `test`, `refactor`, `perf`, `style`, `build`, `ci`, `chore` (tooling, syncs, backlog), `revert`. Scope: the PRD topic, else the area. Backlog ids in parentheses at the end; `!` and a `BREAKING CHANGE:` footer when breaking. A merge says what it brings: `feat(app-shell): theme choice (slice 2, B-8)`.
- **All seed and test data is fictional.** No real health information, even anonymized.
- **At landing:** an area's lasting decisions go into its area doc, process into the role doc, and only rules every session needs into this core. Delete what the work made stale.

## Branches and roles

- `main` (live) and `staging` change only by PR on GitHub. `dev` is the trunk. `prd/<topic>` (an orchestrator's), `slice/<topic>/<n>` (a loop's), `plan/<topic>` (docs) and `hotfix/<name>` land in `dev` through `pnpm prd land`.
- **The main checkout is the user's and stays on `dev`.** Agents reach it only through `pnpm backlog` and `pnpm prd land`.
- Each role has a doc in `docs/agents/`; your prompt names yours.

## Product and stack

Caretook: mobile-first tools for caretakers: a timeline (real-time **and** offline sync between users is a hard requirement), medications, providers; later AI, calendars, Capacitor.

- ✅ **TypeScript 5.9**, types inferred end to end (no codegen). **pnpm 12.21.0** workspaces on **Node 24** (`nvm use`). pnpm settings only in `pnpm-workspace.yaml` (no `.npmrc`; unknown keys fail); keep `minimumReleaseAge` (wait a day for a new package); build scripts need `allowBuilds` (only `esbuild`).
- ✅ **ESLint 10** (type-aware; `jsx-a11y` as is, not the `-x` fork without the user), **Prettier 3** (width 110), **Vitest 5** projects ([loop](docs/agents/loop.md#tests)).
- ✅ **React Router 8.5.1** (framework mode), Vite 8, **Tailwind v4 + daisyUI 5**, **React Aria Components** only where HTML falls short and only in `ui/` (read [components](docs/domain/components.md) before UI work), `lucide-react`; native elements first (`<dialog>` for confirms); **Drizzle 0.45**, Zod 4, **oRPC 1.16.2**, **Better Auth 1.7.25**, **PowerSync** web 2.7.0, **Yjs 13.6.33**, **Tiptap 3.34.0**.
- ❓ Turborepo. 🟡 Playwright, Capacitor (`webDir` `apps/web/build/native/client`), the Vercel AI SDK, print CSS, calendars.

## Architecture

- **Two targets** (`BUILD_TARGET`): **web** (SSR on Vercel) and **native** (a static SPA for Capacitor, no server). `/app/*`, `/sign-in`, `/sign-out` are shared; `/`, `/api/auth/*`, `/rpc/*` web only. **Shared routes never export a server `loader` or `action`** (`clientLoader`/`clientAction`, the local database, oRPC); `HydrateFallback` only in `root.tsx`.
- **Data** ([data-layer](docs/domain/data-layer.md)): `@caretook/data` is server only (`/schema`, `/errors`, `/permissions` are client-safe). Errors are returned, not thrown; models enforce RBAC in SQL; **write through the services**; UUID keys, `timestamps`, `audits`.
- **Sync** ([sync](docs/domain/sync.md)): Postgres is the truth; devices keep a PowerSync SQLite copy and upload through our API onto the services. Last write wins per row; live notes merge through Yjs. `lib/sync/` is plumbing; device queries are `lib/<area>/*.sync.ts`. Screens read the local database; server work is oRPC ([api](docs/domain/api.md)).
- **Hosting** ([ops](ops/runbook.md)): Vercel, Neon, PowerSync Cloud; staging and production, deployed only by `deploy.yml`. Migrations stay additive (expand, then contract later).

## Compliance

✅ **Outside HIPAA scope** (no BAAs, no work for covered entities). The FTC Health Breach Notification Rule and state laws (e.g. Washington's MHMDA) still apply: no ad or analytics tools that can see health data; consent before sharing; user data deletion; encryption at rest; AI vendors that don't retain or train on our data.

## Open questions

- ❓ A group's last owner deleting their account leaves it ownerless: block, delete the group, or auto-promote?
- ❓ Native token storage. Hosting's: [`ops/`](ops/runbook.md).

## Commands

From the repo root, after `nvm use`: `pnpm dev`, `build`, `build:native`; `pnpm datastore:start` (migrate, seed), `reset`, `generate` (a migration), `start:test` (:5435); `pnpm lint`, `format`, `typecheck`, `test`, and `pnpm check` (all of them); `pnpm log [git log args…]` (no backlog commits; `--grep` turns that off); `pnpm docs:budget` (docs over budget); `pnpm build:budget` (first-load chunk budget); `pnpm backlog …` and `pnpm prd …` (`pnpm prd help`); `pnpm deploy:env`, `db:roles`, `db:access` ([ops](ops/runbook.md)); `pnpm hooks:install` (once, after cloning).

## Area index

A slice's `Reads` names its docs. A new area adds a doc and an entry here.

- **Roles:** [loop](docs/agents/loop.md), [orchestrator](docs/agents/orchestrator.md) (and the rules across PRDs), [planner](docs/agents/planner.md), [backlog](docs/agents/backlog.md), [hotfix](docs/agents/hotfix.md), [recovery](docs/agents/recovery.md); [orchestration](docs/orchestration.md) (the human guide); [loops](docs/loops.md) (a stub). [layout](docs/layout.md): where code lives.
- **UI:** [components](docs/domain/components.md) (any UI, component tests), [app-shell](docs/domain/app-shell.md) (the `/app` frame, theme, group route, `appUrls`, settings), [marketing](docs/domain/marketing.md) (public pages).
- **Features:** [timeline](docs/domain/timeline.md), [live-notes](docs/domain/live-notes.md), [care-groups](docs/domain/care-groups.md) (roles, permissions, invites), [providers](docs/domain/providers.md), [medications](docs/domain/medications.md), [appointments](docs/domain/appointments.md), [care-periods](docs/domain/care-periods.md), [tasks](docs/domain/tasks.md), [profiles](docs/domain/profiles.md), [search](docs/domain/search.md), [assistant](docs/domain/assistant.md) (quick entry), [connectors](docs/domain/connectors.md) (MCP for a member's own AI).
- **Platform:** [api](docs/domain/api.md), [data-layer](docs/domain/data-layer.md), [sync](docs/domain/sync.md), [auth](docs/domain/auth.md), [notifications](docs/domain/notifications.md) (email), [admin](docs/domain/admin.md) (staff, `/admin`, audit), [security-headers](docs/domain/security-headers.md) (the CSP), [ops](ops/runbook.md) (deploys, secrets).
