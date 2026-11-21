import type { LinkChoices } from "./todoSheet";

import { useCallback } from "react";
import { medicationTitle } from "~/lib/medications/medicationDisplay";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { LinkPickerField } from "./LinkPickerField";
import { FIELD } from "./todoFormData";
import {
  chosenLinkChip,
  eventLinkOptions,
  eventWhen,
  medicationLinkOptions,
  providerLinkOptions,
} from "./todoLinks";

export type TodoLinkIds = { providerId: string | null; eventId: string | null; medicationId: string | null };

/**
 * The todo's three optional links: a provider ("Call Dr. Lee's office"), an
 * appointment (upcoming or from the last 30 days: "Bring the insurance
 * card") and a current medication ("Refill Metformin"). Each is one choice,
 * cleared with ×. A link chosen earlier that's since been removed or
 * cancelled stays on its chip, greyed, until it's cleared.
 */
export function TodoLinkFields({
  choices,
  initial,
  errors,
}: {
  choices: LinkChoices;
  initial: TodoLinkIds;
  errors: Partial<Record<keyof TodoLinkIds, string>>;
}) {
  const { providers, events, medications } = choices;

  const providerOptions = useCallback((text: string) => providerLinkOptions(providers, text), [providers]);
  const providerChip = useCallback(
    (id: string) => {
      const p = providers.find((x) => x.id === id);
      return chosenLinkChip(p ? { label: p.name, deleted: !!p.deletedAt } : null, "Chosen provider");
    },
    [providers],
  );

  const eventOptions = useCallback((text: string) => eventLinkOptions(events, text, new Date()), [events]);
  const eventChip = useCallback(
    (id: string) => {
      const e = events.find((x) => x.id === id);
      return chosenLinkChip(
        e ? { label: `${upcomingTitle(e)} · ${eventWhen(e, new Date())}`, cancelled: !!e.cancelledAt } : null,
        "Chosen appointment",
      );
    },
    [events],
  );

  const medicationOptions = useCallback(
    (text: string) => medicationLinkOptions(medications, text),
    [medications],
  );
  const medicationChip = useCallback(
    (id: string) => {
      const m = medications.find((x) => x.id === id);
      return chosenLinkChip(
        m ? { label: medicationTitle(m), deleted: !!m.deletedAt } : null,
        "Chosen medication",
      );
    },
    [medications],
  );

  return (
    <div data-todo-links>
      <LinkPickerField
        name={FIELD.providerId}
        legend="Provider (optional)"
        comboLabel="Find a provider"
        placeholder="Search providers"
        emptyText="No providers match"
        clearLabel="Clear the provider"
        optionsFor={providerOptions}
        chipFor={providerChip}
        initialId={initial.providerId}
        error={errors.providerId}
      />
      <LinkPickerField
        name={FIELD.eventId}
        legend="Appointment (optional)"
        comboLabel="Find an appointment"
        placeholder="Upcoming and recent appointments"
        emptyText="No appointments match"
        clearLabel="Clear the appointment"
        optionsFor={eventOptions}
        chipFor={eventChip}
        initialId={initial.eventId}
        error={errors.eventId}
      />
      <LinkPickerField
        name={FIELD.medicationId}
        legend="Medication (optional)"
        comboLabel="Find a medication"
        placeholder="Current medications"
        emptyText="No current medications match"
        clearLabel="Clear the medication"
        optionsFor={medicationOptions}
        chipFor={medicationChip}
        initialId={initial.medicationId}
        error={errors.medicationId}
      />
    </div>
  );
}
