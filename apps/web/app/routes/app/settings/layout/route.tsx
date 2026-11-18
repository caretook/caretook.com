import { appUrls } from "~/lib/appUrls";
import { SettingsFrame } from "~/components/settings";
import { ACCOUNT_SETTINGS } from "./settingsPages";

// `/app/settings`: the account's settings list beside (wide) or instead of
// (phones) the open subpage. Each subpage loads its own data.

export default function SettingsLayout() {
  return <SettingsFrame title="Settings" listPath={appUrls.settings()} items={ACCOUNT_SETTINGS} />;
}
