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
  - CORS for Capacitor's origins and `AUTH_TRUSTED_ORIGINS` only.
  - GET is refused.
- **Mounting:** apps/web mounts it at `/rpc/*` through `app/.server/api.ts`. The browser client (`app/lib/rpc.ts`) uses a type-only router import and sends cookies.
- **Procedures:**
  - `me.get` and `me.updatePreferences`;
  - `careGroup.listMine` and `careGroup.members`;
  - `careGroup.update` (the name; owners and admins), `careGroup.recipient` (the profile with the date of birth, which is also synced; any member) and `careGroup.updateRecipient` (owners, admins and caretakers; fields left out keep their value, and an empty preferred name clears it). A non-member gets a 404, and a member without the role a 403 (the `updated()` helper maps `baseModel:update:nothingUpdated`, which has no status code);
  - `invite.listForGroup`, `invite.createEmail`, `invite.resend`, `invite.revoke` (owners and admins), the public `invite.preview`, `invite.signUp` and `invite.decline`, and `invite.accept` (`packages/api/src/invites.ts`; `api` depends on `@caretook/auth` and `@caretook/notifications`);
  - `invite.listLinks`, `invite.createLink` (returns the token), `invite.copyLink`; `joinRequest.list`, `mine`, `approve`, `decline`, `withdraw` (`packages/api/src/joinRequests.ts`; requesters' name and email go to managers only);
  - `careGroup.create` (signed in: the group, its recipient and the creator as owner, one transaction); the public `accessCode.preview` and `accessCode.signUp`; `admin.accessCode.list|get|create|revoke` and `admin.careGroup.createWithOwnerInvite` behind `adminProcedure` (global `admin` only) (`packages/api/src/groups.ts`);
  - `careGroup.changeRole` and `careGroup.removeMember` (removing yourself is leaving), thin over `careGroupMemberService`, returning public profiles only. The `removed()` helper maps `baseModel:remove:nothingRemoved` to a 403, as `updated()` does;
  - `timeline.list`, `create`, `update`, `remove` and `latestVitals`;
  - `search.query` (`packages/api/src/search.ts`, over `searchService`; see _Search_);
  - `sync.upload`.

  No screen calls the timeline or careGroup reads now (screens read local data); they stay for API, AI and worker use.

- **Notes' and events' text:** `timelineEntryService.getById`/`list` (and so `timeline.list` and `timeline.update`) fill a note's or event's `body` from its document's **compacted** `text` (`withDocumentText`, one query in the actor's scope). No document or empty text → the stored body (null). Deleted entries never get their text. Pending updates are only in `noteDocumentService.currentText`.
