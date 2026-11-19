import type { ActionResult, FieldIssue } from "~/lib/api";
import type { LocalPass } from "~/lib/sync/medicationPasses";

import { MEDICATION_PASS_LIMITS } from "@caretook/data/schema";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Field } from "~/components/ui";
import { PASS_FIELD } from "./passActions";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/**
 * Add a pass, or rename or retime one: a name and a time. A save closes the
 * sheet; a refusal (a taken name, a bad time) shows on its field and takes
 * focus there. The write is local, so it works offline.
 */
export function PassForm({
  pass,
  zoneNote,
  onDone,
  onCancel,
}: {
  /** Editing this pass; omit to add one. */
  pass?: LocalPass;
  /** "Times are Los Angeles time", when the device is in another zone. */
  zoneNote: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";

  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) onDone();
    else formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fetcher.state, fetcher.data, onDone]);

  const nameError = issueFor(issues, "name");
  const timeError = issueFor(issues, "time");
  const general = result && !result.ok && !nameError && !timeError ? result.error : undefined;

  return (
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate data-pass-form>
      <input type="hidden" name={PASS_FIELD.intent} value={pass ? "update" : "create"} />
      {pass && <input type="hidden" name={PASS_FIELD.passId} value={pass.id} />}
      <Field label="Name" error={nameError}>
        {(control) => (
          <input
            {...control}
            name={PASS_FIELD.name}
            className="input w-full"
            defaultValue={pass?.name ?? ""}
            maxLength={MEDICATION_PASS_LIMITS.name}
            placeholder="e.g. Noon"
            autoComplete="off"
            required
          />
        )}
      </Field>
      <Field
        label="Time"
        help={
          pass
            ? `Every medication in ${pass.name} moves with it.${zoneNote ? ` ${zoneNote}.` : ""}`
            : (zoneNote ?? undefined)
        }
        error={timeError}
      >
        {(control) => (
          <input
            {...control}
            type="time"
            name={PASS_FIELD.time}
            className="input w-40"
            defaultValue={pass?.time ?? ""}
            required
          />
        )}
      </Field>
      {general && (
        <p className="text-error text-sm" role="alert">
          {general}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {pass ? "Save" : "Add pass"}
        </button>
      </div>
    </fetcher.Form>
  );
}
