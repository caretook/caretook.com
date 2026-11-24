import type { WaitlistFilterValues } from "./waitlistFilters";

import { CARING_FOR, CARING_FOR_LABELS } from "@caretook/data/schema";
import { Form } from "react-router";
import { Button, Field } from "~/components/ui";
import { adminUrls } from "../adminUrls";
import { hasFilters } from "./waitlistFilters";

// The waitlist's filters: a GET form, so they live in the URL.

export function WaitlistFilterForm({ filter }: { filter: WaitlistFilterValues }) {
  return (
    <Form method="get" className="grid items-end gap-x-4 sm:grid-cols-5" data-waitlist-filters="">
      <Field kind="input" label="Joined from">
        {(control) => <input {...control} type="date" name="from" defaultValue={filter.from} />}
      </Field>
      <Field kind="input" label="Joined to">
        {(control) => <input {...control} type="date" name="to" defaultValue={filter.to} />}
      </Field>
      <Field kind="select" label="Cares for">
        {(control) => (
          <select {...control} name="caringFor" defaultValue={filter.caringFor ?? ""}>
            <option value="">Anyone</option>
            {CARING_FOR.map((value) => (
              <option key={value} value={value}>
                {CARING_FOR_LABELS[value]}
              </option>
            ))}
            <option value="none">Not given</option>
          </select>
        )}
      </Field>
      <Field kind="input" label="Source" help="Page or UTM value.">
        {(control) => (
          <input {...control} type="search" name="source" defaultValue={filter.source} maxLength={200} />
        )}
      </Field>
      <div className="flex gap-2 pb-2">
        <Button type="submit" variant="primary">
          Filter
        </Button>
        {hasFilters(filter) && (
          <Button to={adminUrls.waitlist()} variant="ghost">
            Clear
          </Button>
        )}
      </div>
    </Form>
  );
}
