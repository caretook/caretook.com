import type { CalendarSettingsView } from "@caretook/data";

import { calendarSettingService, calendarSettingsChangeZSchema } from "@caretook/data";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";
import { feed } from "./feedProcedures";
import { overrides } from "./overrideProcedures";

// A member's calendar settings for one group (appointments-2): the
// "Calendar & reminders" page reads and writes them, each member only their
// own, viewers included. The owners' "Details outside Caretook" switch is
// `group.setDetailsAllowed`. Later slices add the feed, the reminder
// override and Google here, in their own groups.

const groupId = z.uuid();

/** The settings as the page shows them: ISO times, and never a feed token or its hash. */
const toSettings = (view: CalendarSettingsView) => ({
  ...view,
  detailsConsentAt: view.detailsConsentAt ? iso(view.detailsConsentAt) : null,
  feed: { active: view.feed.active, rotatedAt: view.feed.rotatedAt ? iso(view.feed.rotatedAt) : null },
});

export type CalendarSettings = ReturnType<typeof toSettings>;

export const calendars = {
  feed,
  overrides,
  settings: {
    /** The caller's own settings for a group they're in (the defaults until they change one). */
    get: authedProcedure
      .input(z.object({ groupId }))
      .handler(async ({ context, input }) =>
        toSettings(unwrap(await calendarSettingService.get(context, input.groupId))),
      ),
    /** Change the caller's own settings; details on records the consent, off clears it. */
    update: authedProcedure
      .input(calendarSettingsChangeZSchema.extend({ groupId }))
      .handler(async ({ context, input: { groupId, ...change } }) =>
        toSettings(unwrap(await calendarSettingService.update(context, groupId, change))),
      ),
  },
  group: {
    /** The owners' switch: whether members may let details leave Caretook. */
    setDetailsAllowed: authedProcedure
      .input(z.object({ groupId, allowed: z.boolean() }))
      .handler(async ({ context, input }) =>
        unwrap(await calendarSettingService.setDetailsAllowed(context, input.groupId, input.allowed)),
      ),
  },
};
