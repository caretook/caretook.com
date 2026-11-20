# Repository layout

Where things live. Moved out of AGENTS.md.

```
docker-compose.yml        dev Postgres :5434, PowerSync :8080 + storage; docker-compose.test.yml → :5435
powersync/                service.yaml, sync-config.yaml (Sync Streams)
docs/                     orchestration.md: the human guide to branches, the inbox and running PRDs (README.md links it)
                          loops.md (the agents' loop handbook), layout.md (this file), domain/<area>.md (AGENTS.md's area index)
plans/                    inbox.md (the user's list) and backlog.md (the tracker), both only on dev; PRDs and slice plans
scripts/browser-checks/   headless Chrome checks
scripts/loops/            pnpm prd (prd.sh) → new/ls/rm/prompt/queue/serve/ready/land/browser (+ lib.sh): worktrees in .loops/, slot and browser leases, a Docker stack each
                          slice-fields.mjs: a slice's Stack, Reads and Tests from its plan
scripts/backlog/          pnpm backlog: the live backlog CLI (format.mjs parses and renders)
.githooks/                protects main, staging and dev; commit-msg checks Conventional Commits (pnpm hooks:install)
apps/web/                 @caretook/web (React Router 8, Vite 8)
  build-target.ts, react-router.config.ts, vite.config.ts
  app/routes.ts, root.tsx, app.css
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
  app/routes/admin/       web only (staff: users, user, groups, group, access codes, print, new group, waitlist, audit, settings)
  app/routes/marketing/   web only; routes/api/auth.ts, routes/rpc.ts (web only); native-index.tsx
  app/routes/sign-in.tsx, sign-out.tsx; app/routes/account/ (reset-password, verify-email, invite/, AuthCard)
  app/routes/dev/mail/, app/routes/api/cron/outbox.ts   web only (the dev mailbox; the outbox sweep)
  app/.server/            data.ts, auth.ts, api.ts, notifications.ts: the server-only doors
  app/components/         shared by 2+ routes only, imported through each folder's index: brand/ (LogoMark, Wordmark),
                          ui/ (primitives: Menu, Sheet, Popover, ConfirmDialog, Field, ChoiceGroup, ChipGroup, UserAvatar,
                          AvatarStack, IconButton, BackLink), ui/date/ (DateTimeField), entry/ (EntryActions, KindIcon),
                          groups/ (NewGroupFields),
                          notes/ (LiveNotesEditor, EditorAvatars), providers/ (ContactActions, ProviderTypeIcon),
                          settings/ (SettingsFrame, SettingsPage parts), shell/ (FirstSyncPending)
  app/lib/                session, group, groupContext, appUrls, settingsNav, me, auth-client, rpc, api, initials, entryDisplay, format,
                          redirect, form, liveEntry, firstSync, liveNow, titleSuggestions, theme, lastGroup, groupSections,
                          timelineFilters, contactActions, providerDirectory
  app/lib/sync/           schema, client (lazy), index, timeline, notes, liveEntry, editors, titleSuggestions, members, providers
packages/auth/            @caretook/auth (emails.ts: auth emails through notify)
packages/notifications/   @caretook/notifications: registry, templates (react-email), notify + outbox, senders, cron, dev mail
packages/api/             @caretook/api: router, procedures, errors, dto, sync upload, HTTP handler
packages/data/            @caretook/data
  scripts/                migrate, seed, clear runners
  test/                   env guard, globalSetup, setup, fixtures
  src/constants/, errors/, permissions/
  src/db/                 client, types, migrate, clear, migrations/, seeds/
  src/db/schema/          tables + Zod (client-safe), vitals, userPreferences, noteDocument, noteYjs, noteEditors, provider, entryProvider, uuidV5
  src/models/, src/services/
```
