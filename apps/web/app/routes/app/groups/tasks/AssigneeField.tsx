import type { AssigneeMember } from "./assigneeOptions";

import { useId, useMemo, useState } from "react";
import { ChipList, ComboBox } from "~/components/ui";
import { assigneeOptions, canAssignName, memberName, UNASSIGNED_OPTION } from "./assigneeOptions";
import { FIELD } from "./taskFormData";

export type AssigneeChoice =
  { kind: "none" } | { kind: "member"; userId: string } | { kind: "name"; name: string };

/**
 * Who does it: once chosen, a chip with × to clear it (unassigned again);
 * otherwise a combo box over "Unassigned" and the group's members, which can
 * also take the typed name for someone outside the group: "Assign to
 * "Aunt May" (not in the group)". Posts `assigneeId` or `assigneeName`.
 */
export function AssigneeField({
  members,
  meId,
  initial,
  error,
}: {
  members: readonly AssigneeMember[];
  meId: string;
  initial: AssigneeChoice;
  error?: string;
}) {
  const labelId = useId();
  const [choice, setChoice] = useState<AssigneeChoice>(initial);
  const [text, setText] = useState("");
  const options = useMemo(() => assigneeOptions(members, text, meId), [members, text, meId]);

  const chosenMember = choice.kind === "member" ? members.find((m) => m.userId === choice.userId) : null;
  const chipLabel =
    choice.kind === "name"
      ? `${choice.name} (not in the group)`
      : chosenMember
        ? memberName(chosenMember, meId)
        : "Former member";

  return (
    <div className="fieldset" data-assignee-field>
      <span id={labelId} className="fieldset-legend">
        Assigned to
      </span>
      {choice.kind === "none" ? (
        <div role="group" aria-labelledby={labelId}>
          <ComboBox
            label="Assign to"
            placeholder="Unassigned: anyone can do it"
            options={options}
            inputValue={text}
            onInputChange={setText}
            onSelect={(id) => {
              setChoice(id === UNASSIGNED_OPTION ? { kind: "none" } : { kind: "member", userId: id });
              setText("");
            }}
            emptyText="No members match"
            {...(canAssignName(members, text) && {
              onCreate: (name: string) => {
                setChoice({ kind: "name", name });
                setText("");
              },
              createLabel: (typed: string) => `Assign to "${typed}" (not in the group)`,
            })}
          />
        </div>
      ) : (
        <ChipList
          label="Assigned to"
          chips={[
            {
              id: choice.kind === "member" ? choice.userId : "name",
              label: chipLabel,
              to: null,
              removeLabel: "Clear the assignee",
              onRemove: () => setChoice({ kind: "none" }),
            },
          ]}
        />
      )}
      <input type="hidden" name={FIELD.assigneeId} value={choice.kind === "member" ? choice.userId : ""} />
      <input type="hidden" name={FIELD.assigneeName} value={choice.kind === "name" ? choice.name : ""} />
      {error && (
        <p className="text-error text-sm" role="alert" data-picker-error>
          {error}
        </p>
      )}
    </div>
  );
}
