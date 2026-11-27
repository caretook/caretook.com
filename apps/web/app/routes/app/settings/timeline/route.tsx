import type { EasyModeSetting, TimelineView } from "@caretook/data/schema";
import type { Route } from "./+types/route";
import type { ChoiceOption } from "~/components/ui";

import { useRef, useState } from "react";
import { SettingsCard, SettingsPage } from "~/components/settings";
import { ChoiceGroup, Message } from "~/components/ui";
import { loadSettings, saveSettings, useMySettings } from "~/lib/app-shell/me";
import { clearToggles } from "~/lib/assistant/easyModeToggle";
import { sessionContext } from "~/lib/auth/session";

// `/app/settings/timeline`. Shared by web + native: client-only data.

export const meta = () => [{ title: "Timeline layout · Settings · Caretook" }];

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  // The device-side read the timeline uses: it sends a layout change that's
  // still pending first, so this page never shows an older choice.
  return { userId: user.id, ...(await loadSettings(request, user.id)) };
}

const TIMELINE_VIEW_OPTIONS: ChoiceOption<TimelineView>[] = [
  { value: "rows", label: "Condensed" },
  { value: "cards", label: "Full" },
];

const EASY_MODE_OPTIONS: ChoiceOption<EasyModeSetting>[] = [
  { value: "easy", label: "Always" },
  { value: "full", label: "Never" },
];

const LAYOUT_HEADING = "layout-heading";
// `SettingsCard` names its heading `<id>-heading`.
const EASY_HEADING = "easy-mode-heading";

type SaveStatus = "saving" | "saved" | "pending" | "failed";

/**
 * A setting saved as soon as it's chosen (`saveSettings`), and how that went.
 * `value` is the settings store's (`useMySettings`), which the save publishes
 * to at once, as does a background refresh bringing another device's change.
 */
function useSavedChoice<T>(value: T, save: (next: T) => Promise<"saved" | "pending">) {
  const [status, setStatus] = useState<SaveStatus | null>(null);
  // Only the latest choice reports its outcome.
  const latest = useRef(0);
  const choose = (next: T) => {
    if (next === value) return;
    const mine = ++latest.current;
    setStatus("saving");
    save(next).then(
      (outcome) => mine === latest.current && setStatus(outcome),
      () => mine === latest.current && setStatus("failed"),
    );
  };
  return { value, status, choose };
}

function SaveStatusLine({ status }: { status: SaveStatus | null }) {
  return (
    <div className="min-h-5">
      <Message tone="success">
        {status === "saved"
          ? "Saved."
          : status === "pending"
            ? "Saved on this device. It'll sync when you're back online."
            : null}
      </Message>
      {status === "failed" && <Message tone="error">Couldn't save that. Try again.</Message>}
    </div>
  );
}

/**
 * Condensed or full: the preference the timeline's own toggle changes, saved the
 * same way (`saveSettings`), as soon as it's chosen. Offline, it's kept on
 * this device and sent on the next online visit. Then easy mode: always or
 * never (an Easy helper or Easy viewer has it in their group whatever this
 * says); choosing clears this device's easy/full toggles, so the choice shows
 * at once.
 */
export default function TimelineLayoutSettings({ loaderData }: Route.ComponentProps) {
  const { userId } = loaderData;
  const settings = useMySettings(userId, loaderData);
  const layout = useSavedChoice(settings.timelineView, (timelineView) =>
    saveSettings(userId, { timelineView }),
  );
  // A device's copy from before the easy roles may still say `group` ("follow the group"): that reads as Never.
  const easy = useSavedChoice<EasyModeSetting>(settings.easyMode === "easy" ? "easy" : "full", (easyMode) => {
    clearToggles(userId);
    return saveSettings(userId, { easyMode });
  });

  return (
    <SettingsPage title="Timeline layout" headingId={LAYOUT_HEADING}>
      <SettingsCard>
        <p className="text-muted text-sm">
          How entries show on your timelines. You can also switch it on the timeline itself.
        </p>
        <ChoiceGroup
          name="timelineView"
          labelledBy={LAYOUT_HEADING}
          options={TIMELINE_VIEW_OPTIONS}
          value={layout.value}
          onChange={layout.choose}
        />
        <SaveStatusLine status={layout.status} />
      </SettingsCard>
      <SettingsCard id="easy-mode" title="Easy mode">
        <p className="text-muted text-sm">
          A simpler timeline in large type. You can also switch it on the timeline itself.
        </p>
        <ChoiceGroup
          name="easyMode"
          labelledBy={EASY_HEADING}
          options={EASY_MODE_OPTIONS}
          value={easy.value}
          onChange={easy.choose}
        />
        <SaveStatusLine status={easy.status} />
      </SettingsCard>
    </SettingsPage>
  );
}
