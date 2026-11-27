// Links in tool answers to what a write made, on our own origin. The paths
// are the app's (apps/web `appUrls`: `entry`, `editSheet`, `passSheet`,
// `todo`, `profile`, `provider`, `medication`), which this package can't
// import; links.test.ts keeps them equal.

const groupPath = (groupId: string) => `/app/groups/${encodeURIComponent(groupId)}`;

/** Where a member checks an entry: a note's or event's page, else its edit sheet over the timeline. */
export const entryPath = (groupId: string, entry: { id: string; kind: string }) =>
  entry.kind === "note" || entry.kind === "event"
    ? `${groupPath(groupId)}/entries/${encodeURIComponent(entry.id)}`
    : `${groupPath(groupId)}/timeline/${encodeURIComponent(entry.id)}/edit`;

/** One round of a pass's doses (Given all), as the pass sheet shows it. */
export const passLogPath = (groupId: string, passLogId: string) =>
  `${groupPath(groupId)}/timeline/pass/${encodeURIComponent(passLogId)}/edit`;

/** A todo's page. */
export const todoPath = (groupId: string, todoId: string) =>
  `${groupPath(groupId)}/todos/${encodeURIComponent(todoId)}`;

/** The care recipient's profile page (where a condition's conditions card is). */
export const profilePath = (groupId: string) => `${groupPath(groupId)}/profile`;

/** A provider's page. */
export const providerPath = (groupId: string, providerId: string) =>
  `${groupPath(groupId)}/providers/${encodeURIComponent(providerId)}`;

/** A medication's page. */
export const medicationPath = (groupId: string, medicationId: string) =>
  `${groupPath(groupId)}/medications/${encodeURIComponent(medicationId)}`;

/** `path` on `origin` (a bare path when there's none). */
export const linkTo = (origin: string | undefined, path: string) => `${origin ?? ""}${path}`;
