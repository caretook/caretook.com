# Standing preferences

For planning agents: what the user has already decided, so nobody asks again. Read it before choosing what to ask ([planner](planner.md#what-to-ask)); a decision taken from here is `preference` in a PRD's _Decisions_ table.

- **Adding one:** when the user's answer states a rule that will outlast the topic (not a one-off choice), add a line on your `plan/` branch: the rule, then the topic and date it came from.
- **Changing one:** only on the user's word. A rule every session needs belongs in AGENTS.md, and an area's in its area doc, not here.

## Product

- **Layout and visual design are decided, not asked:** how a page or component looks, which pages get a new look first and which optional extras to add. Take the smallest version and list it as assumed; the user vetoes by reading the table. (ui-kit, 2026-11-21)
- **Links between records are many to many**, not one slot on a row: "any todo's linked or discussed in the note can be linked. Similarly any event." Model a new link as a join table like the note-to-provider links. (planner-3, 2026-11-21; the general rule is the planner's reading of an answer about notes, todos and events)
- **Say "event", not "appointment":** "there is no such thing as an appointment". New wording and plans say event; renaming existing screens is its own change. (planner-3, 2026-11-21; the second half is the planner's reading)

## Planning and slices

- **No data migration for rows that don't exist:** production has no data and staging is reset after a change, so plan the schema change alone; a migration carries only what the schema change needs to apply (no backfills, conversions or relinks for hypothetical rows). (contract-migrations, 2026-11-28; "until production has data" is the planner's reading)
- **A PRD stays small** (about six slices): cut a bigger one into follow-on topics rather than ask. (orchestration-2, 2026-11-21)
- **Small fixes land by category**, never mixed; the order between categories is the user's and isn't set yet. (orchestration-2, 2026-11-21)
- **A question must reach the user's phone** (a PushNotification from the asking session); a desktop notification isn't enough. (orchestration-2, 2026-11-21)
- **Only questions are pushed, and only through the ask system:** the one PushNotification a session sends is the line `risa ask --question` prints. Reports (planned, landed, tidy), progress and failures are filed as asks and never pushed. (the user, 2026-11-21)
- **Default on silence:** a recommended question, a planner's included, takes its recommendation after 30 minutes unless answered (`--defaults`). Never (`--waits`): money (a paid service too), data loss or a change to existing data, a live deploy (staging or production), a destructive step (deleting unmerged work, a forced push), a new dependency (the user's approval), compliance; and when unsure. (agent-autonomy, 2026-11-22)
- **A skeptic's go is enough for a risky landing:** `land --force` and `--no-review` go ahead on a fresh Fable skeptic's go without asking; its verdict is in the landing report for a veto after. It never decides the never list. (agent-autonomy-3, 2026-11-22)
- **Unattended runs never spend extra usage:** they stop at the plan's 5-hour or weekly limit and wait for the reset. (self-recovery, 2026-11-22)
- **Unattended runs:** a dispatcher starts everything in the PRD table's row order, and a green wave lands in `dev` before the user tries it. (orchestration-2, 2026-11-21)
- **No hold after planning:** a topic the dispatcher planned may start at once, before the user reads its assumed decisions; `hold` and row order are the brakes. (orchestration-3, 2026-11-21)
