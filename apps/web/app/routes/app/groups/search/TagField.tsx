import type { SearchItemType } from "@caretook/data/schema";

import { useNavigate } from "react-router";
import { Field } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";

const ANY_TAG = "";

/**
 * "Tag": any, or one of the group's tags (A to Z). A tag narrows every
 * section to the items carrying it, and with no text lists them all
 * (conditions can't carry one). It's kept in the URL (`?tag=`), replacing
 * the history entry as the text does, so Back and a reload keep it.
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
  tags: readonly { id: string; name: string }[];
  /** The tag filter's id, while it's one of the group's. */
  current: string | null;
}) {
  const navigate = useNavigate();
  return (
    <Field label="Tag">
      {(control) => (
        <select
          {...control}
          className="select select-sm w-full sm:w-auto"
          value={current ?? ANY_TAG}
          data-search-tag
          onChange={(e) => {
            const tag = e.currentTarget.value || null;
            void navigate(appUrls.search(groupId, q, { all, period, tag }), {
              replace: true,
              preventScrollReset: true,
            });
          }}
        >
          <option value={ANY_TAG}>Any tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
