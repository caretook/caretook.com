# PRD: Connectors 5 (tags for a connected assistant)

Backlog item B-861. Topic `connectors-5`, after `tags`. A member's connected Claude or ChatGPT gets the group's tags: it lists them, finds what carries one, sees each record's tags, and adds or removes tags on records.

## Decisions

The costliest to change first.

| Decision                                                                                                                                                                                                               | Why                                                                                                                                                                               | Source                               | Cost to change later                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| Consent and privacy name tags under a new consent version; existing connections get the tag tools at once                                                                                                              | tag names can be health details, and the consent and privacy page list what is sent                                                                                               | PENDING (ask a366; recommended this) | medium: re-consent would need a gate on `/mcp` |
| "Groups that have turned on sharing medical information with connectors" is the existing Assistants switch (`connectors_enabled`): the tag tools exist only on `/mcp`, which already requires it; no new group setting | it is the group's one switch for sending its information to an assistant, and the item's words describe it; a second switch would need a migration and a screen nobody asked for  | assumed                              | high: a migration and a settings screen        |
| Tagging goes through `tagService` and `recordTagService` as the member, with the app's rules (`canCreateTag`, `canTagRecord`); no new permission                                                                       | one rule for who tags, app and assistant alike; the write scope reaches writers only (`scopesForRole`: viewers read, easy roles get nothing), and every writer may tag any target | assumed                              | medium: a permission rule                      |
| `tag_record` creates a tag the group doesn't have yet (its name folded by `tagKey`, so "urgent" lands on "Urgent"); the server picks its color                                                                         | the app's picker does the same for anyone who may log (`Add "<name>"`)                                                                                                            | assumed                              | low: one tool rule                             |
| No `via` on tags: a tag the assistant added looks like any other                                                                                                                                                       | `record_tag` has no `via` column, and tagging isn't writing to the care log; adding one is a migration                                                                            | assumed                              | medium: a migration                            |
| Rename, recolor, merge and delete of tags stay in the app                                                                                                                                                              | the item names list, filter, add and remove; those are the owner's or editors' upkeep                                                                                             | assumed                              | low: more tools later                          |
| "Filter by a tag" is one new read, `tagged_items` (every live record carrying a tag, each kind or some), not a `tag` input on each list tool                                                                           | the server's list services have no tag filter, and the timeline's (`timelineEntryService`) is a running topic's hot file; one tool mirrors the app's search by tag                | assumed                              | low: inputs later                              |
| Records in `list_timeline`, `list_todos`, `upcoming`, `list_providers`, `list_medications` and `search` carry their tag names                                                                                          | the app shows a record's chips everywhere; an assistant untagging or summarizing needs them                                                                                       | assumed                              | low: one field                                 |
| A tag the group doesn't have, in `tagged_items` or `untag_record`, is a plain answer naming `list_tags`, not a tool error                                                                                              | the assistant asked a fair question; nothing failed                                                                                                                               | assumed                              | low                                            |
| `tag_record` and `untag_record` take one record and up to 10 tag names                                                                                                                                                 | one confirm for "tag this Urgent and Insurance"; the client confirms each write                                                                                                   | assumed                              | low                                            |
| Colors aren't sent                                                                                                                                                                                                     | they mean nothing to an assistant                                                                                                                                                 | assumed                              | low                                            |

The skeptic pass (go) changed four things: the writers row now says only the write scope is writers-only, liveness is one read per kind (never per link) and stays out of the services, the plan drops a test line the registry already covers, and a tag left carrying nothing after a raced link is named as accepted. Nothing declined.

## Problem

A care group tags its timeline entries, events, todos, providers and medications ("Insurance", "Fall risk", "For the cardiologist"), and the app filters and searches by them. A member's connected assistant sees none of it: it can't say what's tagged "For the cardiologist" before a visit, and it can't tag what it adds or finds. The tags PRD kept tags in the app; the user decided on 2026-11-25 that connectors need them when the group shares its information with assistants.

## Solution

Four new tools and one new field on `/mcp`, for groups with Assistants on:

- **`list_tags`:** the group's tags A to Z, with how many live items carry each.
- **`tagged_items`:** everything live that carries a tag (entries and events, todos, providers, medications; all kinds or some), each with its link.
- **Tags on records:** the timeline, todos, upcoming, providers, medications and search answers list each record's tags.
- **`tag_record` and `untag_record`** (write connections only): add tags to one record, making a tag the group doesn't have yet, or take them off. The client asks the member first, as for every write.

The connect consent and the privacy page name tags among what is sent.

## User stories

1. As a member with a connected assistant, I want it to list my group's tags, so that I can ask about them by name.
2. As a member, I want my assistant to find everything tagged with one tag, so that I can say "what's tagged For the cardiologist?" before a visit.
3. As a member, I want to narrow that to one kind (just todos, just events), so that the answer is short.
4. As a member, I want my assistant to see each record's tags when it reads the timeline, todos, upcoming items, providers, medications or a search, so that its summaries match what the app shows.
5. As a caretaker with a read-and-write connection, I want my assistant to tag an entry, event, todo, provider or medication, so that what it logs or finds is filed the way the group files things.
6. As a caretaker, I want a new tag name to make the tag, folded onto an existing one when only case or spacing differs, so that the group never gets "urgent" beside "Urgent".
7. As a caretaker, I want my assistant to take a tag off a record, so that a wrong tag is fixed without opening the app.
8. As a viewer, I want my read-only connection to read tags but never change them, so that the group's rules hold through an assistant too.
9. As an owner, I want tags to reach assistants only while Assistants are on, and tagging to stop when I set assistants to read only, so that my existing switches still decide.
10. As a member of another group, I want my tags never to reach a connection granted elsewhere, so that groups stay apart.
11. As a member connecting an assistant, I want the consent and privacy page to say tags are sent, so that I know what I'm sharing.

