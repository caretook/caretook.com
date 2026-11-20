import type { InsurancePlan, InsuranceRank } from "@caretook/data/schema";
import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { PlanField } from "./detailsFormData";

import { DETAILS_LIMITS, INSURANCE_RANKS, PROVIDER_LIMITS } from "@caretook/data/schema";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { ChoiceGroup, Field, IconButton } from "~/components/ui";
import { INSURANCE_RANK_LABELS, plansByRank } from "~/lib/profiles/recipientDetails";
import { nextRank, PLAN_KEY, planFieldName } from "./detailsFormData";
import { SheetButtons } from "./SheetButtons";

const RANK_OPTIONS = INSURANCE_RANKS.map((value) => ({ value, label: INSURANCE_RANK_LABELS[value] }));

/** A plan's row: keyed, so removing one keeps the others' typed values. Only the rank is controlled. */
type PlanRow = { key: number; plan: InsurancePlan | null; rank: InsuranceRank };

let planKeys = 0;
const planRow = (plan: InsurancePlan | null, rank: InsuranceRank): PlanRow => ({
  key: planKeys++,
  plan,
  rank,
});

/**
 * The Insurance sheet's form: up to six plans, each with its coverage
 * (primary, secondary or other), insurer, plan name, member ID, group number
 * and the insurer's phone. Plans can be added and removed; a plan left blank
 * isn't saved. It posts every plan to the sheet's action (online only); a save
 * closes the sheet, and an error shows on its field, which takes focus.
 */
export function InsuranceForm({
  plans,
  onDone,
  onCancel,
}: {
  plans: InsurancePlan[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const issues = result && !result.ok ? result.issues : [];
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<PlanRow[]>(() =>
    plans.length ? plansByRank(plans).map((plan) => planRow(plan, plan.rank)) : [planRow(null, "primary")],
  );
  const full = rows.length >= DETAILS_LIMITS.insurance;
  const listError = issues.find((issue) => issue.path === "insurance")?.message;

  useEffect(() => {
    if (!result) return;
    if (result.ok) onDone();
    else formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [result, onDone]);

  const setRank = (key: number, rank: InsuranceRank) =>
    setRows((all) => all.map((row) => (row.key === key ? { ...row, rank } : row)));

  return (
    <fetcher.Form method="post" noValidate className="space-y-3" ref={formRef} data-insurance-form="">
      <ul className="space-y-3" data-plans="">
        {rows.map((row, i) => (
          <PlanFields
            key={row.key}
            row={row}
            n={i + 1}
            issues={issues}
            onRank={(rank) => setRank(row.key, rank)}
            onRemove={() => setRows((all) => all.filter((r) => r.key !== row.key))}
          />
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={full}
          onClick={() => setRows((all) => [...all, planRow(null, nextRank(all.map((r) => r.rank)))])}
          data-add-plan=""
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a plan
        </button>
        {full && (
          <span className="text-base-content/70 text-sm">{DETAILS_LIMITS.insurance} plans is the most</span>
        )}
      </div>
      {listError && (
        <p className="text-error text-sm" data-plans-error="">
          {listError}
        </p>
      )}
      <SheetButtons busy={busy} result={result} onCancel={onCancel} />
    </fetcher.Form>
  );
}

/** One plan's fields, in a fieldset named "Plan N", with its own Remove. */
function PlanFields({
  row,
  n,
  issues,
  onRank,
  onRemove,
}: {
  row: PlanRow;
  n: number;
  issues: FieldIssue[];
  onRank: (rank: InsuranceRank) => void;
  onRemove: () => void;
}) {
  const error = (field: PlanField) =>
    issues.find((issue) => issue.path === planFieldName(row.key, field))?.message;
  const text = (field: PlanField, label: string, max: number, type = "text") => {
    const message = error(field);
    const value = row.plan?.[field];
    return (
      <Field label={label} error={message}>
        {(control) => (
          <input
            {...control}
            name={planFieldName(row.key, field)}
            type={type}
            defaultValue={typeof value === "string" ? value : ""}
            maxLength={max + 20}
            autoComplete="off"
            className={`input w-full ${message ? "input-error" : ""}`}
          />
        )}
      </Field>
    );
  };

  return (
    <li className="border-base-300 rounded-box border p-3" data-plan-row="">
      <fieldset>
        <div className="flex items-center justify-between gap-2">
          <legend className="font-medium">Plan {n}</legend>
          <IconButton label={`Remove plan ${n}`} icon={X} onPress={onRemove} />
        </div>
        <input type="hidden" name={PLAN_KEY} value={row.key} />
        {row.plan?.id && <input type="hidden" name={planFieldName(row.key, "id")} value={row.plan.id} />}
        <ChoiceGroup
          label="Coverage"
          name={planFieldName(row.key, "rank")}
          options={RANK_OPTIONS}
          value={row.rank}
          onChange={onRank}
          error={error("rank")}
        />
        {text("insurer", "Insurer", DETAILS_LIMITS.insurer)}
        {text("planName", "Plan name", DETAILS_LIMITS.planName)}
        {text("memberId", "Member ID", DETAILS_LIMITS.memberId)}
        {text("groupNumber", "Group number", DETAILS_LIMITS.groupNumber)}
        {text("phone", "Insurer's phone", PROVIDER_LIMITS.phoneNumber, "tel")}
      </fieldset>
    </li>
  );
}
