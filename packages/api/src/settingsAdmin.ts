import { appSettingService, isAppSettingKey, staffReasonZSchema } from "@caretook/data";
import { z } from "zod";
import { unwrap } from "./errors";
import { staffProcedure } from "./procedures";

// `admin.settings.*` (admin PRD): the settings staff change without a
// deploy. Every staff member reads them (`settings.read`); only admins
// change them (`settings.write`), with a reason, and each change is in the
// audit log. Values are checked against the APP_SETTINGS registry: a bad one
// is a 400 with issues on `value…`.

const key = z.string().refine(isAppSettingKey, "There's no such setting");

export const settingsAdmin = {
  /** Every setting: its value, its default, whether it's still the default, and when it last changed. */
  list: staffProcedure("settings.read").handler(async ({ context }) =>
    unwrap(await appSettingService.list(context)),
  ),

  /** Change one setting (admins), with why. Returns the key, its value, and whether it changed. */
  set: staffProcedure("settings.write")
    .input(z.object({ key, value: z.unknown(), reason: staffReasonZSchema }))
    .handler(async ({ context, input }) => {
      const res = await appSettingService.setSetting(context, {
        key: input.key,
        value: input.value,
        reason: input.reason,
      });
      return unwrap(res);
    }),
};
