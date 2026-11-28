import type { ApiOutputs } from "~/lib/core/rpc";

import { GROUP_LIMIT_MAX, setGroupLimitZSchema } from "@caretook/data/schema";
import { useState } from "react";
import { Field } from "~/components/ui";
import { parseGroupLimit, setGroupLimitCopy } from "./accountActions";
import { HelpAction } from "./HelpAction";

// An account's care group limit (free-limits PRD): how many groups it started
// (and still owns) against its limit, and, for staff with `users.limits`, a
// Change limit control: a number (blank for the default) behind the page's
// usual confirm with a reason.

type GroupLimit = ApiOutputs["admin"]["users"]["groupLimit"];

const limitShape = setGroupLimitZSchema.shape.limit;

export function GroupLimitControl({ groupLimit, canSet }: { groupLimit: GroupLimit; canSet: boolean }) {
  const { started, limit, override } = groupLimit;
  return (
    <div className="flex flex-col gap-2" data-group-limit="">
      <p className="text-sm" data-group-limit-count="">
        Started {started.toLocaleString("en-US")} of {limit.toLocaleString("en-US")}
        {override === null && <span className="text-muted"> (default)</span>}
      </p>
      {canSet && <LimitForm override={override} />}
    </div>
  );
}

function LimitForm({ override }: { override: number | null }) {
  const current = override === null ? "" : String(override);
  const [text, setText] = useState(current);
  const parsed = limitShape.safeParse(parseGroupLimit(text));
  const error = parsed.success ? undefined : parsed.error.issues[0]?.message;
  return (
    <div className="flex flex-wrap items-end gap-2" data-group-limit-controls="">
      <Field kind="input" label="Care group limit" help="Blank for the default." error={error}>
        {(control) => (
          <input
            {...control}
            name="limit"
            type="number"
            inputMode="numeric"
            min={1}
            max={GROUP_LIMIT_MAX}
            step={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${control.className} input-sm max-w-40`}
          />
        )}
      </Field>
      <HelpAction
        intent="setGroupLimit"
        copy={setGroupLimitCopy(parsed.success ? parsed.data : null)}
        values={{ limit: text.trim() }}
        disabled={!parsed.success || text.trim() === current}
      />
    </div>
  );
}
