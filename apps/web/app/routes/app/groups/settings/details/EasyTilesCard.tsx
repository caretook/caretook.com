import type { EasyTile, EasyTileMode, EasyTiles } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";
import type { RecipientWords } from "~/lib/assistant/easyTiles";

import { useState } from "react";
import { useFetcher } from "react-router";
import { EASY_TILE_COUNT } from "@caretook/data/schema";
import { Detail, Details, SaveRow, SettingsCard } from "~/components/settings";
import { ChoiceGroup, Field } from "~/components/ui";
import { FIXED_TILES, recipientWords, TILE_CHOICES, tileKey, tileLabel } from "~/lib/assistant/easyTiles";
import { useEasySetup } from "~/lib/assistant/easyMode.sync";
import { tileFieldName } from "../groupSettings";

const MODE_OPTIONS: { value: EasyTileMode; label: string }[] = [
  { value: "learned", label: "Learned from use" },
  { value: "fixed", label: "A fixed set" },
  { value: "custom", label: "Pick four" },
];

const MODE_HELP: Record<EasyTileMode, string> = {
  learned: "The four things logged most in the last 30 days.",
  fixed: "The same four for everyone.",
  custom: "The four you choose.",
};

const labels = (tiles: readonly EasyTile[], words: RecipientWords) =>
  tiles.map((tile) => tileLabel(tile, words)).join(", ");

/**
 * Group settings Details' "Easy mode tiles" card: how easy mode picks
 * its four tiles (learned from use, the default; the fixed set; or four
 * picked here). Read live from the device; saved online through the API by
 * owners and admins (`careGroup.update`'s `easyTiles`), read-only otherwise.
 */
export function EasyTilesCard({
  groupId,
  displayName,
  editable,
}: {
  groupId: string;
  displayName: string;
  /** Online, with the role to change the group. */
  editable: boolean;
}) {
  const { setting, pronouns } = useEasySetup(groupId);
  const words = recipientWords(displayName, pronouns);
  const mode = setting?.mode ?? "learned";
  return (
    <SettingsCard id="easy-tiles" title="Easy mode tiles">
      <p className="text-base-content/70 text-sm">
        Easy mode shows four big buttons that each open one short form.
      </p>
      {editable ? (
        // Keyed on the saved choice: a synced change resets the form.
        <EasyTilesForm key={JSON.stringify(setting)} setting={setting} words={words} />
      ) : (
        <Details>
          <Detail label="Tiles" value={MODE_OPTIONS.find((o) => o.value === mode)?.label ?? null} />
          {setting?.mode === "custom" && <Detail label="Picked" value={labels(setting.tiles, words)} />}
          {setting?.mode === "fixed" && <Detail label="Shown" value={labels(FIXED_TILES, words)} />}
        </Details>
      )}
    </SettingsCard>
  );
}

function EasyTilesForm({ setting, words }: { setting: EasyTiles | null; words: RecipientWords }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const [mode, setMode] = useState<EasyTileMode>(setting?.mode ?? "learned");
  const picked = setting?.mode === "custom" ? setting.tiles : FIXED_TILES;
  return (
    <fetcher.Form method="post" noValidate className="space-y-3" data-easy-tiles-form="">
      <input type="hidden" name="intent" value="easyTiles" />
      <ChoiceGroup name="mode" label="Tiles" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      <p className="text-base-content/70 text-sm">
        {MODE_HELP[mode]}
        {mode === "fixed" && ` ${labels(FIXED_TILES, words)}.`}
      </p>
      {mode === "custom" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: EASY_TILE_COUNT }, (_, index) => (
            <Field key={index} label={`Tile ${index + 1}`}>
              {(control) => (
                <select
                  {...control}
                  name={tileFieldName(index)}
                  className="select w-full"
                  defaultValue={tileKey(picked[index] ?? FIXED_TILES[index]!)}
                >
                  {TILE_CHOICES.map((tile) => (
                    <option key={tileKey(tile)} value={tileKey(tile)}>
                      {tileLabel(tile, words)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ))}
        </div>
      )}
      <SaveRow busy={fetcher.state !== "idle"} result={result} />
    </fetcher.Form>
  );
}
