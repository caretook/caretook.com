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
scripts/loops/     parallel worktrees for PRDs and slices (pnpm prd)
scripts/backlog/   the inbox and tracker tool (pnpm backlog)
.githooks/         branch protection and commit message checks
```

## Getting started

You need Node 24 (`nvm use`), pnpm 12 and Docker.

```sh
nvm use
pnpm install
pnpm hooks:install                                    # turn on the git hooks (once per clone)
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
| `pnpm prd status`           | every parallel PRD worktree, with its dev server link                |

AGENTS.md has the full command list.

## Running PRDs (orchestration)

Small changes need none of this: ask an agent in the main checkout and commit straight onto `dev`. Larger feature work runs as PRDs, each on its own branch with its own agent (an orchestrator), worktree, database and dev server, up to three at once. You steer each one by talking to its orchestrator; these are the commands around that. [docs/orchestration.md](docs/orchestration.md) is the full guide.

**Capture and review ideas**

| Command                                           | What it does                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| edit [plans/inbox.md](plans/inbox.md)             | add a bug, change, feature or question as a plain line           |
| `pnpm backlog ingest`                             | file new inbox lines into the tracker (each gets an id, `B-12`)  |
| `pnpm backlog list`                               | open items; filter with `--prd <topic>`, `--status <s>`, `--all` |
| `pnpm backlog show B-12`                          | one item, with its notes                                         |
| `pnpm backlog set B-12 prd=search status=triaged` | move an item to a PRD, or `status=dropped`                       |
| `pnpm backlog note B-12 "text"`                   | add a dated note                                                 |

**Run a PRD**

| Command                  | What it does                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm prd status`        | everything running: worktree, branch, uncommitted changes, and each dev server's link           |
| `pnpm prd plan <topic>`  | a docs-only worktree for writing a new PRD and its plan with an agent                           |
| `pnpm prd start <topic>` | create (or reopen) the PRD's worktree and stack; prints the command that opens its orchestrator |
| `pnpm prd serve <topic>` | start that PRD's dev server in the background and print its link (`--restart`, `--stop`)        |

Then tell the orchestrator which slices to run.

**Review and land**

| Command                  | What it does                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm prd ready <topic>` | the ready-to-land report: a link to try it, the bugs, features and changes it addresses, what changed, and anything still blocking   |
| `pnpm prd land <topic>`  | merge `prd/<topic>` into `dev` (or just tell the orchestrator "land it"). Refuses unless the branch is synced with `dev` and checked |
| `git push origin dev`    | publish `dev`; then open PRs on GitHub for `dev` → `staging` → `main`                                                                |
| `pnpm prd rm <topic>`    | when the PRD is finished: remove its worktree, stack and merged branch                                                               |

`pnpm prd help` lists the rest (`slice`, `check`, `sync`, `prompt`), which orchestrators run for you.

## Commit messages

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), enforced by a git hook: `feat(app-shell): group settings page (B-9)`, `fix(sign-in): one request on a double click (B-1)`. The scope is the PRD topic or the area. See [docs/orchestration.md](docs/orchestration.md#commit-messages).

## Branches

`main` is live, `staging` is what goes live next, and `dev` is where work lands. `main` and `staging` change only by pull request. See [docs/orchestration.md](docs/orchestration.md#branches).
