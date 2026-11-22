# Plan: Assistant access (an owner's read-only choice for a group's assistants)

> Source PRD: [`plans/assistant-access-prd.md`](assistant-access-prd.md). User-story numbers (US) refer to it. Backlog item B-558. Topic `assistant-access`.

## Status

**Where it stands:** planned (2026-11-22), not started.

| Slice | Wave | State       | Merge into `prd/assistant-access` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------------------- |
| 1     | 1    | not started |                                                   |
| 2     | 2    | not started |                                                   |
| 3     | 2    | not started |                                                   |

**Backlog:** slice 1 claims B-558; run `pnpm backlog done` on it when slice 3's wave has merged.

## Architectural decisions

Durable decisions every slice follows:

- **One stored flag:** `care_group.connectors_read_only`, default false. A grant's stored scope never changes when the flag does.
- **The server is the authority.** `verify` applies the flag on every `/mcp` call; screens only explain it.
- **One rule:** the connector rules module decides what a member may grant and what a grant may do now. Nothing else compares the flag to a scope.
- **Owners only** change it, in `careGroupService.update`. It is synced and never uploaded.
- **A group-caused refusal is a tool result** (`mcp:groupReadOnly`), never the 403 re-authorize challenge.
- **No new dependency, route, role or consent version.** One additive migration, in slice 1.

## How to run this plan

- **Wave 1:** slice 1. **Wave 2:** slices 2 and 3 at once; they share no screen.
- **Beside other PRDs:** every shared edit is small and additive, so no regions slice is needed ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)). Slice 1 touches `careGroup.ts` in the API and `careGroupService` (`onboarding`) and `group_overview` (`connectors-3`, which doesn't touch the scope gate). Slice 2 touches `sync-config.yaml` and the device schema (`symptom-catalog`, `planner-3`). New `/mcp` tests go in their own file, not `mcpWrites.int.test.ts`.
- **Checks:** slices hand off on `pnpm prd check --quick`. No browser check changes.
- **Docs at landing:** [connectors](../docs/domain/connectors.md) and [care-groups](../docs/domain/care-groups.md).

## Slice 1: Read only on the server

Stack: no · Reads: docs/domain/connectors.md, docs/domain/care-groups.md, docs/domain/data-layer.md, docs/domain/api.md · Tests: unit, integration

**User stories:** 1, 2, 3, 4, 5, 6.

**Build:** adds a migration for the column; the connector rules with the flag, the "caused by the group" answer (true only when the scope would be read and write with the flag off) and the shared label "Read only, set by the group owner"; the owner-only rule and `careGroup.update`'s `connectorsReadOnly`; `verify`, `grant` and `connectorGrantService:groupReadOnly`; the `/mcp` refusal and `group_overview`'s `you.groupReadOnly`; `readOnlyByOwner` on `connector.listMine` and `listForGroup`.

**Acceptance criteria:**

- [ ] Unit: the connector rules narrow to read for every role with the flag on, and are unchanged with it off.
- [ ] Integration: an owner can change the flag; an admin, caretaker, viewer and non-member can't; changing it revokes nothing; an existing group reads as read and write.
- [ ] Integration (real tokens): under read only, `tools/list` has no write tools, a write returns `mcp:groupReadOnly` as a 200 tool result and writes nothing, and reads still work.
- [ ] Integration: switching back restores writing on the same token; a read grant made during read only stays read.
- [ ] Integration: `grant` refuses read and write on a read-only group; a read grant in a read-and-write group keeps its 403.
- [ ] Integration: `readOnlyByOwner` is true only for a connection that could write with the flag off; a caretaker demoted to viewer with a stored read-and-write grant gets false and keeps the 403.

**Blocked by:** none. **Blocks:** 2, 3.

## Slice 2: The owner's control in Assistants settings

Stack: no · Reads: docs/domain/connectors.md, docs/domain/components.md, docs/domain/sync.md, docs/domain/app-shell.md · Tests: unit, component

**User stories:** 1, 4, 5, 7.

**Build:** the column in the `care_groups` stream and device schema; the owner's toggle while Assistants are on; the status for everyone else, offline too; "Read only, set by the group owner" on the group's Connected assistants.

**Acceptance criteria:**

- [ ] Unit: `syncRegistry.test.ts` passes with the new column in the stream and the device schema.
- [ ] Component (`assistants.browser.test.tsx`): an owner turns read only on and off and the update is sent; a refused change shows what's saved.
- [ ] Component: an admin, caretaker and viewer see the status with no control, from local data.
- [ ] Component: a connection with `readOnlyByOwner` shows the owner label; a plain read grant shows "Read only".

**Blocked by:** 1. **Blocks:** none.

## Slice 3: The connect screen and Devices

Stack: no · Reads: docs/domain/connectors.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 7, 8.

**Build:** the connect page's groups carry the flag and offer only read for a read-only group, with the reason; a stale page's refused Connect shows the error; Settings → Devices shows the owner label.

**Acceptance criteria:**

- [ ] Integration: `loadConnectPage` offers only read for a read-only group, and both scopes to a writer otherwise.
- [ ] Unit (`connect.test.ts`): the page's scopes follow the flag.
- [ ] Component (`connect.browser.test.tsx`): a read-only group shows "Read only, set by the group owner"; picking another group brings its choices back.
- [ ] Component: a Connect refused with `groupReadOnly` shows its message and connects nothing.
- [ ] Component (`devices.browser.test.tsx`): a connection with `readOnlyByOwner` shows the owner label.

**Blocked by:** 1. **Blocks:** none.
