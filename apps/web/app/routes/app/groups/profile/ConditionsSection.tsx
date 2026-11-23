import type { ActionResult } from "~/lib/core/api";
import type { ConditionState } from "~/lib/profiles/conditions";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";

import { ChevronRight } from "lucide-react";
import { Link, useFetcher } from "react-router";
import { Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { CONDITIONS_NOT_RECORDED, NO_KNOWN_CONDITIONS, sinceText } from "~/lib/profiles/conditions";
import { CONDITION_FIELD } from "./conditions/conditionActions";
import { PROFILE_SHEET_STATE } from "./profileSheet";

/**
 * The recipient's conditions, after Basics, for every member: the active
 * ones, then a Past group, or "No known conditions", or "Conditions not
 * recorded". Each opens its sheet. Writers get Add, and while none are on
 * file "No known conditions" to record (or clear); the profile's action
 * writes it locally, so it works offline.
 */
export function ConditionsSection({
  groupId,
  state,
  canWrite,
}: {
  groupId: string;
  state: ConditionState<LocalCondition>;
  canWrite: boolean;
}) {
  const fetcher = useFetcher<ActionResult>();
  const refusal = fetcher.state === "idle" && fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const setNoKnown = (on: boolean) =>
    void fetcher.submit(
      { [CONDITION_FIELD.intent]: "noKnownConditions", [CONDITION_FIELD.on]: on ? "1" : "0" },
      { method: "post" },
    );

  return (
    <Section
      id="conditions"
      title="Conditions"
      actions={
        canWrite && (
          <Link
            to={appUrls.newCondition(groupId)}
            state={PROFILE_SHEET_STATE}
            // Loaded ahead, so the sheet opens offline too.
            prefetch="render"
            preventScrollReset
            className="btn btn-ghost btn-sm"
            data-add-condition=""
          >
            Add<span className="sr-only"> a condition</span>
          </Link>
        )
      }
    >
      {state.kind === "recorded" ? (
        <>
          {state.active.length ? (
            <ConditionList groupId={groupId} conditions={state.active} list="active" />
          ) : (
            <p className="text-base-content/70 text-sm" data-no-active-conditions="">
              No active conditions.
            </p>
          )}
          {state.past.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-base-content/70 text-sm font-semibold">Past</h3>
              <ConditionList groupId={groupId} conditions={state.past} list="past" />
            </div>
          )}
        </>
      ) : state.kind === "none" ? (
        <div className="flex items-center justify-between gap-2" data-no-known-conditions="">
          <p className="font-semibold">{NO_KNOWN_CONDITIONS}</p>
          {canWrite && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setNoKnown(false)}
              data-clear-no-known-conditions=""
            >
              Clear<span className="sr-only"> No known conditions</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2" data-conditions-not-recorded="">
          <p className="text-base-content/70 text-sm">{CONDITIONS_NOT_RECORDED}</p>
          {canWrite && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setNoKnown(true)}
              data-record-no-known-conditions=""
            >
              {NO_KNOWN_CONDITIONS}
            </button>
          )}
        </div>
      )}
      {refusal && (
        <p className="text-error text-sm" role="alert">
          {refusal}
        </p>
      )}
    </Section>
  );
}

function ConditionList({
  groupId,
  conditions,
  list,
}: {
  groupId: string;
  conditions: LocalCondition[];
  list: "active" | "past";
}) {
  return (
    <ul className="divide-base-300 border-base-300 rounded-box divide-y border" data-condition-list={list}>
      {conditions.map((condition) => {
        const since = sinceText(condition);
        return (
          <li key={condition.id} data-condition={condition.id}>
            <Link
              to={appUrls.condition(groupId, condition.id)}
              state={PROFILE_SHEET_STATE}
              prefetch="render"
              preventScrollReset
              className="hover:bg-base-200 flex items-center gap-2 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium wrap-break-word" data-condition-name="">
                  {condition.name}
                </span>
                {since && (
                  <span className="text-base-content/70 block text-sm" data-condition-since="">
                    {since.charAt(0).toUpperCase() + since.slice(1)}
                  </span>
                )}
              </span>
              <ChevronRight className="text-base-content/50 size-4 shrink-0" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
