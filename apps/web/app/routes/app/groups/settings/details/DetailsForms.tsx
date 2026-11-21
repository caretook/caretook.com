import type { ActionResult } from "~/lib/core/api";

import { useState } from "react";
import { useFetcher } from "react-router";
import { SaveRow } from "~/components/settings";
import { Button, Field } from "~/components/ui";
import { timeZoneLabel, timeZoneOptions } from "../groupSettings";

// The Details page's forms (online, with the role): the group's name and the
// recipient's time zone. Each posts its intent to the route's action.

export function GroupNameForm({ name }: { name: string }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" noValidate className="space-y-3">
      <input type="hidden" name="intent" value="renameGroup" />
      <TextField label="Name" name="name" value={name} result={result} maxLength={120} />
      <SaveRow busy={fetcher.state !== "idle"} result={result} />
    </fetcher.Form>
  );
}

/** The recipient's time zone (the rest of the recipient is edited on their profile). */
export function RecipientTimeZoneForm({ timeZone }: { timeZone: string | null }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" noValidate className="space-y-3">
      <input type="hidden" name="intent" value="updateRecipient" />
      {/* Keyed on the saved zone, like TextField: a synced change resets the choice. */}
      <TimeZoneField key={timeZone ?? ""} value={timeZone} result={result} />
      <SaveRow busy={fetcher.state !== "idle"} result={result} />
    </fetcher.Form>
  );
}

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The recipient's time zone: every zone the device knows, with a shortcut to
 * this device's own.
 */
function TimeZoneField({ value, result }: { value: string | null; result: ActionResult | undefined }) {
  const device = deviceZone();
  const [zone, setZone] = useState(value ?? "");
  const error =
    result && !result.ok ? result.issues.find((issue) => issue.path === "timeZone")?.message : undefined;
  return (
    <Field label="Time zone" help="Medication times follow this zone." error={error}>
      {(control) => (
        <div className="flex flex-col items-start gap-2">
          <select
            {...control}
            name="timeZone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={`select w-full ${error ? "select-error" : ""}`}
          >
            {!zone && <option value="">Not set</option>}
            {timeZoneOptions(value, device).map((option) => (
              <option key={option} value={option}>
                {timeZoneLabel(option)}
              </option>
            ))}
          </select>
          {device && zone !== device && (
            <Button variant="ghost" size="sm" data-use-device-zone="" onClick={() => setZone(device)}>
              Use this device's ({timeZoneLabel(device)})
            </Button>
          )}
        </div>
      )}
    </Field>
  );
}

/**
 * A labelled input with its own error. It's uncontrolled, and keyed on the
 * saved value: typing is never overwritten, but when the saved value changes
 * (your own save syncing back, or another member's edit) the input takes it.
 */
function TextField({
  label,
  name,
  value,
  result,
  type = "text",
  maxLength,
  help,
}: {
  label: string;
  name: string;
  value: string;
  result: ActionResult | undefined;
  type?: "text" | "date";
  maxLength?: number;
  help?: string;
}) {
  const error =
    result && !result.ok ? result.issues.find((issue) => issue.path === name)?.message : undefined;
  return (
    <Field label={label} help={help} error={error}>
      {(control) => (
        <input
          {...control}
          key={value}
          name={name}
          type={type}
          defaultValue={value}
          maxLength={maxLength}
          autoComplete="off"
          className={`input w-full ${error ? "input-error" : ""}`}
        />
      )}
    </Field>
  );
}
