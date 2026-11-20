# API: `packages/api` (oRPC)

The api area's rules and decisions, moved out of AGENTS.md (whose core rules still apply). An orchestrator folds a landing's lasting decisions for this area in here.

- Chosen over tRPC for OpenAPI output (AI tools, MCP, integrations), contract-first, files and streaming, and fetch, Node and Lambda adapters. It has no runtime dependency, so it mounts in a resource route, runs directly from server loaders, or runs in an AWS worker.
- **Procedures:** `publicProcedure`/`authedProcedure` with context `{ authUser }`, resolved by the mount point (`getAuthUser`). Procedures never read requests.
- **Errors:** handlers call services and `unwrap()`. `toORPCError` maps an AppError's `statusCode` (400/401/403/404/409) to an oRPC code with `data: { code, issues? }`. Anything else becomes a generic 500, with the `AppError` on the `ORPCError`'s `cause` (never sent).
- **Logging** (`logError(event, error, fields?)` from `@caretook/data`, server only; in apps/web through `~/.server/data` or `~/.server/api`): server logs carry an error's code (an `AppError`'s `code`, or a constant-looking code and class name otherwise), stack frames without the message, and only the fields `procedure`, `actorId`, `groupId`, `recordId`, `notification`, `attempts`. Never messages, `meta`, `issues`, bodies or values. `publicProcedure`'s first middleware (`logFailures`) logs every 5xx and unexpected throw once; 4xx aren't logged. **Never `console.error(error)` in server code.**
- **DTOs:** `dto.ts` turns timestamps into ISO 8601. Inputs reuse the client-safe Zod schemas from `@caretook/data/schema`.
- **Public profiles only:** `careGroup.members` returns name, image and role, never email. Keep it that way for new procedures.
- **HTTP:** `createRpcHandler({ prefix, allowedOrigins })`:
  - CSRF through `SimpleCsrfProtection` (the client link sends `x-csrf-token`).
  - CORS for `allowedOrigins()` only (`packages/auth/src/host.ts`, shared with Better Auth): `AUTH_TRUSTED_ORIGINS`, plus Capacitor's origins only with `NATIVE_APP_ORIGINS=1` (off in dev, tests, checks and deploys until the native app ships). The list is defined once, in `host.ts`.
  - `clientIp` is `clientIpOf(headers)` from `host.ts`: the configured `CLIENT_IP_HEADER`'s first entry (`x-vercel-forwarded-for` on Vercel; a spoofed `x-forwarded-for` is ignored), else the first `x-forwarded-for` entry, then `x-real-ip` (what browser checks rely on). Better Auth keys its limits on the same header (`ipAddressHeaders`).
  - GET is refused.
- **Mounting:** apps/web mounts it at `/rpc/*` through `app/.server/api.ts`. The browser client (`app/lib/core/rpc.ts`) uses a type-only router import and sends cookies.
- **Procedures** live in `packages/api/src/<area>/` (with their integration tests); `router.ts` composes the area routers, and `routerPaths.test.ts` freezes every procedure path, so a new procedure adds its path there:
  - `me.get` and `me.updatePreferences`;
  - `careGroup.listMine` and `careGroup.members`;
  - `careGroup.update` (the name; owners and admins), `careGroup.recipient` (the profile with the date of birth, which is also synced; any member) and `careGroup.updateRecipient` (owners, admins and caretakers; fields left out keep their value, and an empty preferred name clears it). A non-member gets a 404, and a member without the role a 403 (the `updated()` helper maps `baseModel:update:nothingUpdated`, which has no status code);
  - `invite.listForGroup`, `invite.createEmail`, `invite.resend`, `invite.revoke` (owners and admins), the public `invite.preview`, `invite.signUp` and `invite.decline`, and `invite.accept` (`packages/api/src/care-groups/invites.ts`; `api` depends on `@caretook/auth` and `@caretook/notifications`);
  - `invite.listLinks`, `invite.createLink` (returns the token), `invite.copyLink`; `joinRequest.list`, `mine`, `approve`, `decline`, `withdraw` (`packages/api/src/care-groups/joinRequests.ts`; requesters' name and email go to managers only);
  - `careGroup.create` (signed in: the group, its recipient and the creator as owner, one transaction); the public `accessCode.preview` and `accessCode.signUp`; `admin.accessCode.list|get|create|revoke` and `admin.careGroup.createWithOwnerInvite` behind `staffProcedure(capability)`; `admin.audit`, `admin.users`, `admin.groups`, `admin.settings` and the public `public.announcement` (see [admin](admin.md)) (`packages/api/src/care-groups/groups.ts`);
  - `careGroup.changeRole` and `careGroup.removeMember` (removing yourself is leaving), thin over `careGroupMemberService`, returning public profiles only. The `removed()` helper maps `baseModel:remove:nothingRemoved` to a 403, as `updated()` does;
  - `timeline.list`, `create`, `update`, `remove` and `latestVitals`;
  - `search.query` (`packages/api/src/search/search.ts`, over `searchService`; see _Search_);
  - `sync.upload`;
  - `admin.suppressions.list` (`users.read`) and `admin.suppressions.clear` (`users.help`; see [admin](admin.md)).

  No screen calls the timeline or careGroup reads now (screens read local data); they stay for API, AI and worker use.

- **Notes' and events' text:** `timelineEntryService.getById`/`list` (and so `timeline.list` and `timeline.update`) fill a note's or event's `body` from its document's **compacted** `text` (`withDocumentText`, one query in the actor's scope). No document or empty text → the stored body (null). Deleted entries never get their text. Pending updates are only in `noteDocumentService.currentText`.
- **Deploy environment** (hosting PRD):
  - `APP_ENV` (`staging` | `production`; unset in dev, tests and check builds) names the deploy target, since both run with `NODE_ENV=production`. Builds bake it in (`vite.config.ts` `envPrefix`), so prerendered pages read it at build time.
  - `checkDeployEnv(target, env, { scope })` (`apps/web/app/.server/deployEnv.ts`, pure, no imports) returns `{ variable, problem }[]`: required variables per target, `APP_URL` https on the target's host (`TARGET_HOSTS`), `BETTER_AUTH_URL === APP_URL`, `POWERSYNC_URL === VITE_POWERSYNC_URL`, Resend with a `mail.` sender, secret lengths, a pooled `DATABASE_URL` that isn't the migrations role, `CLIENT_IP_HEADER` (one header name, both targets), `NATIVE_APP_ORIGINS` unset or `1`, the allowlist set on staging and empty in production, and staging's `SEED_USER_PASSWORD` (`scope: "server"` skips it: only the Action holds it). `DEPLOY_ENV_VARIABLES` lists every name it knows. `pnpm deploy:env <target>` prints names only and exits 1.
  - **The server refuses until it's right:** with `APP_ENV` set, `deployEnvRefusal(request)` (entry.server's document and data handlers, and the `web` layout middleware) answers 503 with a generic body and logs the variable names once per process, never values. Prerender requests are exempt (React Router's `IS_RR_BUILD_REQUEST` plus the `X-React-Router-Prerender` header); if an upgrade renames that, staging builds fail at prerender.
  - `pnpm deploy:smoke <target>` (`scripts/deploy/smoke-checks.mjs`, a pure `smoke()` over an injected fetch): `home` (200 with HSTS, CSP, X-Frame-Options), `jwks`, `rpc-unauthenticated` (401), `cron-locked` (401), `powersync` (`/probes/liveness`), and `noindex` on staging. The deploy Action is in [`ops/runbook.md`](../../ops/runbook.md).
