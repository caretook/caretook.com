# PRD: Code health 2 (one soft-delete model, one upsert)

Topic `code-health-2`. Backlog item B-362 (from the 2026-11-21 code review, cut from `code-health` by its planner). Plan: [`plans/code-health-2-plan.md`](code-health-2-plan.md).

## Decisions

| Decision                                                                                                                                                                                                                  | Why                                                                                                                                                               | Source                                                    | Cost to change later              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| B-363 (the role table) moves to a new follow-on topic, `code-health-4`, with no `After`                                                                                                                                   | the models and upserts fill six slices of four files or fewer; the role work is independent of them and needs three more; the design below (_Notes_) goes with it | preference (a PRD stays small: cut into follow-on topics) | low: a backlog move               |
| B-362's device half (`refuse`, `invalid`, `canWrite` in the `*.sync.ts` writers, the hand-rolled FormData reads, the identical `shouldRevalidate`s) and the server's one `invalid` move to `code-health-3`, as a new item | the device files are `code-health-3`'s and `data-rights`' hot files; `code-health-3` runs after this topic; the services' `invalid` sweep touches 24 files        | preference (a PRD stays small)                            | low: a backlog move               |
| The timeline entry's upsert stays as it is (a second guard exception)                                                                                                                                                     | its dose steps after the identity check don't fit the helper's fixed order                                                                                        | assumed (skeptic s98)                                     | low                               |
| `todoService`'s upsert stays as it is until `data-rights` lands; the upsert guard lists it as its one exception, and the device-half item picks it up                                                                     | `todoService.ts` is `data-rights`' hot file                                                                                                                       | assumed                                                   | low: one service                  |
| No behaviour change, no migration, no new dependency                                                                                                                                                                      | a refactor topic; every existing test passes unchanged                                                                                                            | assumed                                                   | high if broken: it would be a bug |
| The factory returns the functions the models export today, by the same names; a model with more spreads it and keeps its own                                                                                              | no caller changes                                                                                                                                                 | assumed                                                   | medium                            |
| The guards are unit tests reading source, not lint rules                                                                                                                                                                  | the prior art for "this folder may not do X" is a layout test (`libLayout.test.ts`)                                                                               | assumed                                                   | low                               |

Skeptic: s98 sent it back (the timeline entry's upsert doesn't fit the helper; the timeline model's `update` and `remove` were missed; the new items' waits); fixed. s99 went go; its nits taken: the dose-restore write named in slice 3, the row's hot files narrowed.

No question was asked: nothing here is on the planner's _What to ask_ list (the deferrals follow the standing preference).

## Problem

From the side of whoever works on Caretook's data layer:

