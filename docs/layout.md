# Repository layout

Where things live. Moved out of AGENTS.md.

```
docker-compose.yml        dev Postgres :5434, PowerSync :8080 + storage; docker-compose.test.yml → :5435
powersync/                service.yaml, sync-config.yaml (Sync Streams)
docs/                     orchestration.md: the human guide to branches, the inbox and running PRDs (README.md links it)
                          agents/ (the agents' role handbooks; loops.md is a stub), layout.md (this file), domain/<area>.md (AGENTS.md's area index)
plans/                    inbox.md (the user's list) and backlog.md (the tracker), both only on dev; PRDs and slice plans
scripts/browser-checks/   Playwright Test specs (<check>.spec.mjs), run by pnpm prd browser
scripts/build/            build budget, check build and service worker scripts
scripts/deploy/           deploy env check and smoke checks (pnpm deploy:env, deploy:smoke)
ops/                      runbook.md (deploys, secrets), break-glass.md, data-copies.md
scripts/loops/            check-areas.d/<area> + check-areas.mjs: which browser checks a changed file needs
                          pnpm prd (prd.sh) → new/ls/rm/prompt/queue/serve/ready/land/browser (+ lib.sh): worktrees in .loops/, slot and browser leases, a Docker stack each
                          slice-fields.mjs: a slice's Stack, Reads and Tests from its plan
scripts/backlog/          pnpm backlog: the live backlog CLI (format.mjs parses and renders)
.githooks/                protects main, staging and dev; commit-msg checks Conventional Commits (pnpm hooks:install)
apps/web/                 @caretook/web (React Router 8, Vite 8)
  build-target.ts, react-router.config.ts, vite.config.ts
  app/routes.ts, root.tsx, app.css
                          routes.ts is the frame (the /app layout, group layout, account routes, web/native split); each area's
                          route pieces are a routes.ts beside its route folders (routes/app/groups/<area>/routes.ts, routes/admin/,
                          routes/marketing/, routes/dev/), guarded by app/routes.test.ts (unique ids and paths; native ⊂ web, no server-only route)
  app/routes/app/         shared screens, a folder per route (route.tsx + its private files; no server loaders):
                          layout/ (the /app frame: GroupMenu, SectionNav + TabBar, SyncIndicator, UserMenu), home/,
                          settings/ (layout, index, units, timeline, account),
                          groups/layout/ (the group route), groups/index/, groups/timeline/ (useTimelineData, TimelineHeader,
                          TimelineEntryList, EntryBody, TimelineEntryRow/Card, EntryOpenTarget, TimelineFilters, LatestVitals,
                          LiveNowBanner, LiveDot, QuickAddMenu, DayHeader, EntryForm, EntryKindPicker, SymptomFields, VitalReadingsFields,
                          VitalReadingRow, VitalField, VitalTypeMenu, useEntryFormSave, useEntryRemoval, new/, edit/),
                          groups/entry/ (loadEntry, useLiveEntry, EntryPageHeader, EntryHeader, EntryTitleRegion,
                          EntryTimeChip, EventTitleChips, ShareButton, share),
                          groups/providers/ (DirectoryFilters, DirectoryResults, ProviderListItem, ProviderForm, PhoneFields,
                          providerSheet, providerFormData, new/, edit/),
                          groups/provider/ (loadProvider, useProviderNotes, ProviderHeader, ContactList),
                          groups/settings/ (layout, index, details/ + DetailsForms, members/ + MembersList; api, groupSettings)
                          groups/planner/ (the Planner: Upcoming list, past/), groups/medications/, groups/medication/ (a medication's page),
                          groups/profile/ (the care recipient's profile: basics, conditions, emergency, contact), groups/search/,
                          groups/todos/ (the Planner's Todos tab: TodoChips, TodoSections, DoneTodos, TodoForm, AssigneeField, link pickers,
                          new/, edit/), groups/todo/ (the todo page: loadTodo, useTodoPage, TodoHeader, TodoLinks, notes)
  app/routes/admin/       web only (staff: users, user, groups, group, access codes, print, new group, waitlist, audit, settings)
  app/routes/connectors/  web only (connect/, mcp/, well-known/: the connector pages, /mcp and OAuth discovery)
  app/routes/marketing/   web only; routes/api/auth.ts, routes/rpc.ts (web only); native-index.tsx
  app/routes/sign-in.tsx, sign-out.tsx; app/routes/account/ (reset-password, verify-email, invite/, AuthCard)
  app/routes/dev/mail/, dev/ui/ (the UI gallery), app/routes/api/cron/outbox.ts, cron/calendar.ts   web only (the dev mailbox; the outbox sweep; the calendar cron)
  app/routes/api/calendar/feed.ts, api/google/, api/reminders/unsubscribe.ts   web only (the iCal feed, Google connect, reminder unsubscribe)
  app/.server/            data.ts, auth.ts, api.ts, notifications.ts, calendarFeed.ts, devUi.ts: the server-only doors
  app/components/         shared by 2+ routes only, imported through each folder's index: brand/ (LogoMark, Wordmark),
                          ui/ (the primitives, listed in domain/components.md), ui/date/ (DateTimeField), ui/tooltip/,
                          ui/plain (the light entry), entry/ (EntryActions, KindIcon),
                          groups/ (NewGroupFields),
                          notes/ (LiveNotesEditor, EditorAvatars), providers/ (ContactActions, ProviderTypeIcon),
                          settings/ (SettingsFrame, SettingsPage parts), shell/ (FirstSyncPending),
                          todos/ (TodoTick, TodoUndoStatus, LinkedTodos)
  app/lib/<area>/         every lib module, in a folder named after its docs/domain/ area (admin, app-shell, appointments, assistant,
                          auth, calendars, care-groups, connectors, care-periods, live-notes, marketing, medications, profiles, providers, search,
                          security-headers, timeline, todos) or core/ (api, rpc, form, contactForm, format, initials, paging,
                          redirect, zonedDay, urls); tests beside their modules; no index files: import the file
                          <name>.sync.ts: an area's device queries (its tests .sync.test.ts, .sync.browser.test.tsx)
                          <area>/urls.ts: that area's URL builders and params; app-shell/appUrls.ts composes appUrls from them
                          (shared helpers in core/urls.ts)
  app/lib/sync/           plumbing only: client (lazy), index, schema, pageCache, useLiveRows, firstSync, uploader
  app/libLayout.test.ts   the layout guard: nothing directly under lib/, area names, the sync/ allowlist, .sync.ts in areas
packages/auth/            @caretook/auth (emails.ts: auth emails through notify)
packages/notifications/   @caretook/notifications: registry, templates (react-email), notify + outbox, senders, cron, dev mail
packages/api/             @caretook/api: router, procedures, errors, dto, sync upload (sync.ts, its table registry syncRegistry.ts), HTTP handler
  src/<area>/             procedures by area (admin, app-shell, calendars, care-groups, connectors (MCP, OAuth, tools), marketing, profiles, search, timeline), int tests beside;
                          router.ts composes them; the shared helpers and sync.ts stay at the top
packages/data/            @caretook/data
  scripts/                migrate, seed, clear runners; googleSmoke.ts (`pnpm calendar:google-smoke`, manual)
  test/                   env guard, globalSetup, setup, fixtures
  src/constants/
  src/errors/             <area>.ts parts of the service errors; constants.ts composes ERRORS (codes unique: errors.test.ts)
  src/permissions/        <area>.ts parts (each satisfies a partial Permissions), blocks.ts; permissions.ts spreads them
  src/db/                 client, types, migrate, clear, migrations/, seeds/
  src/db/schema/<area>/   tables + Zod (client-safe) by area, each folder with an index.ts; core/ holds the shared helpers (columns,
                          uuidV5, timeZone, contactFields, entryTiming, rateLimit); index.ts lists the folders
  src/google/             the Google Calendar client seam (client, real, fake), pushPlan, pullPlan
  src/models/, src/services/
```
