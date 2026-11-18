# Caretook

Caretook (caretook.com) helps caretakers manage someone else's care together: a shared timeline of notes, symptoms, vitals and events, with live notes that several people can write at once. It works offline and syncs in real time. Medications, a provider directory and an assistant are planned.

It's a mobile-first web app (and later a native app through Capacitor), built as a TypeScript monorepo.

## Documentation

| Read this                                      | For                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [docs/orchestration.md](docs/orchestration.md) | **How work gets done:** branches, the inbox and tracker, running several PRDs in parallel, landing work. Start here. |
| [plans/inbox.md](plans/inbox.md)               | **Your list.** Add bugs, changes, features and questions as plain lines.                                             |
| [plans/backlog.md](plans/backlog.md)           | The tracker agents keep from the inbox: ids, status, which PRD, notes. Review it.                                    |
| [plans/](plans/)                               | PRDs (`<topic>-prd.md`) and their slice plans (`<topic>-plan.md`).                                                   |
| [AGENTS.md](AGENTS.md)                         | The detailed project record for agents and developers: stack decisions, architecture, conventions, gotchas.          |

## Stack

- **App:** React Router 8 (framework mode) on Vite 8, Tailwind v4 with daisyUI 5, React Aria Components.
- **Data:** Postgres with Drizzle ORM and Zod; an oRPC API; Better Auth.
- **Sync:** PowerSync keeps a SQLite copy on each device (offline first); live notes merge through Yjs and Tiptap.
- **Tooling:** pnpm 12 workspaces on Node 24, ESLint, Prettier, Vitest.

```
apps/web/          the app (SSR on the web, a static SPA for native)
packages/api/      oRPC procedures and the sync upload
packages/auth/     Better Auth setup
packages/data/     schema, permissions, models, services, migrations, seeds
powersync/         sync service config (Sync Streams)
plans/             the inbox, the tracker, PRDs and plans
scripts/loops/     parallel worktrees for PRDs and slices
scripts/backlog/   the inbox and tracker tool (pnpm backlog)
.githooks/         branch protection
```

## Getting started

You need Node 24 (`nvm use`), pnpm 12 and Docker.

```sh
nvm use
pnpm install
pnpm hooks:install                                    # turn on branch protection (once per clone)
cp packages/data/.env.example packages/data/.env      # then set the secrets in both
cp apps/web/.env.example apps/web/.env
pnpm datastore:start                                  # Postgres + PowerSync, migrated and seeded
pnpm dev                                              # http://localhost:5173
```

Sign in as one of the seeded `@example.com` accounts (for example `member@example.com`) with the `SEED_USER_PASSWORD` from `packages/data/.env`. All seed data is fictional.

## Everyday commands

| Command                     | What it does                                                         |
| --------------------------- | -------------------------------------------------------------------- |
| `pnpm dev`                  | the dev server                                                       |
| `pnpm check`                | typecheck, lint, format check and every test: run before handing off |
| `pnpm datastore:reset`      | wipe the local database, migrate and reseed                          |
| `pnpm datastore:start:test` | the test database (needed by `pnpm test`)                            |
| `pnpm backlog list`         | what's planned, and where it stands                                  |
| `pnpm backlog ingest`       | file new inbox lines into the tracker                                |
| `scripts/loops/ls.sh`       | every parallel worktree and its stack                                |

AGENTS.md has the full command list.

## Branches

`main` is live, `staging` is what goes live next, and `dev` is where work lands. `main` and `staging` change only by pull request. See [docs/orchestration.md](docs/orchestration.md#branches).
