import type { SimpleModeSetting, TimelineView } from "@caretook/data/schema";
import type { Route } from "./+types/route";
import type { ChoiceOption } from "~/components/ui";

import { useRef, useState } from "react";
import { SettingsCard, SettingsPage } from "~/components/settings";
import { ChoiceGroup } from "~/components/ui";
import { loadSettings, saveSettings } from "~/lib/me";
import { clearToggles } from "~/lib/simpleModeToggle";
import { sessionContext } from "~/lib/session";

// `/app/settings/timeline`. Shared by web + native: client-only data.

export const meta = () => [{ title: "Timeline layout · Settings · Caretook" }];

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  // The device-side read the timeline uses: it sends a layout change that's
  // still pending first, so this page never shows an older choice.
  const { timelineView, simpleMode } = await loadSettings(request, user.id);
  return { userId: user.id, timelineView, simpleMode };
}

const TIMELINE_VIEW_OPTIONS: ChoiceOption<TimelineView>[] = [
  { value: "rows", label: "Rows" },
  { value: "cards", label: "Cards" },
];

const SIMPLE_MODE_OPTIONS: ChoiceOption<SimpleModeSetting>[] = [
  { value: "group", label: "Follow the group" },
  { value: "simple", label: "Always" },
  { value: "full", label: "Never" },
];

const LAYOUT_HEADING = "layout-heading";
// `SettingsCard` names its heading `<id>-heading`.
const SIMPLE_HEADING = "simple-mode-heading";

type SaveStatus = "saving" | "saved" | "pending" | "failed";

/** A setting saved as soon as it's chosen (`saveSettings`), and how that went. */
function useSavedChoice<T>(initial: T, save: (next: T) => Promise<"saved" | "pending">) {
  const [value, setValue] = useState<T>(initial);
  const [status, setStatus] = useState<SaveStatus | null>(null);
  // Only the latest choice reports its outcome.
  const latest = useRef(0);
  const choose = (next: T) => {
    if (next === value) return;
    const mine = ++latest.current;
    setValue(next);
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
      {(status === "saved" || status === "pending") && (
        <p role="status" className="text-success text-sm">
          {status === "saved" ? "Saved." : "Saved on this device. It'll sync when you're back online."}
        </p>
      )}
      {status === "failed" && (
        <p role="alert" className="text-error text-sm">
          Couldn&apos;t save that. Try again.
        </p>
      )}
    </div>
  );
}

/**
 * Rows or cards: the preference the timeline's own toggle changes, saved the
 * same way (`saveSettings`), as soon as it's chosen. Offline, it's kept on
 * this device and sent on the next online visit. Then simple mode: follow
 * the group's default for you, always or never; choosing clears this
 * device's simple/full toggles, so the choice shows at once.
 */
export default function TimelineLayoutSettings({ loaderData }: Route.ComponentProps) {
  const { userId } = loaderData;
  const layout = useSavedChoice(loaderData.timelineView, (timelineView) =>
    saveSettings(userId, { timelineView }),
  );
  const simple = useSavedChoice(loaderData.simpleMode, (simpleMode) => {
    clearToggles(userId);
    return saveSettings(userId, { simpleMode });
  });

  return (
    <SettingsPage title="Timeline layout" headingId={LAYOUT_HEADING}>
      <SettingsCard>
        <p className="text-base-content/70 text-sm">
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
      <SettingsCard id="simple-mode" title="Simple mode">
        <p className="text-base-content/70 text-sm">
          A simpler timeline in large type. &ldquo;Follow the group&rdquo; uses what the group&apos;s owners
          chose for you. You can also switch it on the timeline itself.
        </p>
        <ChoiceGroup
          name="simpleMode"
          labelledBy={SIMPLE_HEADING}
          options={SIMPLE_MODE_OPTIONS}
          value={simple.value}
          onChange={simple.choose}
        />
        <SaveStatusLine status={simple.status} />
      </SettingsCard>
    </SettingsPage>
  );
}
