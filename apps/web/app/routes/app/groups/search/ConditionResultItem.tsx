import type { LocalCondition } from "~/lib/profiles/conditions.sync";

import { ClipboardPlus } from "lucide-react";
import { Badge, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { CONDITION_STATUS_LABELS, sinceText } from "~/lib/profiles/conditions";
import { PROFILE_SHEET_STATE } from "../profile/profileSheet";
import type { ParsedSearch } from "@caretook/data/domain";
import { STRETCHED, ROW, OpenName, Marked } from "./resultParts";

/**
 * One of the recipient's conditions as a result: its name, since and note; a
 * resolved one is marked. It opens the condition's sheet over the profile
 * (closing it comes back here).
 */
export function ConditionResultItem({
  condition,
  search,
  onOpen,
}: {
  condition: LocalCondition;
  search: ParsedSearch;
  /** Opens its read-only sheet here instead of over the profile (the easy roles). */
  onOpen?: () => void;
}) {
  const resolved = condition.status === "resolved";
  const line = [sinceText(condition), condition.note].filter(Boolean).join(" · ");
  return (
    <li
      className={`${ROW} hover:bg-base-200/50`}
      data-result="condition"
      data-result-id={condition.id}
      data-resolved={resolved ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full ${resolved ? "bg-base-200 text-faint" : "bg-info/15 text-info"}`}
      >
        <ClipboardPlus className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <OpenName
            to={appUrls.condition(condition.groupId, condition.id)}
            state={PROFILE_SHEET_STATE}
            onOpen={onOpen}
            className={`font-medium wrap-break-word ${STRETCHED} ${resolved ? "text-muted" : ""}`}
          >
            <Marked text={condition.name} search={search} />
          </OpenName>
          {resolved && (
            <Badge tone={STATUS_TONE.past} className="shrink-0" data-marker="">
              {CONDITION_STATUS_LABELS.resolved}
            </Badge>
          )}
        </p>
        {line && (
          <p className="text-muted text-sm break-words">
            <Marked text={line} search={search} />
          </p>
        )}
      </div>
    </li>
  );
}
