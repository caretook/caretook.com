import { redirect } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { isWideSettings } from "../layout/SettingsFrame";
import { ACCOUNT_SETTINGS } from "../layout/settingsPages";

// `/app/settings` itself: the list on phones (the layout renders it). Wide
// screens show the side nav beside a subpage instead, so they open the first.

export const meta = () => [{ title: "Settings · Caretook" }];

const FIRST = ACCOUNT_SETTINGS[0]?.path ?? appUrls.settings("units");

export function clientLoader() {
  if (isWideSettings()) throw redirect(FIRST);
  return null;
}

// The layout renders the list (and follows a window that widens later).
export default function SettingsIndex() {
  return null;
}
