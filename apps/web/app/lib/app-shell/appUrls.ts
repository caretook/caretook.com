import { appointmentUrls } from "../appointments/urls";
import { calendarUrls } from "../calendars/urls";
import { carePeriodUrls } from "../care-periods/urls";
import { careGroupUrls } from "../care-groups/urls";
import { groupHome } from "../core/urls";
import { liveNoteUrls } from "../live-notes/urls";
import { medicationUrls } from "../medications/urls";
import { profileUrls } from "../profiles/urls";
import { providerUrls } from "../providers/urls";
import { searchUrls } from "../search/urls";
import { todoUrls } from "../todos/urls";
import { timelineUrls } from "../timeline/urls";
import { appShellUrls } from "./urls";

// Every path inside the app, built in one place. Links, redirects and
// navigations call these; nothing else writes an `/app/…` string, so moving a
// route changes one builder (and its area's `routes.ts`), not every link.
//
// Each area writes its own builders and param constants in `lib/<area>/urls.ts`
// and this composes them; the shared helpers (`Search`, `searchString`) are in
// `lib/core/urls.ts`. Callers import the param constants from the area's part.
//
// - Ids are encoded as path segments.
// - A search is carried through: a string (with or without the `?`),
//   `URLSearchParams`, or a record whose null, undefined and empty values are
//   dropped. Parameters with an empty value are dropped from any of them.
// - No React or router here; unit-tested in web:unit.

export const appUrls = {
  ...appShellUrls,
  groupHome,
  ...timelineUrls,
  ...liveNoteUrls,
  ...careGroupUrls,
  ...providerUrls,
  ...medicationUrls,
  ...appointmentUrls,
  ...profileUrls,
  ...searchUrls,
  ...carePeriodUrls,
  ...todoUrls,
  ...calendarUrls,
} as const;
