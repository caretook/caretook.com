import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";

import { SettingsPage } from "~/components/settings";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadCalendarSettings, useCalendarSettings } from "~/lib/calendars/calendarSettings";
import { loadDetailsAllowed, useDetailsAllowed } from "~/lib/calendars/detailsAllowed.sync";
import { formString } from "~/lib/core/form";
import { failedSave } from "../api";
import { CARD_ACTIONS } from "./cardActions";
import { OFFLINE_CALENDAR } from "./calendarPage";
import { DetailsCard } from "./DetailsCard";
import { FeedCard } from "./FeedCard";
import { GoogleCard } from "./GoogleCard";
import { showsGoogleCard } from "./googleCardView";
import { RemindersCard } from "./RemindersCard";

// `…/settings/calendar`: Calendar & reminders (calendars, appointments-2).
// Shared by web + native; every member, viewers included, sees their own.
// The settings are server-only (`calendars.settings.*`), so the page needs a
// connection; offline it shows this device's copy, and a change made then
// is sent when it loads online again (`loadCalendarSettings`). The owners'
// switch comes from the device (`care_group.details_outside_allowed`, live).
//
// Four cards, in order, each its own file and region: Reminders, Calendar
// feed, Google Calendar (web only) and Details outside Caretook. A card
// that posts adds its handler to CARD_ACTIONS.

export const meta = () => [{ title: "Calendar & reminders · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

/** Google Calendar connects through web-only routes: the native app has no card for it. */
const SHOWS_GOOGLE = showsGoogleCard(import.meta.env.BUILD_TARGET);

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  getGroup(context);
  const { user, db } = context.get(sessionContext);
  const allowedRows = await loadDetailsAllowed(db, groupId);
  const { online, settings } = await loadCalendarSettings(request, user.id, groupId);
  return { userId: user.id, allowedRows, online, settings };
}

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const action = CARD_ACTIONS[formString(form, "intent")];
  if (!action) return { ok: false, error: "Unknown action.", issues: [] };
  try {
    return await action({ groupId: params.groupId, form });
  } catch (e) {
    return failedSave(e);
  }
}

export default function CalendarSettingsPage({ loaderData }: Route.ComponentProps) {
  const { userId, allowedRows, online } = loaderData;
  const group = useGroup();
  const settings = useCalendarSettings(userId, group.id, loaderData.settings);
  const allowed = useDetailsAllowed(group.id, allowedRows);
  const card = { groupId: group.id, userId, settings, online };

  return (
    <SettingsPage title="Calendar & reminders" offlineNotice={online ? undefined : OFFLINE_CALENDAR}>
      <RemindersCard {...card} />
      <FeedCard {...card} />
      {SHOWS_GOOGLE && <GoogleCard {...card} />}
      <DetailsCard
        {...card}
        allowed={allowed}
        recipient={group.recipient?.displayName ?? group.displayName}
      />
    </SettingsPage>
  );
}
