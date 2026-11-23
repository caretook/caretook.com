import { ORPCError } from "@orpc/server";
import {
  avatarChoiceZSchema,
  readAvatarChoice,
  resolveDaySummaryMode,
  resolveEasyModeSetting,
  resolveSetupDismissed,
  resolveTimelineView,
  resolveUnits,
  userPreferencesZSchema,
  userService,
} from "@caretook/data";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";
import { profileMe } from "../profiles/profiles";

export const me = {
  /** The signed-in user and their role in each care group. */
  get: authedProcedure.handler(async ({ context }) => {
    const user = unwrap(await userService.getWholeById(context, context.authUser.id));
    // The account was deleted after the session was issued.
    if (!user) throw new ORPCError("UNAUTHORIZED");
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      /** Your avatar choice; an id this version doesn't know reads as unset. */
      avatar: readAvatarChoice({ color: user.avatarColor, icon: user.avatarIcon }),
      groupRoles: context.authUser.groupRoles ?? {},
      preferences: user.preferences,
      /** Display units with defaults filled in: what screens should use. */
      units: resolveUnits(user.preferences),
      timelineView: resolveTimelineView(user.preferences),
      easyMode: resolveEasyModeSetting(user.preferences),
      daySummary: resolveDaySummaryMode(user.preferences),
      setupDismissed: resolveSetupDismissed(user.preferences),
    };
  }),

  /** Change your own settings. Fields left out keep their current value. */
  updatePreferences: authedProcedure.input(userPreferencesZSchema).handler(async ({ context, input }) => {
    const preferences = unwrap(await userService.updateOwnPreferences(context, input));
    if (!preferences) throw new ORPCError("UNAUTHORIZED");
    return {
      preferences,
      units: resolveUnits(preferences),
      timelineView: resolveTimelineView(preferences),
      easyMode: resolveEasyModeSetting(preferences),
      daySummary: resolveDaySummaryMode(preferences),
    };
  }),

  /** Set or clear your own avatar: both ids are sent, and null is the default. */
  setAvatar: authedProcedure.input(avatarChoiceZSchema).handler(async ({ context, input }) => {
    const avatar = unwrap(await userService.updateOwnAvatar(context, input));
    if (!avatar) throw new ORPCError("UNAUTHORIZED");
    return { avatar };
  }),

  /** Your own contact details (profiles/profiles.ts). */
  ...profileMe,
};