- Nine soft-delete models are the same file: the `live` filter, `get`, `getById`, `list` with a default order, `update` on live rows, and a 25-line `remove` that sets `deletedAt` under the delete permission. A fix to one (a new column on soft delete, a changed error) has to be made nine times, and a tenth model will be copied from one of them.
- Nine services repeat (the timeline entry's with dose steps of its own) the same create-if-absent upsert: look the id up as the system (deleted rows included), create when absent, else look it up as the actor, refuse when they can't see it, refuse when its group (or recipient, or kind) differs, else return it unchanged. Each copy is a chance to get the order wrong, and that order is the security property: an id the actor can't see is refused without saying whether it exists.

## Solution

- **One soft-delete model factory.** Every soft-delete model gets its reads, `update` and `remove` from one factory with the base model. Each model file keeps only its schema name, its default order and what is its own. A guard refuses a hand-written soft delete outside the base.
- **One create-if-absent upsert.** One helper carries the lookup order (as the system, then as the actor), the refusal and the immutable-field check; each service's `upsert` says only how to create and which fields never change. A guard refuses a service that builds an upsert result by hand.

## User stories

1. As a developer adding a soft-delete table, I want its model from one factory, so that its reads hide deleted rows and its delete syncs without copying another model.
2. As a developer changing how soft delete works, I want one place to change, so that every soft-delete table behaves the same.
3. As a reviewer, I want a model that hand-writes a soft delete refused, so that the factory stays the one way.
4. As a developer writing a device-uploadable service, I want one create-if-absent helper, so that the replay rule (a PUT never edits) and the refusal order are the same in every service.
5. As a security reviewer, I want the "refuse an id the actor can't see, without saying whether it exists" rule in one place, so that it's checked once and can't drift.
6. As a reviewer, I want a service that builds an upsert result by hand refused, so that new services use the helper.

## Implementation decisions

### Soft-delete model factory

- A factory beside the base model's `getFunctions`, taking the schema name, the row mapper and an optional default order. It returns `live` (the filter helper, which adds `deletedAt is null` unless a read asks for deleted rows), `get`, `getById`, `list` (the default order when the caller gives none), `create`, `update` (live rows only) and `remove` (sets `deletedAt` and `updatedBy` under the table's delete permission, with the same errors as today: no filter, nothing removed, and the model-named database error code).
- The `IncludeDeleted` option type is defined once in the factory's module; each model re-exports it under the same name.
- A model with more (the provider's and pass's `lockLive`, the timeline entry's cursor pages and `mayChange`, the todo's `restore` and locks, the series' top-up queries) spreads the factory's result and keeps its own functions, using the factory's `live`.
- The order constants (`NAME_ORDER`, `TRACK_ORDER` and the rest) stay exported from each model under their names; services and tests read them.
- Error codes stay byte for byte what each model returns today. The remove's database error is named after the model (`recipientAllergyModel:remove`), and the factory derives it from the schema name.

### Create-if-absent upsert

- A helper beside `asCreated` and `unchanged`. It takes the transaction context, a way to read a row by id with deleted rows included (as a given actor), the id, a `create` thunk and an `immutable` check that returns the error to send when an identity field differs (or nothing). It returns what each `upsert` returns today: `created` with the new row, `unchanged` with the visible row, the refusal for an id the actor can't see, the immutable error, or a database error.
- The order is fixed inside it: existence as the system (deleted included); absent → create; present → read as the actor (deleted included); not visible → the actor's refusal; identity differs → the immutable error; else unchanged.
- Parsing stays in each service (each has its own schema and error code). Service-specific steps before the lookup (the dose lock on timeline entries, the change entry's date clamp) stay in the service.
- After the sweep only the helper's module uses `asCreated` and `unchanged`; a guard refuses any other service that imports them, with two exceptions: `todoService` until `data-rights` lands, and the timeline entry's `upsert`, which after the identity check records a dose upload, may restore a deleted dose as created, and checks the future and the medication (a hook for that would make the helper as complex as the one case it serves).

## Testing decisions

- **No existing test changes.** The service integration tests (`packages/data/src/services/*.int.test.ts`, `upsertReplay.int.test.ts` above all: one replay case per soft-delete service) are the proof the refactor kept behaviour: soft-delete reads, the delete permission, upsert replays, refusals and immutable fields are already covered per table.
- **The factory:** one integration test against a real soft-delete table: live reads hide a deleted row, `includeDeleted` shows it, `update` skips it, `remove` sets `deletedAt` and `updatedBy`, needs a filter, and does nothing for a role without the delete permission (prior art: `packages/data/test/fixtures.ts`).
- **The upsert helper:** one integration test through a real model: absent → created; replay → unchanged and not edited; an id in another group → the actor's refusal; a changed identity field → the immutable error.
- **Guards:** two unit tests reading source (prior art: `apps/web/app/libLayout.test.ts`): no model outside the base writes `deletedAt` itself or defines its own `live`; no service but the helper's module imports `asCreated`/`unchanged`, `todoService` and the timeline entry excepted (and the test fails when the exception no longer needs listing).
- No component, end-to-end or browser checks: nothing a screen does changes.

## Out of scope

- B-363, the role table (`code-health-4`).
- The device side of B-362, the server's one `invalid` and `todoService`'s upsert (a new `code-health-3` item).
- B-364, B-368, B-369 (`code-health-3`).

## Notes

- The review's counts were a reviewer's reading. The planner's on 2026-11-28: soft-delete models with the identical `live`/`remove` block: recipient allergy, recipient condition, care period, medication, provider, medication pass, event series, todo and timeline entry (the timeline entry's `list` has no default order; its `update` and `remove` are the shared shape); create-if-absent upserts: those nine services' `upsert`; local `invalid` definitions: 24 in services, 8 on the device. Each slice re-derives its list on its own base.
- **For `code-health-4`'s planner (B-363), what this planner found:** simple-mode already built the role sets (`WRITER_ROLES`, `LOGGER_ROLES`, `EASY_ROLE_NAMES`, `GROUP_MANAGER_ROLES`, `OWNER_ROLES`) and the `is…` checks, and the API's invite and join-request checks use `GROUP_MANAGER_ROLES`. Left: the todo completers' set (`TODO_COMPLETER_ROLES` in `domain/todos/todoRules.ts`) into the role module; an owner check; the staff-settable (`domain/admin/groupAdminRules.ts`) and invitable (`db/schema/care-groups/inviteRules.ts`) lists derived from the role names; a unit test tying `powersync/sync-config.yaml`'s hand-listed non-writers (`role != 'viewer' AND …`) to the role module; `isUserRoleName` removed (no reader); `isGroupRoleName` kept (three readers); a lint rule in `scripts/eslint/plugin.mjs` refusing `role === "<name>"` outside the role module, with an exempt list (the kit guard's pattern); then the call-site sweep: "owner" checks in about 25 files, many of them `data-rights`' and `account-security-2`'s hot files, so the sweep waits for both to land.
