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
- ✅ pnpm **10.34.9** (pinned in `packageManager`). ❓ Moving to pnpm 12 hasn't been evaluated yet.
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
- 🟡 Drizzle for the schema and migrations, Zod schemas shared by client and server.
- ❓ Database host, and PowerSync Cloud vs self-hosted.

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
package.json           root scripts; packageManager pnpm@10.34.9
pnpm-workspace.yaml    apps/*, packages/*
tsconfig.base.json     strict shared compiler settings
apps/web/              @caretook/web: React Router 8, Vite 8
  build-target.ts      "web" | "native" switch (BUILD_TARGET env var)
  react-router.config.ts
  app/root.tsx
  app/routes.ts
  app/routes/app/          shared screens (no server loaders/actions)
  app/routes/marketing/    web-only pages
  app/routes/native-index.tsx  native-only "/" → "/app" redirect
packages/              empty, waiting on the user's example patterns
```

## Commands (run from the repo root after `nvm use`)

| Command | What it does |
|---|---|
| `pnpm dev` | web dev server (SSR) |
| `pnpm --filter @caretook/web dev:native` | dev server in native (SPA) mode |
| `pnpm build` | web build → `apps/web/build/web/` |
| `pnpm build:native` | native SPA build → `apps/web/build/native/client/` |
| `pnpm typecheck` | runs typegen and tsc on the **web** target only. The native typegen pass overwrites the web types, and the web target already includes every shared file. |

## Likely next steps
1. Review the user's example patterns.
2. Choose the dependencies for each area together.
3. Probably `packages/api` (oRPC) mounted in a React Router resource route, then the database, auth, and a test sync round trip.
