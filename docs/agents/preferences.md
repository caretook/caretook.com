# Standing preferences

For planning agents: what the user has already decided, so nobody asks again. Read it before choosing what to ask ([planner](planner.md#what-to-ask)); a decision taken from here is `preference` in a PRD's _Decisions_ table.

- **Adding one:** when the user's answer states a rule that will outlast the topic (not a one-off choice), add a line on your `plan/` branch: the rule, then the topic and date it came from.
- **Changing one:** only on the user's word. A rule every session needs belongs in AGENTS.md, and an area's in its area doc, not here.

## Product

(none yet)

## Planning and slices

- **A PRD stays small** (about six slices): cut a bigger one into follow-on topics rather than ask. (orchestration-2, 2026-11-21)
- **Small fixes land by category**, never mixed; the order between categories is the user's and isn't set yet. (orchestration-2, 2026-11-21)
- **A question must reach the user's phone** (a PushNotification from the asking session); a desktop notification isn't enough. (orchestration-2, 2026-11-21)
- **Unattended runs:** a dispatcher starts everything in the PRD table's row order, and a green wave lands in `dev` before the user tries it. (orchestration-2, 2026-11-21)
