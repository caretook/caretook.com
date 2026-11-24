import type { FormEvent, RefObject } from "react";
import type { SymptomTypeRow } from "~/lib/timeline/symptomTypes.sync";

import { useRef, useState } from "react";
import { similarSymptoms, symptomKey, symptomName } from "@caretook/data/schema";
import { useSymptomTypes } from "~/lib/timeline/symptomTypes.sync";

/** The gate on screen: the name as typed, and the catalog's similar names to offer. */
export type SymptomGateState = { name: string; similar: SymptomTypeRow[] };

/**
 * The check before a symptom form saves a new name (symptom-catalog slice
 * 3), on the group's local catalog, so it works offline. On submit:
 *
 * - an exact match (same key: case and spaces) saves with the catalog's
 *   spelling, with no prompt;
 * - a similar name (`similarSymptoms`) stops the save and shows the gate:
 *   `use(name)` saves with that one, `addNew()` saves the name as typed;
 * - an empty name (Easy's "Feeling"), the stored name when editing, or a name
 *   like nothing in the catalog saves as it is.
 *
 * The form's name input is `symptomName`. Typing in it again closes the gate.
 */
export function useSymptomGate({
  groupId,
  formRef,
  storedName,
}: {
  groupId: string;
  formRef: RefObject<HTMLFormElement | null>;
  /** Editing: the entry's name, which saves again without a check. */
  storedName?: string;
}) {
  const catalog = useSymptomTypes(groupId);
  const [gate, setGate] = useState<SymptomGateState | null>(null);
  // The key "Add new" was chosen for: that name saves without asking again.
  const addedKey = useRef<string | null>(null);

  const nameInput = () => formRef.current?.elements.namedItem("symptomName") as HTMLInputElement | null;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const input = nameInput();
    const raw = input?.value ?? "";
    const key = symptomKey(raw);
    if (!input || !key || key === addedKey.current) return;
    if (storedName !== undefined && key === symptomKey(storedName)) return;
    const { exact, similar } = similarSymptoms(raw, catalog);
    if (exact) {
      input.value = exact.name;
      return;
    }
    if (!similar.length) return;
    event.preventDefault();
    setGate({ name: symptomName(raw), similar });
  };

  const submit = () => {
    setGate(null);
    formRef.current?.requestSubmit();
  };

  return {
    gate,
    onSubmit,
    /** The form's `onInput`: a change to the name closes the gate. */
    onInput: (event: FormEvent<HTMLFormElement>) => {
      if ((event.target as HTMLInputElement).name === "symptomName") setGate(null);
    },
    /** "Use <name>": save with the catalog's name. */
    use: (name: string) => {
      const input = nameInput();
      if (input) input.value = name;
      submit();
    },
    /** "Add new": save the name as typed, a new catalog row. */
    addNew: () => {
      addedKey.current = symptomKey(nameInput()?.value ?? "");
      submit();
    },
  };
}
