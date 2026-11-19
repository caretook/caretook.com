import type { PeriodChoice } from "~/lib/periodSearch";
import type { SearchItemType } from "@caretook/data/schema";

import { useNavigate } from "react-router";
import { Field } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { choiceText } from "~/lib/periodSearch";

const ANY_TIME = "";

/**
 * "When": any time, or one of the group's care periods, newest first. A
 * period narrows the search to the entries within its dates (the current
 * one's up to now); it's kept in the URL (`?period=`), replacing the
 * history entry as the text does, so Back and a reload keep it.
 */
export function PeriodField({
  groupId,
  q,
  all,
  choices,
  current,
}: {
  groupId: string;
  q: string;
  all: SearchItemType | null;
  choices: readonly PeriodChoice[];
  current: PeriodChoice | null;
}) {
  const navigate = useNavigate();
  return (
    <Field
      label="When"
      help={current ? "Only timeline entries have dates, so only they are searched." : undefined}
    >
      {(control) => (
        <select
          {...control}
          className="select select-sm w-full sm:w-auto"
          value={current?.id ?? ANY_TIME}
          data-search-period
          onChange={(e) => {
            const period = e.currentTarget.value || null;
            void navigate(appUrls.search(groupId, q, { all, period }), {
              replace: true,
              preventScrollReset: true,
            });
          }}
        >
          <option value={ANY_TIME}>Any time</option>
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choiceText(choice)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
