# Caretook: Project Context

Read this first. It records decisions, conventions and gotchas so a new session can pick up without re-deriving them. Git history has the build logs; this file has what is still true.

Legend: ✅ decided/built · 🟡 proposed, not built · ❓ open.

## Working rules

- **Build only what the user asks for.** Planned work lives in the backlog and in PRDs (below); don't start a PRD or slice until the user says so.
- **No new dependencies without the user's approval.** Pin approved ones exactly.
- **Commit only when the user explicitly asks.** "Run before committing" is not a request to commit. Exceptions: once the user has started a PRD's loops, loops commit on their `slice/` branch and the orchestrator merges them into `prd/<topic>`; and anyone may commit `plans/inbox.md` and `plans/backlog.md` onto `dev` through `pnpm backlog` (see _PRDs and parallel loops_). Never commit anything else on `dev`, `staging` or `main`.
- **All seed and test data is fictional.** Never put real people's health information in the repo, even anonymized.
- Keep this file current: when a slice lands, fold its lasting decisions into the right section and delete anything it made stale.

## PRDs and parallel loops

Feature work goes through a PRD, then a plan cut into slices that loops (parallel agents) pick up. Several PRDs run at once, each with its own orchestrator and branch, and everything planned is tracked in one live backlog.

1. **PRD:** `write-a-prd` (interview, explore, sketch modules), saved as `plans/<topic>-prd.md`, then filed as a GitHub issue. `gh` can't see `caretook/caretook.com` yet (git over SSH works); file the issues once it can.
2. **Plan:** `prd-to-plan` turns the PRD into tracer-bullet vertical slices in `plans/<topic>-plan.md`. Each slice says what it **blocks and is blocked by**, so independent slices can run at once. `prd-to-issues` makes one issue per slice.
3. **Loops:** one agent per slice, each in its own worktree, branch and Docker stack, run by the PRD's orchestrator. See _Running loops_.
4. When a PRD is done, move its lasting decisions into this file and mark the PRD done.

### Branches and roles

| Branch              | What it is                                          | How it changes                                                             |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| `main`              | Live.                                               | Only by PR merge from `staging` on GitHub.                                 |
| `staging`           | What goes live next.                                | Only by PR merge from `dev` on GitHub.                                     |
| `dev`               | Active work, and the trunk every PRD branches from. | The dev keeper merges `prd/` and `plan/` branches; `pnpm backlog` commits. |
| `prd/<topic>`       | One PRD's integration branch.                       | Its orchestrator merges its slices, and syncs `dev` in.                    |
| `slice/<topic>/<n>` | One slice of that PRD.                              | Its loop agent commits.                                                    |
| `plan/<topic>`      | Writing a PRD or plan (docs only).                  | Its agent commits; lands in `dev` like a PRD branch.                       |

