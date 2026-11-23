# PRD: Assistant access (an owner's read-only choice for a group's assistants)

Backlog item B-558. Topic `assistant-access`. **Done:** its rules are in [connectors](../docs/domain/connectors.md) and [care-groups](../docs/domain/care-groups.md).

## Decisions

The costliest to change first. Nothing new was asked: the user settled the product rules on 2026-11-22 (the item's note).

| Decision                                                                                                                                      | Why                                                                                                      | Source                        | Cost to change later                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| One group setting, stored as an additive `care_group.connectors_read_only` (not null, default false)                                          | every existing and new group stays read and write, so no stored data changes meaning                     | asked: as recommended (B-558) | high: a migration                                 |
| Owners only can change it; admins and everyone else see it                                                                                    | the same rule as the Assistants switch                                                                   | asked: as recommended (B-558) | low: one service rule                             |
| Read only keeps connections and removes writing on each connection's next call                                                                | no one has to reconnect                                                                                  | asked: as recommended (B-558) | medium: the `/mcp` gate                           |
| Switching back restores writing for connections approved for it, with no reconnecting                                                         | the stored grant keeps what its member approved                                                          | asked: as recommended (B-558) | medium                                            |
| A connection made during read only is a read grant and stays read after switching back; its member reconnects to add writing                  | writing was never approved on it, and consent must mean what the member saw                              | assumed                       | medium: grants would need a second approved scope |
| Reconnecting an approved assistant during read only replaces its grant with a read grant                                                      | one live grant per member and client already holds, and the screen says read only                        | assumed                       | medium                                            |
| A write call during read only is a normal tool refusal (`isError`, code `mcp:groupReadOnly`), never the 403 `insufficient_scope` challenge    | that challenge invites a client to re-authorize, which can't help here; clients also keep old tool lists | assumed                       | low: one reply                                    |
| The setting survives turning Assistants off and on                                                                                            | an owner who chose read only shouldn't silently get writing back                                         | assumed                       | low                                               |
| The column is synced and never uploaded, like `connectors_enabled`                                                                            | every member's Assistants page reads it from the device, offline too                                     | assumed                       | low: one stream column                            |
| The consent text and version don't change                                                                                                     | the consent covers what is read; read only sends nothing new                                             | assumed                       | low                                               |
| No email or notice when the setting changes                                                                                                   | the user's call                                                                                          | asked: as recommended (B-558) | low                                               |
| Shown as "Read only, set by the group owner" in Assistants settings, Connected assistants (group settings and Devices) and the connect screen | the item's words                                                                                         | asked: as recommended (B-558) | low                                               |
| The control is a toggle in the AI assistants card, shown while Assistants are on; turning read only on or off saves at once with no confirm   | smallest version on the existing screen; it disconnects nothing and undoes in one tap                    | assumed                       | low                                               |

The skeptic pass changed three things: "caused by the group" now means the connection could write with the flag off (so a demoted viewer is never told the owner set it), the shared label has one home in the rules module, and the plan names the files shared with other PRDs. It also flagged the reconnect row above as narrowing "no reconnecting"; kept, because a grant must record what its member saw, and listed in the report for a veto.

## Problem

An owner who lets members connect Claude or ChatGPT today has one choice: assistants on, or off. On means any connection a caretaker approved for writing can add to the care log. An owner who wants the help of an assistant reading the log, but wants only people writing to it, has no way to say so short of turning assistants off for everyone.

## Solution

Group settings → Assistants gets an owner-only choice between read and write (the default) and read only.

- **Read only:** connections stay. On their next call they lose the write tools and any write is refused with a plain reason. New connections can only read.
- **Back to read and write:** connections approved for writing can write again, with nothing to reconnect.
- Members see why: Assistants settings, Connected assistants and the connect screen all say **Read only, set by the group owner**.

## User stories

1. As an owner, I want to set my group's assistants to read only, so that assistants can help people understand the log without adding to it.
2. As an owner, I want read and write to stay the default, so that groups already using assistants keep working.
3. As an owner, I want read only to apply without disconnecting anyone, so that members don't have to set their assistants up again.
4. As an owner, I want to switch back and have approved connections write again, so that trying read only costs nothing.
5. As an admin, I want to see the setting but not change it, so that the choice stays with owners.
6. As a member, I want my assistant to tell me plainly that the group is read only when it can't write, so that I don't keep retrying.
7. As a member, I want Assistants settings and my Connected assistants to say read only was set by the owner, so that I know whom to ask.
8. As a member connecting an assistant, I want the connect screen to say the group is read only, so that I know what I'm approving.

## Implementation decisions

- **Connector rules (the pure, client-safe module):** the scope rules take the group's read-only flag. What a member may grant in a group, and what a grant may do now, both narrow to read when it is set. It also answers whether the group is the cause: true only when the scope would be read and write with the flag off, given the grant, the member's current role and (on `/mcp`) the token's scopes. It holds the label "Read only, set by the group owner", beside `CONNECTOR_SCOPE_LABELS`. The stored grant never changes when the setting does.
- **`care_group`:** adds a migration for `connectors_read_only`. `careGroupService.update` treats it as an owner-only field, as it does the switch, including the refusal for anyone else and for a multi-group filter. Changing it revokes nothing. `careGroup.update` takes `connectorsReadOnly`.
- **`connectorGrantService`:** `verify` rechecks the flag on every call and returns the narrowed scope plus whether the group caused it (the rules module's answer). `grant` refuses a read-and-write grant on a read-only group with a new `connectorGrantService:groupReadOnly`, whose message the connect screen shows (the page may be stale).
- **`/mcp`:** `tools/list` and `prompts/list` follow the narrowed scope with no new code. A write call blocked by the group returns the `mcp:groupReadOnly` tool refusal; any other read connection (a read grant, a demoted viewer) keeps today's 403. `group_overview` adds `you.groupReadOnly`, beside `canAddEntries`.
- **`connector.listMine`, `listForGroup`:** each connection adds `readOnlyByOwner`, the rules module's answer from the grant, its member's current role and the group's flag. A read grant keeps the plain "Read only".
- **Sync:** the `care_groups` stream and the device schema add the column. The deploy already runs migrate, roles, then the sync config, so the column exists first.
- **Screens:** Assistants settings (the owner's control, everyone's status), Connected assistants in group settings and Devices, and the connect screen (a read-only group offers only read, with the reason).

## Testing decisions

- **Unit:** the connector rules, every role with the flag on and off.
- **Integration:** `careGroup.update` by role; `verify`, `grant`, and `/mcp` through real tokens (`connectAssistant`): tools narrow, a write is refused with no write made, switching back restores it, a read grant stays read. Prior art: `connectorGrant.int.test.ts`, `mcpWrites.int.test.ts`, `connector.int.test.ts`. The new `/mcp` tests go in their own file, because `mcpWrites.int.test.ts` is hot for `connectors-3`.
- **Component:** the Assistants page, the connect screen and Devices, in their existing browser test files.
- **No new end-to-end step:** nothing crosses sync except one read-only column, which `syncRegistry.test.ts` checks against the device schema.

## Out of scope

- Per-member or per-assistant write limits, and limits by kind of entry.
- Notifying members of a change.
- One grant per member and client (B-340), and ending assistants when sessions end (B-329): `account-security`.
- The connector tools in `connectors-3`.

## Notes

- A write already past `verify` when an owner flips the setting finishes; the next call is refused.
- At landing, fold the rule into [connectors](../docs/domain/connectors.md) and [care-groups](../docs/domain/care-groups.md).
