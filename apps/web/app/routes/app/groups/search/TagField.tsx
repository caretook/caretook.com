import type { SearchItemType } from "@caretook/data/schema";

import { useState } from "react";
import { TagSwatch } from "~/components/tags";
import { ChipGroup, Field } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { matchingTags } from "~/lib/tags/tagPicker";

/** Past this many tags, a filter box narrows the chips. */
export const TAG_FILTER_FROM = 12;

type FieldTag = { id: string; name: string; name_key: string; color: string | null };

/**
 * "Tag": the group's tags (A to Z) as filter chips, each with its color
 * (`TagSwatch`). One is on at a time: a tap turns it on (any other off), a
 * second tap turns it off. A tag narrows every section to the items
 * carrying it, and with no text lists them all (conditions can't carry
 * one). It's kept in the URL (`?tag=`), replacing the history entry as the
 * text does, so Back and a reload keep it. Past `TAG_FILTER_FROM` tags a
 * filter box narrows the chips (the one that's on always shows).
 */
export function TagField({
  groupId,
  q,
  all,
  period,
  tags,
  current,
}: {
  groupId: string;
  q: string;
  all: SearchItemType | null;
  period: string | null;
  tags: readonly FieldTag[];
  /** The tag filter's id, while it's one of the group's. */
  current: string | null;
}) {
  const [typed, setTyped] = useState("");
  const filtering = tags.length > TAG_FILTER_FROM;
  const matched = new Set(matchingTags(tags, filtering ? typed : "").map((t) => t.id));
  const shown = tags.filter((t) => matched.has(t.id) || t.id === current);
  return (
    <fieldset className="fieldset" data-search-tags="">
      <legend className="fieldset-legend">Tag</legend>
      {filtering && (
        <Field label="Find a tag" labelHidden kind="input">
          {(control) => (
            <input
              {...control}
              type="search"
              autoComplete="off"
              placeholder="Find a tag"
              className={`${control.className ?? ""} input-sm w-full sm:w-64`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              data-search-tag-filter=""
            />
          )}
        </Field>
      )}
      {shown.length > 0 ? (
        <ChipGroup
          label="Tags"
          replace
          preventScrollReset
          links={shown.map((t) => {
            const on = t.id === current;
            return {
              id: t.id,
              label: t.name,
              current: on,
              leading: <TagSwatch color={t.color} />,
              to: appUrls.search(groupId, q, { all, period, tag: on ? null : t.id }),
            };
          })}
        />
      ) : (
        <p className="text-muted text-sm">No tags match.</p>
      )}
    </fieldset>
  );
}