- **The dev keeper is the user.** The main checkout is theirs and **always stays on `dev`**. Nobody else works in it; the backlog tool writes `plans/backlog.md` there.
- **A PRD orchestrator** is a top-level session (spawned agents can't spawn more), one per PRD, opened by the user in the PRD's integration worktree `.loops/<topic>`. It reads `dev` but works on `prd/<topic>`. **At most three run at once** (`CARETOOK_MAX_PRDS`).
- **A loop** is one background agent working one slice in `.loops/<topic>-<n>`.
- **Protection** (`.githooks/`, turned on by `pnpm hooks:install`, which sets `core.hooksPath` for every worktree of the clone; `new.sh` runs it too):
  - `main` and `staging`: no commits, merge commits or pushes, and no local moves except a fast-forward to `origin`'s copy (`git fetch && git branch -f main origin/main`).
  - `dev`: only merge commits (landings, including one finished after resolving conflicts) and commits that touch nothing but `plans/inbox.md` and `plans/backlog.md`.
  - The dev keeper overrides with `CARETOOK_ALLOW_PROTECTED=1`, and the hook says it was used. Agents never set it.
  - GitHub rulesets (PRs required on `main` and `staging`) come once `gh` can see the repo.

### The live backlog (`plans/inbox.md` and `plans/backlog.md`)

Everything planned (bugs, changes, features, big plans, questions) lives in two files, **only on `dev`**:

- **`plans/inbox.md` is the user's.** Plain bullets under `##` headings (Bugs, Changes, Features, Big plans, Questions; the heading sets the type), with indented lines for details. No ids or fields.
- **`plans/backlog.md` is the tracker** that agents keep and the user reviews: one item per bullet, with id `B-<n>`, status, PRD, owner, commit and notes, and a summary table at the top.
- **Ingest links them.** `pnpm backlog ingest` files every untagged inbox bullet as a tracker item (status `inbox`) and appends its id to the bullet: `- Login link can be clicked twice (B-1)`. That's the only change agents make to the inbox, so they rarely write while the user is editing it. Editing or deleting a filed bullet doesn't change its item; say so in a new bullet, or change the tracker. `pnpm backlog inbox` shows bullets not filed yet.
  - **When:** orchestrators run it at every wave boundary, and the user runs it whenever they like. Nothing ingests on its own, so a half-typed bullet is never filed.
- **Triage: agents propose, the user reviews.** An orchestrator or planning agent sets a new item's PRD (`set B-<n> prd=<topic> status=triaged`) and adds a note saying why. The user reviews that in the summary table and changes it if it's wrong.

`pnpm backlog` (`scripts/backlog/`) runs from any worktree. Each write takes a lock, edits the main checkout's copies, and commits only those two files onto `dev`, so the lists are live for everyone without merges. The top of `scripts/backlog/backlog.mjs` lists the commands.

- **Who writes:** the user (the inbox, and anything in the tracker), orchestrators, PRD-writing agents and loop agents. Others are writing too, so agents always change the tracker through `pnpm backlog`, which rereads it under the lock, never by writing back a copy read earlier. Hand edits in the main checkout are fine; `pnpm backlog commit` commits them, and the next tool write includes them. Agents may commit backlog changes without asking: that's the only exception to "commit only when asked".
- **Never on your own branch.** Neither file is edited or committed on `prd/`, `slice/` or `plan/` branches; the copies there are stale. Read them with `pnpm backlog list` and `pnpm backlog inbox`.
- **Fields:** type, status, `prd` (the topic it belongs to), `owner` (the branch that claimed it), `commit`, and free notes (`note` appends a dated, signed line).
- **Statuses:** inbox → triaged (has a PRD) → in-progress (claimed) → ready → landed → staging → live, or dropped.
  - `claim B-<n>` takes an item for your branch; **the first claim wins**, and others get an error.
  - `done B-<n>` (by the orchestrator, after merging the slice into `prd/<topic>`) records the commit and sets ready.
  - From then on the status is **worked out from git**: landed once `dev` contains the commit, staging and live once `origin/staging` and `origin/main` do. `list` shows it; `refresh` fetches and writes it.
- **The PRD table** at the top (topics, dependencies, hot files) says which PRDs can run at the same time. Change it when you add, reorder or finish a PRD.
- Orchestrators run `pnpm backlog ingest` and reread the backlog **at every wave boundary**. A new item for a running PRD becomes a slice in a later wave; a running slice never changes scope.

### Running loops

**Isolation** (`scripts/loops/`; `lib.sh` holds the shared parts):

- `new.sh <kind> …` makes a worktree in `.loops/`:
  - `new.sh prd <topic>`: `.loops/<topic>` on `prd/<topic>` from `dev`, with a stack. It prints the command that starts its orchestrator.
  - `new.sh slice <topic> <n>`: `.loops/<topic>-<n>` on `slice/<topic>/<n>` from `prd/<topic>`, with a stack.
  - `new.sh plan <topic>`: `.loops/plan-<topic>` on `plan/<topic>` from `dev`, **without** a stack.
  - Options before the kind: `--slot N`, `--stack`/`--no-stack`, `--base B`. If the branch already exists it's checked out instead, which resumes a removed worktree.
- **Slots.** A stacked worktree **leases the lowest free slot (1–19)**: lock directories in `.loops/.slots/<N>`, taken atomically, so two orchestrators never get the same one. A slot is also busy while a worktree's `.env` names it or one of its ports listens.
  - Ports: slot N in 1–9 is web 6N73, Postgres 6N34, test Postgres 6N35, PowerSync 6N80. Slots 10–19 use 7(N−10) in place of 6N (7073 … 7980). CDP and proxy ports shift by N×1000. Compose projects are `caretook-loopN` and `caretook-loopN-test`.
  - The files it writes (all gitignored): the root `.env` (Compose's project name and ports), `packages/data/.env` and `.env.test.local` (database URLs and `PG_TEST_PORT`), `apps/web/.env` (auth and PowerSync URLs, `WEB_PORT`), and `.env.loop` (`SLOT`, `BASE_BRANCH`, `BASE`, `CDP_PORT_OFFSET`, `PG_CONTAINER`, `SEED_USER_PASSWORD`). Secrets are copied from the main checkout's `packages/data/.env` and `apps/web/.env`.
  - Without a stack, `.env.test.local` points at a closed port, so `pnpm test:integration` fails instead of reaching the main checkout's test database. Run `typecheck`, `lint`, `format:check` and the unit projects there.
- `ls.sh` lists every worktree: slot, branch, commits ahead of the branch it merges into, dirty or clean, its stack, the PRD count against the cap, and stale leases.
- `rm.sh <name> [--force] [--keep-branch]` stops the worktree's containers, deletes its database files, removes the worktree and releases its slot. Then it **deletes the branch if it's merged** into its parent (`slice/…` into `prd/<topic>`; `prd/` and `plan/` into `dev`), and keeps it otherwise. It refuses uncommitted changes, and a PRD worktree whose slices still have worktrees, unless `--force`.
- `prompt.sh orchestrator <topic>` and `prompt.sh slice <topic> <n>` print the first prompt for those sessions.
- The main checkout keeps the default ports (5173, 5434, 5435, 8080).
- Every port, the Compose project name and the PowerSync audience come from env, defaulting to the main checkout's values. If you add a service, a port or a hardcoded container name, make it configurable the same way.

**Capacity.** One stack uses about 250 MB idle (the Docker VM has 16 GB), so the limits are CPU and attention: `pnpm check`, Vite and Chrome on 10 cores, and each orchestrator's context. Three PRDs with two or three slices each, plus their integration worktrees, is about 12 slots. Stagger `pnpm check` runs when several loops finish together. Six busy stacks at once (three loops plus two other PRDs) pushed the load average past 500: `pnpm check` took 25 minutes, tests hit their 5 s timeouts, and sign-ins in browser checks timed out. Rerun a failure like that once the load drops before debugging it.

**Starting a PRD (the user):**

1. `scripts/loops/new.sh prd <topic>` from any worktree.
2. In a new terminal, run the command it prints: `cd .loops/<topic> && claude "$(scripts/loops/prompt.sh orchestrator <topic>)"`.

**Keep each orchestrator's context small.** One session runs one wave at most; the user starts a fresh one for the next.

- It works from its plan's _Status_ section, the backlog, the loops' hand-offs, `git diff --stat` and `pnpm check` output. It doesn't read whole diffs or debug inside a loop: it sends the problem back to that loop's agent with SendMessage.
- Before it ends, it updates its plan's _Status_ section (what's merged, with SHAs; what's ready; open issues) and its backlog items. Those are the hand-off to the next orchestrator.

**PRD orchestrator, per wave:**

1. Read your plan and `pnpm backlog list --prd <topic>`. A slice is **ready** when every slice it's blocked by has been merged into `prd/<topic>`. Start only what the user asks for, and `claim` its items.
2. For each ready slice: `scripts/loops/new.sh slice <topic> <n>`.
3. Spawn one background agent per slice (not with `isolation: worktree`; it already is one), with the prompt from `scripts/loops/prompt.sh slice <topic> <n>` plus anything the slice needs that the plan doesn't say.
4. As each loop hands off, review its branch: `git diff prd/<topic>...slice/<topic>/<n>`, its hand-off, and that the acceptance criteria are covered.
5. Merge **in plan order** into `prd/<topic>`, in your integration worktree, with `git merge --no-ff slice/<topic>/<n>`. Resolve conflicts in the shared files yourself. After each merge, run `pnpm check` and the browser checks the merged slices touch, there. Fix it or send it back before merging the next one.
6. Once merged: `pnpm backlog done B-<n>` for its items, then `scripts/loops/rm.sh <topic>-<n>` (it deletes the merged branch). Start the slices it unblocked.
7. **Land the wave** when it's green. Don't wait for the whole PRD: small, frequent landings keep PRDs from drifting apart.

**Landing a wave in `dev`:**

1. **The orchestrator syncs first.** In its integration worktree: `git merge dev`. It resolves conflicts there (it has the context), regenerates its migration if `dev` gained one, runs `pnpm datastore:reset`, `pnpm check` and the PRD's browser checks, and commits.
2. It tells the user it's ready: the branch and its SHA, what the wave adds, any migration, seed or sync-config change, and the check output. It never merges into `dev` itself.
3. **The user merges** (`git merge --no-ff prd/<topic>` on `dev`), one branch at a time. If `dev` moved since the sync and the merge conflicts, the user aborts it and asks the orchestrator to sync again. Afterwards: `pnpm datastore:reset` and `pnpm check` in the main checkout.
4. Other orchestrators merge `dev` into their branch at their next wave boundary, not mid-wave.
5. When a PRD is finished and landed, `scripts/loops/rm.sh <topic>` removes its worktree and deletes `prd/<topic>`.

**Rules across PRDs** (they keep many PRDs mergeable):

- **Migrations take the next number when they land, not when they're planned.** Plans say "adds a migration", not "0008". A loop generates whatever is next on its base. When a sync brings in another PRD's migration, keep `dev`'s, regenerate yours on top (`pnpm datastore:generate`), and reread its SQL order. Keep one pending migration per PRD where you can.
- **Seeds are append-only.** `timelineEntries.ts` ids follow position, so never insert in the middle: append at the end, or give a new feature's seeds their own file and ids.
- **Additive edits to shared registries.** In `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, the `sync.ts` upload switch, `routes.ts` and `KIND_META`, add entries at the end of their group and never reorder or reformat, so concurrent additions merge as adjacent hunks.
- **Hot files get regions first.** When two PRDs will change one screen (the backlog's PRD table lists hot files), a small slice first splits it into regions or components that each PRD fills (as `EntryHeader` did for live notes), and lands before both.
- **AGENTS.md:** loops never edit it. An orchestrator edits it at landing only, to fold in that wave's lasting decisions, and keeps in-flight status in its plan.

**Loop rules** (`prompt.sh slice` points every loop here):

- Work only inside your worktree. Run `source ~/.nvm/nvm.sh && nvm use` in every shell (Node 24; browser checks need its global `WebSocket`).
- Your stack is your own. Run `pnpm datastore:reset`, `pnpm test`, `docker compose …` and `pnpm dev` freely from your worktree; they use your ports. Never touch the main checkout, other worktrees or other Compose projects.
- Run `pnpm dev` in the background (`WEB_PORT` pins the port). Before browser checks: `set -a; source .env.loop; set +a`. New browser checks use `process.env.PG_CONTAINER` for `psql`, and launch Chrome and proxies through `cdp.mjs` and `proxy.mjs` (which apply the offset), never fixed container names or ports.
- After editing `powersync/sync-config.yaml`, restart your own PowerSync: `docker compose restart powersync`.
- Follow the rules across PRDs (migrations, seeds, registries). Edits to shared files stay small and are listed in the hand-off. Don't edit AGENTS.md, and change the backlog only through `pnpm backlog note`.
- No new dependencies. All data stays fictional.
- When `pnpm check` and the slice's browser checks pass, **commit on your `slice/<topic>/<n>` branch** (coherent commits, ending with the attribution line). Don't merge, rebase or push any other branch, and never set `CARETOOK_ALLOW_PROTECTED`.
- **Hand-off** (the final message): what was built, grouped by area, with every shared-file edit called out; each acceptance criterion marked met or not met, with evidence; the `pnpm check` and browser-check output; anything skipped or surprising that later slices need; and the commit SHAs.

**Gotchas:**

- The first visit to a route on a fresh loop can make Vite re-optimize dependencies and reload the page mid-check. If a browser check times out on its first run, run it once more before debugging.
- Merging two branches that each generated a migration conflicts in drizzle's `meta/_journal.json` and snapshots. Keep the one already in the target (`dev`'s, at a sync), then regenerate yours on top (`pnpm datastore:generate`) and recheck its SQL order.
- After a merge or sync that changes seeds or migrations, run `pnpm datastore:reset` in that worktree; the merged seeds can differ from either side's.
- **Running `new.sh` for several worktrees at once** can fail at migrate with "Connection terminated unexpectedly": a fresh Postgres restarts once after its first-boot init. The containers are fine; rerun `pnpm datastore:start && pnpm datastore:start:test` in each.
- **The first check run after a `datastore:reset` or a PowerSync restart** can fail on a PowerSync 401 (the JWKS refetch) or slow first sync (`live-notes.mjs` timing steps). Rerun once before debugging.
- **PowerSync can keep the old JWKS for minutes after a `datastore:reset`** ("no key matched the token KID", PSYNC_S2101), and pages then wait on `waitForFirstSync`. Run `docker compose restart powersync` after a reset.
- **Merges can break another slice's browser check** without either slice being wrong (live notes slices 4 and 8 both filled the header's `actions`). Run every merged slice's check after each merge, not only the new one's.
- **Long-running dev servers** can serve stale optimized deps after merges ("Invalid hook call"). Run merged checks against a freshly started server.
- **Recent-editor state outlives a reset in PowerSync's bucket storage** (not cleared by `datastore:reset`): right after a reset it can still serve editors with the old user ids ("Former member"). Restart PowerSync and give it a minute before `live-notes.mjs`. (Its own "who's typing" steps don't need a quiet group: it ages only its own documents.)

### Active PRDs

The backlog's PRD table lists them all, with their dependencies.

- ✅ [`plans/live-notes-ux-prd.md`](plans/live-notes-ux-prd.md) (topic `live-notes-ux`): **done**, all ten slices in `dev`. Notes and events _are_ their live document: Note/Event opens the editor in one tap, the entry is saved on the first keystroke, and others join in one tap through a row tap, the Live now banner, a live dot or a Share link. Its lasting decisions are under _Timeline entries_ and _Live notes_; follow-ups are in _Next steps_.
- 🟡 [`plans/quick-fixes-plan.md`](plans/quick-fixes-plan.md) (topic `quick-fixes`, no PRD): small standalone fixes, one slice and one backlog item each, appended as they come. **Slices 1–3 (B-1, B-17, B-22) are in `dev`**; nothing is in flight. `prompt.sh` handles a topic without a PRD file.
- 🟡 [`plans/app-shell-prd.md`](plans/app-shell-prd.md) (topic `app-shell`): the `/app` frame, the user menu, the group menu and switcher, group sections, and group settings. Sliced in [`plans/app-shell-plan.md`](plans/app-shell-plan.md). **Slices 1–4 (the frame, the user menu with theme, the group menu with the last group, and the sections nav with the tab bar) are in `dev`** once wave 2 lands. Slice 5 (group settings: details) runs next, then 6 (members); 7 (timeline layout in Settings) can run any time. `timeline-polish`, `providers` and `medications` build on the frame.

## Product

Caretook (caretook.com) is a mobile-responsive set of tools that help caretakers manage someone else's care, possibly packaged later with Capacitor. Feature areas (for stack decisions only):

- **Care timeline:** daily entries, symptoms, vitals and events. Real-time **and** offline sync between users is a hard requirement.
- **Medication list:** current, past and discontinued, plus a printable sheet.
- **Provider and contact directory.**
- **Later:** AI (reviewing timelines, appointment notes, questions for visits), and calendar (iCal feeds, Google Calendar).

## Stack

- ✅ **TypeScript 5.9** everywhere, with types inferred from backend to frontend (no codegen).
- ✅ **pnpm 12.21.0** workspaces (`apps/*`, `packages/*`) on **Node 24 LTS** (`.nvmrc`; run `nvm use`, since the machine default is older).
  - Settings live only in `pnpm-workspace.yaml`; pnpm 11+ ignores `.npmrc` and the `"pnpm"` field, and fails on unknown keys.
  - Keep `minimumReleaseAge` at its default (a supply-chain guard). If a package is too new, wait a day.
  - Build scripts need `allowBuilds`. Only `esbuild` is approved.
  - Check that the first Vercel deploy really runs pnpm 12 (the lockfile says `lockfileVersion: '9.0'`).
- ✅ **Lint, format and test** (root):
  - **ESLint 10**, flat config, type-aware `typescript-eslint` (`recommendedTypeChecked` with `projectService`), `consistent-type-imports`, `react-hooks` and `jsx-a11y` (it runs on ESLint 10 despite its peer range; don't switch to the `-x` fork without the user).
  - **Prettier 3** on its own (`printWidth` 110), with `eslint-config-prettier`.
  - **Vitest 5** projects in the root `vitest.config.ts`:
    - `data:unit` runs `*.test.ts` with no database.
    - `integration` runs every package's `*.int.test.ts` against the test Postgres on :5435. Its globalSetup clears and migrates once per run, refuses any other host or port, and runs files one at a time. Tests build their own fixtures (`packages/data/test/fixtures.ts`).
    - `web:unit` runs apps/web's pure `app/**/*.test.ts` (no PowerSync; apps/web's vite.config isn't loaded, so tests import relatively, not through `~/`).
- ✅ **React Router 8.5.1** (framework mode) with Vite 8, chosen over Next.js and TanStack Start: reads come from the local sync database, so server-centric frameworks gain little.
- ✅ **UI:** Tailwind v4 + **daisyUI 5** for styling, **React Aria Components** only where HTML falls short (DateField, Menu, Modal, ComboBox…), and `lucide-react` icons. Mobile-first, with daisyUI themes following the device.
  - Prefer native elements (`<dialog>` with `showModal()` for simple confirms).
  - Wrap repeated daisyUI + RAC pairs in `app/components/`.
- ✅ **Drizzle ORM 0.45** (`pg`), `drizzle-zod` and **Zod 4**; **oRPC 1.16.2**; **Better Auth 1.7.25**; **PowerSync** (web 2.7.0, drizzle-driver 0.8.0); **Yjs 13.6.33** and **Tiptap 3.34.0**.
- ❓ Turborepo.
- 🟡 Later: Playwright (+ `@axe-core/playwright`), Capacitor (`webDir` = `apps/web/build/native/client`), the Vercel AI SDK with Claude, print CSS (then `@react-pdf/renderer` if needed), an iCal feed and Google Calendar OAuth.

## Architecture

### Two build targets, one codebase

- `BUILD_TARGET` (`apps/web/build-target.ts`) selects the target:
  - **web** (the default) is SSR on Vercel, output in `build/web/`.
  - **native** is a static SPA (`ssr: false`) in `build/native/client/`, which is what Capacitor ships.
- `app/routes.ts`:
  - `/app/*` and `/sign-in` and `/sign-out` are shared by both targets.
  - `/`, `/api/auth/*` and `/rpc/*` are web only.
  - Native `/` redirects to `/app`.
- **Shared routes never export a server `loader` or `action`.** They use `clientLoader`/`clientAction`, read the local sync database, and call oRPC for anything server-side. The native build fails on violations ("SPA Mode: invalid route export(s)"). Web-only routes may use server loaders.
- `HydrateFallback` may only be exported from `root.tsx` (SPA mode).
- Why: Capacitor has no server, and pointing it at the live URL breaks offline use and risks App Store rejection (guideline 4.2).

### API: `packages/api` (oRPC)

- Chosen over tRPC for OpenAPI output (AI tools, MCP, integrations), contract-first, files and streaming, and fetch, Node and Lambda adapters. It has no runtime dependency, so it mounts in a resource route, runs directly from server loaders, or runs in an AWS worker.
- **Procedures:** `publicProcedure`/`authedProcedure` with context `{ authUser }`, resolved by the mount point (`getAuthUser`). Procedures never read requests.
- **Errors:** handlers call services and `unwrap()`. `toORPCError` maps an AppError's `statusCode` (400/401/403/404/409) to an oRPC code with `data: { code, issues? }`. Anything else becomes a logged, generic 500.
- **DTOs:** `dto.ts` turns timestamps into ISO 8601. Inputs reuse the client-safe Zod schemas from `@caretook/data/schema`.
- **Public profiles only:** `careGroup.members` returns name, image and role, never email. Keep it that way for new procedures.
- **HTTP:** `createRpcHandler({ prefix, allowedOrigins })`:
  - CSRF through `SimpleCsrfProtection` (the client link sends `x-csrf-token`).
  - CORS for Capacitor's origins and `AUTH_TRUSTED_ORIGINS` only.
  - GET is refused.
- **Mounting:** apps/web mounts it at `/rpc/*` through `app/.server/api.ts`. The browser client (`app/lib/rpc.ts`) uses a type-only router import and sends cookies.
- **Procedures:**
  - `me.get` and `me.updatePreferences`;
  - `careGroup.listMine` and `careGroup.members`;
  - `timeline.list`, `create`, `update`, `remove` and `latestVitals`;
  - `sync.upload`.

  No screen calls the timeline or careGroup reads now (screens read local data); they stay for API, AI and worker use.

- **Notes' and events' text:** `timelineEntryService.getById`/`list` (and so `timeline.list` and `timeline.update`) fill a note's or event's `body` from its document's **compacted** `text` (`withDocumentText`, one query in the actor's scope). No document or empty text → the stored body (null). Deleted entries never get their text. Pending updates are only in `noteDocumentService.currentText`.

### Data layer: `packages/data` (`@caretook/data`)

- **Entry points:**
  - `@caretook/data` is **server only**: never import the root from client code.
  - `/schema`, `/errors` and `/permissions` are client-safe.
  - In apps/web, server code imports through `app/.server/data.ts`.
- **Layers, bottom up:**
  - `errors/`: typescript-errors, with every code in `errors/constants.ts`. Errors are **returned, not thrown**; narrow with `isError()`. Wrap db calls as `dbMayFail(() => …, code)`.
  - `permissions/`: `PERMISSIONS[table][create|read|update|delete|list][role] = all | owned | none | { group: [...] }`, plus `ownerField` and field-level write restrictions.
    - Roles are `admin` and `member` (`user.role`), `system` and `unauthenticated`. A resolved scope is `all` or an OR of `owned`, `group` and `groupUser` rules.
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
- **Migrations:** generated into `src/db/migrations/` and applied in-process (`src/db/migrate.ts`). There are 0000–0007 so far.
  - **drizzle-kit can emit a unique constraint after the FK that needs it.** Read the generated SQL and reorder by hand.
  - Until the first deploy it's fine to delete and regenerate migrations.
- **DB client:** the pool is created lazily (importing never needs `DATABASE_URL`). Only the **pool** survives HMR (`utils/remember.ts`); the drizzle wrapper is rebuilt, so new tables work without a restart.
- **Env:** `loadEnv.ts` loads `.env.<NODE_ENV>`, then `.env`, from `packages/data` (Node's `process.loadEnvFile`). Real env vars win. `.env.test` is committed; `.env` isn't (copy `.env.example`).
- **Local Postgres:** Docker `postgres:18.7-alpine` with `wal_level=logical`, dev on :5434 and test on :5435, data in `.postgres/`.
  - `datastore:clear` refuses a non-localhost database, and drops the publication.
  - `datastore:seed` refuses production and uses `@example.com` accounts only.
- ❓ The hosted database (same region as Vercel functions, with pooling), and how production migrations run.

### Auth: `packages/auth` (Better Auth)

- **Tables:** it adopts our `user` table, and `session`/`account`/`verification`/`jwks` live in `db/schema/auth.ts`. These are exceptions to the table conventions:
  - **no audits**;
  - **date-mode timestamps** (Better Auth compares `Date`s, and string mode silently breaks expiry);
  - `system`-only permissions.
- **Ids and extra fields:** ids come from `generateId: "uuid"` (the Postgres default). `role`, `createdBy` and `updatedBy` are `additionalFields` with `input: false`, defaulting to `SYSTEM_USER`.
- **Settings:** `emailAndPassword` with `disableSignUp: true` and a 12-character minimum; telemetry off; `trustedOrigins` = Capacitor's origins + `AUTH_TRUSTED_ORIGINS`.
- **Plugins:** `bearer()` (native), and `jwt()`: 15-minute EdDSA tokens with `sub` and `role`, JWKS at `/api/auth/jwks`, and `aud` = `POWERSYNC_URL`.
- **Exports:** `getAuth()` (lazy) and `getAuthUser(headers)` → `AuthUser` with `groupRoles`. `@caretook/auth/client` has `createCaretookAuthClient`. apps/web imports through `app/.server/auth.ts` and `app/lib/auth-client.ts`.
- **Routes:** `/api/auth/*` is web only. `/sign-in` and `/sign-out` are shared and client-only (sign-out is POST only). `/app/layout.tsx` redirects to `/sign-in?redirectTo=…`, checked by `safeRedirect`. The sign-in button stays disabled ("Signing in…") while any navigation is non-idle, so it can't be pressed again during the redirect's loaders.
- **Dev:** seeds give every `@example.com` user a password from `SEED_USER_PASSWORD` (`packages/data/.env`), hashed with `better-auth/crypto` (a dev dependency). The env is in `apps/web/.env`; `vite.config.ts` also loads `packages/data/.env`.
- 🟡 **Resend** next: verification, reset, invites, maybe magic link or OTP. Keep `requireEmailVerification` off until then, and don't build UI that assumes passwords are the only sign-in method.
- ❓ Before launch:
  - rate-limit storage (the default is in-memory, per serverless instance);
  - native bearer storage (secure storage) and `VITE_API_ORIGIN`.

### Sync: PowerSync

- Postgres is the source of truth. Each device keeps a SQLite copy, and writes upload through **our** API (`sync.upload`), so permissions, validation and audits all apply.
  - Ruled out: Zero (offline writes), ElectricSQL (read-only sync), Convex (offline, lock-in), and InstantDB, Triplit and Jazz (control).
- **Hosting:** PowerSync Cloud in production; locally the `journeyapps/powersync-service:1.28.3` container on :8080, with bucket storage in its own Postgres (`.postgres/powersync-storage`).
- **Sync Streams** (`powersync/sync-config.yaml`, edition 3; Sync Rules are deprecated). **Queries list their columns explicitly**, so a new column must be added there too.
  - `care_groups`: one bucket per group the user belongs to. It carries `care_group`, `care_group_member`, `care_recipient` (names only), `timeline_entry` (including soft-deleted rows), `note_document` and `note_update`.
  - `member_profiles`: co-members' `id`, `name` and `image`.
  - The service reads the file at startup: run `docker compose restart powersync` after editing it.
- **Publication** (`powersync`): the care tables plus `"user" (id, name, image)`. The column list keeps emails, roles and preferences out of replication.
- **Local JWKS:** the service fetches `PS_JWKS_URL` (default `http://host.docker.internal:5173/api/auth/jwks`). Docker Desktop forwards only to the host's IPv4 loopback, so Vite binds `127.0.0.1` and allows that Host header. After `datastore:reset`, expect one 401 while it refetches the regenerated keys.
- **Upload** (`packages/api/src/sync.ts`): up to 100 CRUD ops, in order, mapped onto **services**.
  - `timeline_entry`:
    - PUT → `upsert` (idempotent on id). A changed group, kind or recipient → `immutable`, and an id in a group the actor can't see → `unauthorized`.
    - PATCH → `update`, or `remove` when it sets `deleted_at`.
    - DELETE → `remove`.
  - `note_document`/`note_update`: PUT → `create`/`appendUpdate`. Anything else → `sync:readOnlyTable`.
  - Other tables → `sync:readOnlyTable`.
  - 4xx outcomes are acknowledged as rejected, and the next sync restores the server's copy. Other errors throw, so the batch retries.
  - After each batch, touched documents are compacted when due (best effort).
- **Timestamps:** PowerSync syncs timestamptz as `2026-11-17T21:45:25.229000Z`. Local writes use exactly that form (`toLocalTimestamp`), so strings sort correctly; `fromLocalTimestamp` parses either form.
- **Device** (`apps/web/app/lib/sync/`):
  - `schema.ts`: Drizzle sqlite tables → `DrizzleAppSchema`.
  - `client.ts`: the database and connector, **loaded lazily** (never imported statically).
    - One user's data per device: the owner is in localStorage, and the file is wiped when someone else opens it.
    - Sign-out runs `disconnectAndClear`, then deletes the IndexedDB/OPFS file.
    - `fetchCredentials` calls `/api/auth/token`. A 401 leaves the device local-only.
  - `index.ts`: `openSync`, `getSync`, `closeSync`, `waitForFirstSync`, `isFirstSyncDone`, `useFirstSyncDone`, `useLiveQuery` and `useSyncState`. Dev builds expose `window.caretookSync`.
  - **The first sync** (measured at about 120–200 ms after the database opens locally): `waitForFirstSync(db)` waits at most 1 s (`FIRST_SYNC_WAIT_MS`) and resolves to `isFirstSyncDone(db)`. That's PowerSync's `hasSynced`, which persists with the local copy, so it's true at once on a synced device and offline. `useFirstSyncDone()` is the hook (below the /app layout only). Use it for anything that needs the local groups, such as a last-group redirect.
    - A loader whose group isn't on the device throws `notOnDevice(db)` (`lib/firstSync.ts`): a 404 once the first sync is done, otherwise a 503 "First sync pending" that `/app`'s `ErrorBoundary` shows as `FirstSyncPending` ("Getting your care groups…"), which reruns the loaders when the sync lands. `home` shows the same state while `synced` is false, and never says "not in a care group" before then.
  - `timeline.ts`: local queries, row → API-shape mapping (unknown kinds are skipped), and local writes. Writes validate with the shared Zod schemas, check the role locally, and update content columns only.
  - `lib/session.ts` `requireSession(request)`: one shared session check and DB open, because layout and child loaders run in parallel. Offline, the cached last user carries on.
  - `lib/me.ts` caches settings per user (they aren't synced). **Change them with `saveSettings(userId, change)`**: it caches at once, records the change as pending (`caretook:settings-pending:<userId>`), and calls `updatePreferences`, resolving `"saved"` or, on a network failure, `"pending"`. Other errors reject (a refused change is dropped). `loadSettings` sends pending changes before reading `me.get`; offline it returns the cache with them on top. The last write wins across devices. `forgetSettings` (sign-out) clears pending changes too.
- **Conflicts:** last write wins per row. Live notes merge through Yjs.
- ❓ **Production:** a dedicated replication role with column-limited grants, `sslmode: verify-full`, the Cloud instance, and how Cloud reaches the JWKS.
- 🟡 Not built:
  - **Offline web reload** needs a service worker. Offline already works within a loaded session, and will in Capacitor.
  - `/app/settings` is still online only.
  - Group removal dropping its buckets is untested end to end.

### Hosting

- 🟡 **Vercel** for request/response work (CRUD, auth, uploads, calendar cron and webhooks). **AWS** for long-running work (AI jobs on SQS with Lambda or ECS, and the sync service if self-hosted).
- Live appointment audio would go from the client straight to the AI provider, with a short-lived token.
- Costs of the split: JWT auth that works everywhere, CORS, Postgres pooling, and functions in the database's region.

## Domain

### Care groups

The shared space for the caretakers of one care recipient. Always say "care group" (never "care circle").

- **Tables:**
  - `care_group` (`name`).
  - `care_group_member` (`group_id`, `user_id`, `role`, unique per pair).
  - `care_recipient`: a profile, not an account; 1:1 through a unique `group_id`, so drop that constraint to allow several.
  - `care_group_invite` (email, role, SHA-256 `token_hash`, status `pending|accepted|declined|revoked`, `expires_at`, `accepted_by`; at most one pending invite per group and email).
  - Deleting a group cascades to everything in it. Deleting a user cascades to their memberships.
- **Two role systems:** global (`admin`, `member`) covers account access only. Group roles on the membership are `owner`, `admin`, `caretaker` and `viewer`. **Writers** = owner, admin and caretaker.
- **Permissions:**

  | Table             | read/list                                 | create                             | update                     | delete                            |
  | ----------------- | ----------------------------------------- | ---------------------------------- | -------------------------- | --------------------------------- |
  | care_group        | any member                                | any signed-in user (becomes owner) | owner, admin               | owner                             |
  | care_group_member | any member                                | owner, admin                       | owner, admin (role only)   | owner, admin, or yourself (leave) |
  | care_recipient    | any member                                | owner, admin                       | owner, admin, caretaker    | owner, admin                      |
  | care_group_invite | owner, admin                              | owner, admin                       | owner, admin (status only) | owner, admin                      |
  | user              | self, staff, **co-members** (incl. email) | staff                              | self (no role/email)       | self, staff                       |
  | timeline_entry    | any member                                | writers                            | writers                    | writers (soft)                    |
  | note_document     | any member                                | writers (snapshot/text system)     | system                     | system                            |
  | note_update       | any member                                | writers                            | system                     | system                            |
  - `system` has `all` everywhere.
  - Ids that point at the group can't be changed except by `system`.
  - **Staff get no default access to care data.** Support access, if ever needed, will be an explicit, audited grant.

- **Write memberships and invites through the services**, because they enforce what the map can't:
  - `careGroupService.create` makes the creator the first owner.
  - Only owners add, promote, demote or remove owners. A group keeps at least one owner (owner rows are locked `FOR UPDATE`).
  - `careGroupInviteService.create` (only owners invite owners) returns the raw token once (7-day expiry). `revoke` withdraws a pending invite.
- **Seeds:** "Dev Family" (recipient Grandma Pat), with member@ as owner, caretaker@ as caretaker and viewer@ as viewer. "Dev Family 2" (`seeds/secondGroup.ts`, recipient Grandpa Lou, five entries with their own ids) has member@ as its only member, so member@'s `/app` is the group list on a fresh device; caretaker@ and viewer@ have one group each. admin@ is deliberately not a member.

### Timeline entries

- **Table:** one `timeline_entry` table with a `kind` column.
  - `group_id` is on the row, because streams filter on it. `recipient_id` is there too, for several recipients later.
  - A composite FK `(group_id, recipient_id) → care_recipient`, which is `NO ACTION`: deleting a recipient with entries fails, but deleting the group still cascades.
  - `occurred_at` plus the device's IANA `time_zone`.
  - Optional `title`, `body`, and kind-specific `details` jsonb (a Zod discriminated union).
- **Rules:**
  - **Soft delete** (`deleted_at`), checked against the delete permission. Reads hide deleted rows unless `includeDeleted` is set, `update` refuses them. There is no purge function yet; a hard delete cascades to the entry's document.
  - **Keyset pagination** on `(occurred_at, id)`, because offline devices insert older entries.
  - `create` defaults `recipientId`, and checks the group first, so a non-member learns nothing.
  - `update` validates the **merged** row.
  - `occurredAt` reads back as Postgres text (`2026-11-17 10:00:00.000+00`); normalise it at the API.
- **Kinds.** When someone proposes a new thing to log, place it with these definitions first:
  - **Note:** free text about the day. **Its text is its live document**: `body` is always null (the content rules reject one), and the title is optional. Written at `/entries/:id`, not in the sheet.
  - **Symptom:** something the recipient **feels or reports**, or a problem described in words: a free-text `name` plus `severity` 0–10. **Pain is a symptom.**
  - **Vital:** something **measured, counted or observed**, with a fixed unit or scale. Without one (mood, confusion), it's a symptom. Bowel movement, urine output and sleep are vitals.
  - **Event:** something that happened (a visit, a fall, a pickup). Like a note, **its text is its live document** (`body` is always null) and it's written at `/entries/:id`. A title is required: the device saves `"Event"` (`DEFAULT_EVENT_TITLE`) when none is given, and the title field then shows empty with "Add a title" (`isUnnamedEvent`, `titleField`). Appointments (with place and provider) come later.
- **Vitals** (`db/schema/vitals.ts`, the single spec):
  - `details = { readings: [...] }`, at most one per type.
  - Types: `bloodPressure` (diastolic < systolic), `heartRate`, `temperature`, `spo2`, `respiratoryRate`, `weight`, `bloodGlucose`, `bowelMovement` (Bristol 1–7), `urineOutput` and `sleep` (0.25 h steps).
  - **Adding a type:** a `VITAL_TYPES` entry, a `VITALS` entry and one `reading(...)` line; new field keys also go in `VitalFieldSpec["key"]`.
  - Stored in canonical units (°C, kg, mg/dL, mL). Display and entry use the user's units: the form posts the units it showed, and `fromDisplay`/`toDisplay` convert.
  - Hard limits reject a value. A value outside the typical range gets the warning "That's unusual. Double-check it" but still saves.
  - `isKnownReading()` skips types this build doesn't know (forward compatibility across app versions).
  - Readings are jsonb, not a child table; charts can use `json_extract` locally.
- **User preferences:** `user.preferences` jsonb (`userPreferencesZSchema`, every field optional, so new settings need no migration).
  - `units`, via `resolveUnits()`, defaulting to °F, lb, mg/dL and mL.
  - `timelineView` (`rows | cards`), via `resolveTimelineView()`.
- **The `/app` frame** (`routes/app/layout.tsx`, a hot file): fixed regions that slices and PRDs fill through their components, never by restructuring the layout:
  - header `group` (left): the Caretook link, then `GroupMenu` on group routes;
  - header `sections` (`hidden sm:flex`): `SectionNav` on group routes;
  - header `status`: `SyncIndicator`;
  - header `user`: `UserMenu`;
  - the outlet, then `TabBar` (phones, group routes).
  - The `groupId` comes from `useParams()`; screens outside a group (`/app`, `/app/settings`) get the header only.
  - **`UserMenu`:** a RAC menu on the avatar ("Account menu for …"): a name and email header, Settings, a **Theme** section (System, Light, Dark; its own `MenuSection` with `selectionMode="single"`, so its items are `menuitemradio`), and Sign out (POST to `/sign-out`).
  - **Theme** (`lib/theme.ts`): per device in `caretook:theme`, never sent to the server, and kept at sign-out. Light and Dark set `data-theme` on `<html>`; System removes it (and stores nothing), so daisyUI follows `prefers-color-scheme`. `THEME_SCRIPT`, inline first in `root.tsx`'s `<head>` (both targets), applies it before first paint; `<html>` has `suppressHydrationWarning` for it. Storage that throws falls back to System. (With storage blocked, React Router's own `ScrollRestoration` script throws a `SecurityError`; not ours.)
  - **`GroupMenu`:** the current group's display name (recipient's preferred name or name, then the group name) as a RAC menu ("…: switch care group") listing every local group (live, offline), the current one checked (`menuitemradio`); choosing one opens its timeline. "Group settings" goes at the marked comment (slice 5). It reads the user id from the layout's loader data (`useRouteLoaderData`), not `getSync()`, which throws while signing out.
  - **Last group** (`lib/lastGroup.ts`): a group route you're a member of is saved as `caretook:lastGroup:<userId>`; sign-out runs `forgetGroups()`. `/app`'s loader redirects by the pure `resolveHomeGroup({ groups, remembered })`: the remembered group if you're still in it, else the only group, else the list.
  - **Group sections** (`lib/groupSections.ts`): `GROUP_SECTIONS`, an ordered `{ id, label, icon, path(groupId), match(subpath) }` list (Timeline only; `match` also claims `/entries/*`). **A later PRD adds a section by appending one entry and its route**; the shell needs no edit. `SectionNav` (header links) and `TabBar` (a daisyUI `dock`, `sm:hidden`, `z-40`) render it with `aria-current` (`"page"` on the section's page, `"true"` inside it). Both navs are named "Group sections"; only one shows. The bar is hidden on `/entries/*`; elsewhere it renders an in-flow spacer of `--tab-bar-height` (`app.css`), so screens never offset for it. Anything else fixed to the bottom of a group screen offsets by that variable. Modals (`z-50`) cover it.
  - **Avatars:** `UserAvatar` (image, or initials if it's missing or fails to load) is shared by the user menu and `EditorAvatars`. `lib/initials.ts` has `initials(name)` and `userInitials({ name, email })` (name, then the email's first letter, then "?"). `SessionUser` carries an optional `image`.
- **Timeline screen** (`/app/groups/:groupId/timeline`):
  - Rows (the default) or cards, both rendered from `entrySummary()`.
  - Kind icons and colors in `KIND_META`. Vitals are pink, **not green** (green reads as "all good").
  - Sticky day headers.
  - `?kind=` filter chips.
  - A latest vitals strip (`json_each` locally).
  - Quick-add: **Note** and **Event** link to `/entries/new?kind=…`; Symptom and Vitals open `EntrySheet` (a RAC Modal; a bottom sheet on phones) with `EntryForm` (symptoms and vitals only), and edit uses the same sheet. A note's or event's row body is its document preview.
  - **Live now** (`LiveNowBanner`, between `LatestVitals` and `QuickAddBar`, viewers too): "<names> is writing · <title> · +N more" with a **Join** link, for the most recently edited document others are writing in; one polite `role="status"` announcement per document. Rows and cards show a `LiveDot` (`pointer-events-none`, so taps reach the open target; static under reduced motion; sr-only "Being written now by …"). Both come from `useLiveDocuments` and expire with the recent-editors window. The wording is in `lib/liveNow.ts` (`liveDocuments`, `writingLabel`, `liveDotLabel`, `announcementText`, `listNames`).
  - **Row taps** (`EntryOpenTarget` in `TimelineEntryRow.tsx`): a link or button stretched over the row or card (`absolute inset-0`), so it's one named, focusable control. Notes and events open `/entries/:id` for everyone; symptoms and vitals open their edit sheet for writers and do nothing for viewers. The ⋯ button and the More/Less toggle sit above it (`relative z-10`), and each row is `relative isolate` so they stay under the sticky day headers.
  - The ⋯ menu (writers only) has Delete, plus Edit for symptoms and vitals.
  - The timeline's `shouldRevalidate` skips submissions (live queries already show them). "Show older" grows the query limit.
- **Seeds** (`seeds/timelineEntries.ts`): about 180 fictional entries over eight weeks for Grandma Pat, placed by `hoursAgo` or `at: { daysAgo, time }` (America/Los_Angeles).
  - **Ids follow position**, so adding or changing an entry needs `pnpm datastore:reset`.
  - `timelineEntries.test.ts` validates every seed entry against the content schema, because seeds bypass the service.
  - A note's or event's seed `body` is its document's text: the insert stores a null body plus a compacted `note_document` (`seedContentOf`, `noteDocFromText`), with `editors` set to its author at `occurredAt`.

### Live notes (collaborative documents)

Built by [`plans/live-notes-ux-prd.md`](plans/live-notes-ux-prd.md) (done).

- **What they are:** the text of every **note and event** (`NOTE_DOCUMENT_KINDS`), a Yjs document. **Its id is the entry's id**, so two devices adding one offline make the same row and merge.
- **Tables:**
  - `note_document`: `snapshot` (compacted Yjs, base64), derived `text`, and `editors` jsonb `{ [userId]: lastEditAt }` (default `{}`, system-only writes; a forged one in an upload is ignored).
  - `note_update`: append-only, base64 `data`, at most 1,000,000 chars.
  - Composite FKs cascade from the entry. `timeline_entry` has a unique `(group_id, id)` for this.
- **Helpers** (`db/schema/noteYjs.ts`, client-safe): base64, `isYjsUpdate`, `buildNoteDoc`, `encodeNoteDoc`, `noteText` and its inverse `noteDocFromText` (one paragraph per line, `• ` lines as a bullet list). The fragment is `NOTE_FRAGMENT = "default"`.
- **`noteDocumentService`** (write through it):
  - `create` is idempotent and requires a live note or event.
  - `appendUpdate` is idempotent on the update id.
  - `currentText` includes pending updates (for AI and workers).
  - `compact` (system, row locked `FOR UPDATE`) folds pending updates into the snapshot and text, merges their authors into `editors` (`mergeEditors`, latest time per user), and deletes them.
- **Recent editors** (`db/schema/noteEditors.ts`, client-safe): `recentEditors({ editors, pending, now, excludeUserId })` combines `editors` with pending `note_update` rows. The window is 2 min (`RECENT_EDITORS_WINDOW_MS`, edge inclusive, up to one window of future skew allowed), re-evaluated every 15 s (`useNow`). On the device, `lib/sync/editors.ts` has `documentEditorsQuery`, `groupLiveEditorsQuery` and `useLiveDocuments` (the group's live, not deleted, notes and events, for the live dot and banner), `toRecentEditors` and `useRecentEditors`. `EditorAvatars` shows up to 3 initials then "+N", never the viewer. An update's `created_at` is the server's, so offline edits count as "now" for 2 min after they upload.
  - `compactIfDue`: at 20 pending updates, or after 60 s.
- **Device** (`lib/sync/notes.ts`):
  - `createNoteDoc` and `bindNoteDoc` are split so StrictMode's double effects can't destroy a live doc.
  - Typing bursts flush as one `note_update` 250 ms after the last keystroke, and at least every 1 s.
  - A viewer's changes are never written.
  - Previews rebuild text locally, so they include unsynced edits.
- **Entry page** (`routes/app/entry.tsx`, `/entries/:id`; `/entries/new?kind=note|event` is a draft, the same route so the editor stays mounted):
  - Nothing is written until the first real change (`shouldMaterialize` in `lib/liveEntry.ts`: text in the document, or a title). Then `materializeLiveEntry` (`lib/sync/liveEntry.ts`) writes the entry and its document in one local transaction (idempotent on the id; for an older event it adds only the document), and the URL is **replaced** with `/entries/:id`.
  - `bindNoteDoc`'s `ensureSaved` holds a draft's Yjs changes in memory until then; leaving drops them.
  - `EntryHeader` has four regions:
    - **title:** `EntryTitle`, editable by writers for both kinds. `commitTitle` saves a new draft, or renames an existing entry. While an event is unnamed (`isUnnamedEvent`) and nothing is typed, writers see `EventTitleChips`: up to 5 of the group's recent event titles (`suggestTitles` in `lib/titleSuggestions.ts`: 14-day half-life, case-insensitive dedupe, no "Event" or deleted entries; read locally by `lib/sync/titleSuggestions.ts`, so they work offline). A tap goes through `commitTitle`, so a named event takes 2 taps.
    - **time:** `EntryTimeChip` for writers (a popover with `DateTimeField`; saved on close, only if changed; a time picked on a draft is the saved time, via `occurredAtRef`). Viewers get a plain `EntryTime`.
    - **editors:** `EditorAvatars`.
    - **actions:** once the entry exists, `ShareButton` for everyone, plus `EntryMenu` (⋯ → Delete, with a `ConfirmDialog`, then back to the timeline) for writers.
  - **Share** (`lib/share.ts`): the Web Share API when `canShare` allows it, else the clipboard with a "Link copied" status; a dismissed sheet shows nothing, and a failed copy shows the link to copy by hand. The origin is `VITE_API_ORIGIN || location.origin`.
  - Symptom or vital ids, and non-members, get a 404 that shows no title or text.
  - `EntryMenu` still duplicates part of the timeline's `EntryActions` (see _Next steps_).
- **Editor:** `LiveNotesEditor` is Tiptap StarterKit (`undoRedo: false`, because Collaboration brings Yjs undo; `link: false`). Its chunk is about 140 KB gzipped and loads only on its route.
- **Vite:** `optimizeDeps.include` pre-bundles yjs and Tiptap, and `resolve.dedupe` keeps one yjs, React and ProseMirror. Without both, "Yjs was already imported" and broken hooks after re-optimization.
- **Latency:** a co-editor sees typing in about 0.5–0.8 s locally. Offline edits land about 2.5–3 s after reconnecting.
- ❓ Presence and cursors (a websocket relay such as Hocuspocus): decide after real use. 🟡 Not built: a compaction cron sweep, a snapshot size cap, an oRPC read for documents, search over `text`.

## Planned: notifications (Resend iteration)

🟡 A server-only `packages/notifications`, usable from the API, Better Auth callbacks and workers. Nothing is built yet.

- **Typed registry:** `defineNotification({ name, data: zod, email: (data, { recipient }) => ({ subject, react }), push? })` in `NOTIFICATIONS = { … } as const`, sent with `notify(name, { to, actor?, data })`.
  - Never type the registry as `Record<string, …>`: that makes every string a valid name and loses the link between name and data.
  - Validate data before rendering.
  - One function per channel.
- **Links and text:** templates get plain data plus a configured `APP_URL`. **Never build links from the request Host header** (password-reset poisoning). Always send a plain-text version.
- **Senders:** `resend` (production), `log` (dev) and `memory` (tests).
  - Check Resend's `{ error }`; it doesn't throw.
  - Production refuses to start without `RESEND_API_KEY`.
  - Outside production, only allowlisted recipients get real email.
- **Outbox:** for everything except auth emails. A `notification_outbox` row is written in the same transaction as the change (unique `idempotency_key`, also passed to Resend). It's delivered through `waitUntil` plus a cron sweep (`CRON_SECRET`, batches of ≤100, backoff). Purge sent rows.
- **Health-app rules:**
  - No health details in subjects or bodies by default (opt-in only, with consent recorded).
  - Resend open and click tracking off.
  - Tokens single-use, short-lived and stored hashed, never raw in the outbox.
  - Don't await auth emails (timing leaks whether an account exists), but don't leave them unawaited on Vercel either: use `waitUntil` or the outbox.
  - Verify the bounce webhooks (Svix).
  - Send from a subdomain with SPF, DKIM and DMARC.
  - `List-Unsubscribe` on optional mail.
  - Times in the recipient's zone.
- **Order:**
  1. Registry and senders.
  2. Reset and verification.
  3. Invites through the outbox (with sign-up, accept and consent).
  4. Tracking off, bounces and DNS.

  Later: digests, preferences, push through Capacitor, the AWS worker.

## Compliance

- ✅ **Deliberately outside HIPAA scope:** no BAAs, and no work on behalf of covered entities.
- Still applies: the FTC Health Breach Notification Rule and state laws (e.g. Washington's My Health My Data Act). In practice:
  - no ad or analytics tools that can see health data;
  - consent before sharing, and user data deletion;
  - encryption at rest;
  - AI vendors that don't retain our data or train on it.

## Open questions

- ❓ Invites: email delivery, accept and decline (match the signed-in email, create the membership as `system`), and **consent** for sharing health data (recorded on the invite or as an audit row at accept time).
- ❓ Account deletion by a group's last owner currently leaves the group ownerless. Block it, delete the group, or auto-promote?
- ❓ Co-members can read each other's full `user` row in the data layer. Only the API's public-profile shape protects it.
- ❓ Hosted database, PowerSync production setup, rate-limit storage, native token storage (see the sections above).

## Dev workflow

### Commands (repo root, after `nvm use`)

| Command                                                       | What it does                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm --filter @caretook/web dev:native`         | dev server, SSR or SPA mode                                                                                                        |
| `pnpm build` / `pnpm build:native`                            | `apps/web/build/web/` or `apps/web/build/native/client/`                                                                           |
| `pnpm datastore:start`                                        | start Postgres (waits for healthy), migrate, seed. Needs `packages/data/.env` and `apps/web/.env` (copy the examples; set secrets) |
| `pnpm datastore:up` / `stop` / `logs`                         | the dev Postgres container                                                                                                         |
| `pnpm datastore:generate` / `migrate` / `seed` / `studio`     | generate a migration, apply them, insert dev data (idempotent), Drizzle Studio                                                     |
| `pnpm datastore:clear` / `reset`                              | drop everything (localhost only), or clear + migrate + seed                                                                        |
| `pnpm datastore:start:test` / `reset:test` / `stop:test`      | the test database on :5435 (migrated, not seeded)                                                                                  |
| `pnpm lint` / `lint:fix`, `pnpm format` / `format:check`      | ESLint and Prettier                                                                                                                |
| `pnpm test` / `test:unit` / `test:integration` / `test:watch` | Vitest (integration needs `pnpm datastore:up:test`)                                                                                |
| `pnpm typecheck`                                              | tsc everywhere; apps/web runs typegen and tsc on the **web** target only (it includes every shared file)                           |
| `pnpm check`                                                  | typecheck, lint, format check and tests: run it before handing off                                                                 |
| `pnpm backlog …`                                              | the live backlog on `dev` (`ingest`, `list`, `claim`, `done`, …; see _The live backlog_)                                           |
| `pnpm hooks:install`                                          | turn on the branch protection hooks (`.githooks/`) for this clone: once, after cloning                                             |

### Browser checks (`scripts/browser-checks/`)

UI work is verified in headless Chrome over CDP with plain Node scripts (no Playwright yet).

- **Run:** Node 24 (they use the global `WebSocket`), from that folder, against the dev server. `BASE` defaults to `http://localhost:5176`.
- **Scripts:** `cdp.mjs` (the harness, with `tap()` for real CDP mouse taps); `proxy.mjs` (offline, because CDP network emulation doesn't cut PowerSync's stream); `live-notes.mjs` (the one notes and events check, about 2 min: drafts, one-tap note and event, title chips, Live now banner and live dot, avatars, convergence, offline, time chip, Delete, Share, 404s, with tap counts Note 1, Event 1, named event 2, Join 1); `roundtrip.mjs` (sheet entries: symptom add, edit, delete, validation, offline, viewer, sign-out wipe); `phase2.mjs` (the timeline layout and row taps, writer and viewer in both views; Chrome in America/Los_Angeles, the seeds' zone; rerun it after any timeline change); `signout-wipe.mjs` (never exits on its own: run it with a timeout); `sign-in.mjs` (one sign-in request on a double click, by holding `/api/auth/token`); `layout-offline.mjs` (an offline layout change survives and reaches the server); `first-sync.mjs` (a slow first sync, held by its own proxy, shows the syncing state and never "no care groups"; `HOLD_MS`); `app-shell.mjs` (the frame: one-row header at 420, the user menu by keyboard, theme with no flash and with storage blocked, group switching and the last group, the tab bar at 420 and header links at 1280, Sign out).
  - **They're order-independent:** each run tags the entries it makes, asserts against its own entries (never global idle state or seed order), moves only its own documents' edit times back before "who's typing" steps, and soft-deletes what it made at the end. They exit non-zero on failure.
  - Sign out in a check with `page.signOut()` (`cdp.mjs`), which goes through the account menu.
  - **member@ has two groups.** `page.signIn(email, pw)` goes on from the group list to Dev Family's timeline (`page.openDevFamily()`); pass `{ home: true }` to stay where `/app` lands. A check that needs a one-group user's "straight to the timeline" signs in as caretaker@ or viewer@. psql queries that pick seeded rows filter on Dev Family's id (`0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001`).
  - ⚠️ `layout-offline.mjs` prints its result and then doesn't exit (its proxy's open sockets): run it with a timeout, like `signout-wipe.mjs`.
  - Headless Chrome's clipboard needs `Emulation.setFocusEmulationEnabled`. Pin the zone (`Emulation.setTimezoneOverride`, America/Los_Angeles) for layout checks.
- **Patterns:**
  - Use a 420×900 window.
  - Sign in as the `@example.com` seeds (`SEED_USER_PASSWORD`).
  - React Aria buttons and menu items need a `pointerdown` before `.click()`.
  - Set inputs through the native value setter, then dispatch `input`.
  - Collect console errors, and take screenshots.
  - **Better Auth allows about 3 sign-ins per 10 s.** Past that it answers like a wrong password. Pause between checks run back to back (`first-sync.mjs` waits 4 s before each sign-in).
- **Afterwards:** nothing; the checks clean up after themselves, so no reset is needed between runs.

### Gotchas

- **The dev server on another port:** Better Auth trusts only `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS`, so use `BETTER_AUTH_URL=http://localhost:5176 AUTH_TRUSTED_ORIGINS=http://localhost:5176 pnpm --filter @caretook/web dev --port 5176 --strictPort`. PowerSync's JWKS then needs `PS_JWKS_URL` set to match.
- **After `pnpm build:native`:** lint can report `no-unsafe-argument` in `routes/rpc.ts` and `routes/api/auth.ts`, because the native typegen overwrote the web route types. Run `pnpm typecheck`.
- **`/app` error handling:** `/app` has its own `ErrorBoundary`. It keeps the frame, and avoids React's "script tag" warning from the root boundary.
- **Route discovery is `initial`** (`react-router.config.ts`). With the default (lazy), navigating to a path not seen yet (a note just saved offline, `/entries/:id`) asks the server for `/__manifest` first, and fails offline.

## Layout

```
docker-compose.yml        dev Postgres :5434, PowerSync :8080 + storage; docker-compose.test.yml → :5435
powersync/                service.yaml, sync-config.yaml (Sync Streams)
docs/                     orchestration.md: the human guide to branches, the inbox and running PRDs (README.md links it)
plans/                    inbox.md (the user's list) and backlog.md (the tracker), both only on dev; PRDs and slice plans
scripts/browser-checks/   headless Chrome checks
scripts/loops/            new/ls/rm/prompt (+ lib.sh): worktrees in .loops/, slot leases, a Docker stack each
scripts/backlog/          pnpm backlog: the live backlog CLI (format.mjs parses and renders)
.githooks/                protects main, staging and dev (pnpm hooks:install)
apps/web/                 @caretook/web (React Router 8, Vite 8)
  build-target.ts, react-router.config.ts, vite.config.ts
  app/routes.ts, root.tsx, app.css
  app/routes/app/         shared screens: home, timeline, entry (/entries/:id and /entries/new), settings (no server loaders)
  app/routes/marketing/   web only; routes/api/auth.ts, routes/rpc.ts (web only); native-index.tsx
  app/routes/sign-in.tsx, sign-out.tsx
  app/.server/            data.ts, auth.ts, api.ts: the server-only doors
  app/components/         EntryForm, EntrySheet, QuickAddBar, TimelineEntryRow/Card, KindIcon, TimelineFilters,
                          LatestVitals, EntryActions, DateTimeField, ConfirmDialog, VitalTypeMenu,
                          VitalReadingsFields, LiveNotesEditor, EntryHeader, EntryTimeChip, EntryMenu,
                          ShareButton, EditorAvatars, SyncIndicator, UserAvatar, UserMenu, GroupMenu, SectionNav,
                          FirstSyncPending, EventTitleChips, LiveNowBanner, LiveDot
  app/lib/                session, me, auth-client, rpc, api, initials, entryDisplay, entryForm, format, redirect, form, liveEntry, share, firstSync,
                          liveNow, titleSuggestions, theme, lastGroup, groupSections
  app/lib/sync/           schema, client (lazy), index, timeline, notes, liveEntry, editors, titleSuggestions
packages/auth/            @caretook/auth
packages/api/             @caretook/api: router, procedures, errors, dto, sync upload, HTTP handler
packages/data/            @caretook/data
  scripts/                migrate, seed, clear runners
  test/                   env guard, globalSetup, setup, fixtures
  src/constants/, errors/, permissions/
  src/db/                 client, types, migrate, clear, migrations/, seeds/
  src/db/schema/          tables + Zod (client-safe), vitals, userPreferences, noteDocument, noteYjs, noteEditors
  src/models/, src/services/
```

## Next steps

1. **Live notes follow-ups** (the PRD is done): merge `EntryMenu` into the timeline's `EntryActions`; give `LiveNotesEditor` a focus handle (title chips focus `main [contenteditable]` directly); restart PowerSync inside `datastore:reset`. File the PRD and slice issues once `gh` can see the repo.
2. **The backlog** (`pnpm backlog list`): write the PRDs its table marks "to write" (`new.sh plan <topic>`, one `write-a-prd` interview each), then run them, at most three at once.
3. **Tests:** make the integration tests independent (`careGroup.int.test.ts` shares one group across `describe` blocks), then cover every role against every table.
4. **Hosting:** choose the hosted database and how production migrations run. Set up PowerSync Cloud.
5. **The Resend iteration:** sign-up, invites with accept and consent, verification and reset. Then Capacitor (bearer storage, `VITE_API_ORIGIN`).