## Implementation decisions

### Tag support (one module the tag tools share)

- A small tool-side module, built in the first slice and used by every later one: **resolve a tag** by a name (folded through `tagKey`, the only fold) or an id from `list_tags`, within the grant's group; **tags by record**, one `recordTagService.listForGroup` read joined to the group's tags, as a map from record id to tag names A to Z (what the list tools add to each record); and **live uses**, the live records carrying each tag, by kind (soft-deleted records keep their links and are never counted or listed). Liveness is one `list` per kind by the linked ids, never a read per link.
- Every read is the member's (`asMember`), so the services' SQL scope decides; `groupId` is the grant's, never an input.

### Reads

- **`list_tags`** (read scope): `tags` of `{ id, name, items, byKind }`, A to Z; the text lists "name (n items)". No tags: "No tags yet."
- **`tagged_items`** (read scope): input `tag` (a name or an id), optional `kinds` (`entry`, `todo`, `provider`, `medication`), the shared paging (`pagingInput`, pages of 50). Items in kind order (entries and events newest first by when they happened; todos open first, then done; providers and medications A to Z), each `{ kind, id, title, when or status, tags, url }` from the links module. An unknown tag answers "No tag named …; list_tags lists them." with `tagFound: false`. Times through `zonedIso`. Nothing the never-returned list names is added.
- **Tags on records:** each record in `list_timeline`, `list_todos`, `upcoming` (events and todos), `list_providers`, `list_medications` and `search` gains `tags` (names, A to Z; empty when none), from one tags-by-record read per call, and a line's text ends with them when there are any. No other change to those tools' input, order or paging.

### Writes

- **`tag_record`** (write scope, `WRITE_ANNOTATIONS`): input `target` (`entry`, `todo`, `provider`, `medication`; an event is an entry), `recordId`, `tags` (1 to 10 names, each `tagNameZSchema`). First it checks the record is live and in the group and that the member may tag it (`canTagRecord` with the member's role and the record's `created_by`), so a refusal leaves nothing behind. Then, for each name: the group's tag by key, else `tagService.create` (derived id, server-picked color); then `recordTagService.link`. Derived ids make a retry safe. A link that fails after the pre-check (a race) can leave a new tag carrying nothing, as the app's picker can; that is accepted. The answer: "Tagged <record> with A, B (new tag: B)", "already had" for tags it carried, and the record's link.
- **`untag_record`** (write scope): the same `target` and `recordId`, `tags` (1 to 10 names). Each known tag goes through `recordTagService.unlinkPair`; a tag the record didn't carry, or the group doesn't have, is named in the answer, not an error. Never deletes a tag.
- Both are refused like every write on a read connection, a demoted viewer or a read-only group (`mcp:groupReadOnly`); service refusals come back as `isError` results with their codes.
- Devices see the changes through sync as they do any server write: `tag` and `record_tag` are already in the `care_groups` stream. No device or sync change.

### Consent and privacy

- `CONNECTOR_CONSENT_TEXT` names tags in its list, and `CONNECTOR_CONSENT_VERSION` moves, so new grants record the words that name them. Existing grants keep their recorded version and get the tools at once, as when todos (tasks-2) and conditions were added.
- The privacy page's assistant section names tags. The consumer health data policy speaks of "the health data you can see" and doesn't change.

### Registry

- `tools/index.ts` adds `list_tags` and `tagged_items` at the end of the reads, `tag_record` and `untag_record` at the end of the writes. No new prompt, scope, route, migration or dependency.

## Testing decisions

- **Integration** (prior art: `readTools.int.test.ts`, `addProvider.int.test.ts`, `mcpReadOnly.int.test.ts`, with `connectAssistant`, `callTool`, `toolResultOf`): seeds a group's tags on each kind, including one on a soft-deleted record and one in another group. Reads: `list_tags` counts live items only; `tagged_items` by name in any case and by id, by kind, paged, an unknown name; the list tools carry `tags`; nothing from another group. Writes: tagging with an existing and a new name (folded), a repeat, untagging, a tag not carried, a viewer's and a read-only group's refusal, a record in another group, a soft-deleted record. The never-returned sweep covers the new reads.
- **Unit:** tag support's pure parts (folding and resolving by name or id, the map to names) beside it, if any logic lives outside the services.
- No component or browser tests: no screen changes beyond the consent and privacy text (covered by their existing tests), and the sync of tags is already in `roundtrip` and the sync matrix.

## Out of scope

- Renaming, recoloring, merging and deleting tags through an assistant.
- A `tag` input on the existing list tools, and tags as an input to the existing write tools (`add_note`, `add_todo` …): tag after with `tag_record`.
- Tags on conditions, care periods or a series as a whole (the app doesn't tag them).
- A `via` mark on tags, a new group setting, prompts that use tags.
- Tags in the calendar feed, email or print views (still the tags doc's _Limits_).

## Notes

- `docs/domain/tags.md` _Limits_ says no connector tool reads tags; the landing fold changes it and adds the tools to `docs/domain/connectors.md` _Tools_ (near its budget: trim what you add).
- `sync-safety-2` is running on `timelineEntryService` and `todoService`; nothing here edits a service. `med-intervals` (planned) edits connector tools too, `list_medications` likely: both add to it, so a sync keeps both.
