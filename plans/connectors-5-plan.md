# Plan: Connectors 5 (tags for a connected assistant)

> Source PRD: [`plans/connectors-5-prd.md`](connectors-5-prd.md). User-story numbers (US) refer to it. Item: B-861. Topic `connectors-5`, after `tags`.

## Status

| Slice | Wave | State                       | Merge into `prd/connectors-5` (slice commits) |
| ----- | ---- | --------------------------- | --------------------------------------------- |
| 1     | 1    | landed (249d8281a, PR #307) | 29d34f5fb (512c7c211, 58b08840f)              |
| 2     | 1    | landed (249d8281a, PR #307) | 204b120de (b8c2c3f97)                         |
| 3     | 2    | merged                      | 1d9918386 (4382ca75e)                         |
| 4     | 2    | merged                      | 49b163e76 (cfead6e83, 09c7f2ecb)              |

**Landing mode:** run everything through (dispatcher start; land each green wave without asking; real questions via `risa ask`).

**Backlog:** B-861 done (all four slices merged). No other items for this topic.

**Now (2026-11-27), the brief for the next session:** wave 1 landed in dev as 249d8281a (PR #307, CI components green run 46104945199, Codex clean, report a369); its docs are folded (connectors _Tools_ "Tags" line and consent version rule; tags _Limits_). Worktrees `-1`, `-2` removed. Wave 2 is merged (slices 3, 4 on opus). `risa rotate` refused (slice worktrees kept until green), so this session carries on: CI integration run out on 8c9164142; then `risa sync`, `risa serve connectors-5 --restart`, `risa browser --changed --base dev`, `risa pr connectors-5`, `risa review connectors-5 --wait`, land (the last landing), fold docs, `risa rm connectors-5-3`, `-4`, then `risa rm connectors-5`. Failures go to a fresh fix agent in `.loops/connectors-5-3` or `-4` (the old agents ended with this session).

- **Wave 2 docs to fold:** connectors _Tools_: `tag_record`, `untag_record` (`tagWrites.ts`; check live, in group, `canTagRecord` before any write, for untag too; new names folded by `tagKey`, made by `tagService.create`; untag never deletes a tag) and `tags` on records of list_timeline, list_todos, upcoming, list_providers, list_medications, search (one `tagsByRecord` per call, text ends ` · tags: …`). Tags _Limits_: connectors read and write tags. connectors.md is at its 10 KB budget: trim what you add.
- **Notes:** tool prose never says "pass" except "pass nextCursor" (registry test, B-695). A test seeding another group's tag makes it as that group's owner.

## Architectural decisions

Durable decisions every slice follows:

- **No migration, no new dependency, no new route, no prompt or scope change, no screen change** beyond the consent and privacy text (slice 2). Server-side tool work on `/mcp` only.
- **No service edits.** Tools call `tagService`, `recordTagService` and the existing list services as the member (`asMember`); the SQL scope and the tag rules (`canCreateTag`, `canTagRecord`, `tagKey`) are the only authority. `timelineEntryService` and `todoService` are `sync-safety-2`'s hot files: never touched here.
- **One tag support module** (`packages/api/src/connectors/tools/tagSupport.ts`, new; slice 1) holds resolving a tag, tags by record and live uses. Later slices import it and never edit it; a gap found later goes in that slice's own file.
- **Tools follow the registry's pattern:** `defineTool`, Zod input, failures as `isError` results, times through `zonedIso`, links through `links.ts`, the group from the grant. New reads join the never-returned sweep.
- **Tags are names on the wire, A to Z;** ids only where an assistant passes one back (`list_tags`, `tagged_items`). Colors are never sent.

## How to run this plan

- **Wave 1: slices 1 and 2 at once.** Slice 1 owns `tagSupport.ts`, the two read tools, the tools list and the new tag read test; slice 2 owns the consent and privacy text. They share no file.
- **Wave 2: slices 3 and 4 at once,** after slice 1 merges. Slice 3 owns `tagWrites.ts`, its test and its lines in the tools list; slice 4 owns the six list tools' files and its test. They share no file.
- **Start condition:** `tags` in `dev` (done). The consent question (a366) is answered: tags join the consent under a new version, existing connections get the tools at once. The PRD lands only with slice 2.
- **Beside other PRDs:** `med-intervals` (planned) edits connector tools, likely `list_medications` and the tools list; both are additive, so a sync keeps both. `sync-safety-2` (running) shares no file.
- **Checks:** stackless slices hand off on `pnpm prd check --quick`. The landing runs the full check once and `pnpm prd browser --changed --base dev` (no flows change; the consent screen's own component test covers slice 2).
- **Docs at landing:** fold into [connectors](../docs/domain/connectors.md) (_Tools_: the four tools, `tags` on records; consent version; near its budget, trim what you add) and [tags](../docs/domain/tags.md) (_Limits_: connectors now read and write tags).
- **When it's done:** `pnpm prd rm connectors-5` sets the row done.

## Slice 1: List tags and what carries one

Stack: no · Reads: docs/domain/connectors.md, docs/domain/tags.md · Tests: integration · Blocked by: none · Check: packages/api/src/connectors/tagTools.int.test.ts

User stories: 1, 2, 3, 8, 9, 10.

What to build (PRD _Tag support (one module the tag tools share)_, _Reads_, _Registry_):

- `packages/api/src/connectors/tools/tagSupport.ts` (new): `resolveTag(ctx, nameOrId)` (the group's tag by `tagKey` of a name, or by id; null when none), `tagsByRecord(ctx)` (one `recordTagService.listForGroup` plus `tagService.list`: record id to names A to Z), `liveUses(ctx)` (the live records carrying each tag, by kind, soft-deleted ones left out: one `list` per kind by the linked ids through each kind's service, never a `getById` per link). A gap goes here, never into a service (`timelineEntryService` and `todoService` are `sync-safety-2`'s).
- `packages/api/src/connectors/tools/listTags.ts` (new): `list_tags`.
- `packages/api/src/connectors/tools/taggedItems.ts` (new): `tagged_items` (`tag`, `kinds`, `pagingInput`), items in kind order with `tags` and `url`; an unknown tag answers with `tagFound: false`.
- `packages/api/src/connectors/tools/index.ts`: both at the end of the reads.

Acceptance criteria:

- Integration test `packages/api/src/connectors/tagTools.int.test.ts` (new): `list_tags` A to Z with live counts only (a soft-deleted record's link not counted); `tagged_items` by a name in another case and by id, by `kinds`, paged at 50, the soft-deleted record left out, an unknown name's answer; a tag in another group never appears; a viewer's read connection gets both.
- `packages/api/src/connectors/mcp.int.test.ts`: the never-returned sweep adds `list_tags` and `tagged_items` (the tools-by-scope check builds its list from the registry, so it picks them up unchanged).

Blocks: 3, 4.

## Slice 2: Consent and privacy name tags

Stack: no · Reads: docs/domain/connectors.md, docs/domain/marketing.md · Tests: unit, component · Blocked by: none · Check: apps/web/app/routes/connectors/connect/connect.browser.test.tsx

User stories: 11.

What to build (PRD _Consent and privacy_), as the user chose (a366):

- `packages/data/src/db/schema/connectors/connectorRules.ts`: `CONNECTOR_CONSENT_TEXT` names tags in its list; `CONNECTOR_CONSENT_VERSION` moves to the slice's date.
- `apps/web/app/routes/marketing/privacy/content.ts`: the assistant section's list names tags. Leave `lastUpdated` and `LEGAL_VERSIONS` alone, as the conditions change (B-181) did; if a test demands otherwise, move both together.

Acceptance criteria:

- Unit test `packages/data/src/db/schema/connectors/connectorRules.test.ts`: the text names tags, and a changed text has a changed version (whatever it checks today, updated).
- Component test `apps/web/app/routes/connectors/connect/connect.browser.test.tsx`: the consent shows the new text and records the new version.
- `apps/web/app/routes/marketing/sections/legal.test.ts` and `legalVersions.test.ts` still pass unchanged.

Blocks: nothing (the PRD lands only with it).

## Slice 3: Tag and untag a record

Stack: no · Reads: docs/domain/connectors.md, docs/domain/tags.md · Tests: integration · Blocked by: 1 · Check: packages/api/src/connectors/tagWrites.int.test.ts

User stories: 5, 6, 7, 8, 9.

What to build (PRD _Writes_, _Registry_):

- `packages/api/src/connectors/tools/tagWrites.ts` (new): `tag_record` and `untag_record` (`target`, `recordId`, `tags` 1 to 10). `tag_record` checks the record (live, in the group, `canTagRecord` for the member's role and its `created_by`) before any write, then per name `resolveTag` or `tagService.create`, then `recordTagService.link`; `untag_record` per name `recordTagService.unlinkPair`. Answers name new, already-there and not-carried tags, with the record's link (`links.ts` `entryPath`, `todoPath`, `providerPath`, `medicationPath`).
- `packages/api/src/connectors/tools/index.ts`: both at the end of the writes.

Acceptance criteria:

- Integration test `packages/api/src/connectors/tagWrites.int.test.ts` (new): a caretaker tags each kind with an existing and a new name ("urgent" lands on "Urgent"), a repeat adds nothing, untagging, a name not carried and one the group lacks; a viewer's connection and a read-only group are refused (`mcp:groupReadOnly`) with nothing written; a record in another group and a soft-deleted one are refused by the pre-check with no new tag left behind; the device-facing rows match the derived ids (`tagId`, `recordTagId`).

Blocks: nothing.

## Slice 4: Tags on every record an assistant reads

Stack: no · Reads: docs/domain/connectors.md, docs/domain/tags.md · Tests: integration · Blocked by: 1 · Check: packages/api/src/connectors/readTools.int.test.ts

User stories: 4.

What to build (PRD _Reads_, "Tags on records"):

- `tags` (names A to Z, empty when none) on each record, from one `tagsByRecord` per call, and at the end of a record's text line when there are any, in `packages/api/src/connectors/tools/listTimeline.ts`, `listTodos.ts`, `upcoming.ts` (events and todos), `listProviders.ts`, `listMedications.ts` and `search.ts`. No change to inputs, order or paging.

Acceptance criteria:

- Integration test `packages/api/src/connectors/readTools.int.test.ts`: one case seeds a tag on an entry, a todo, an event, a provider and a medication, and each of the six tools returns it on that record and an empty `tags` elsewhere; a tag from another group never appears.

Blocks: nothing.
