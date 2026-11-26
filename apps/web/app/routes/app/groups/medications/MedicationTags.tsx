import type { LocalMedication } from "~/lib/medications/medications.sync";

import { canTagRecord } from "@caretook/data/schema";
import { Tag } from "lucide-react";
import { TagChips, useRecordTags, useTagPicker } from "~/components/tags";
import { Button } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { medicationTitle } from "~/lib/medications/medicationDisplay";

/**
 * The edit sheet's Tags (tags PRD): the medication's chips, live, and Tags,
 * which opens the picker over the sheet for whoever may tag it
 * (`canTagRecord`). Each toggle is its own local write, never part of the
 * form's Save. Nothing for anyone else.
 */
export function MedicationTags({ medication }: { medication: LocalMedication }) {
  const group = useGroup();
  const tags = useRecordTags("medication", medication.id);
  const picker = useTagPicker();
  const mayTag = canTagRecord(
    group.role,
    { target: "medication", createdBy: medication.createdBy },
    group.userId,
  );
  if (!mayTag) return null;
  return (
    <div className="border-base-300 mt-4 space-y-2 border-t pt-4" data-medication-tags="">
      <TagChips tags={tags} max={null} />
      <Button
        variant="secondary"
        size="sm"
        icon={Tag}
        onClick={() =>
          picker.ask({ target: "medication", recordId: medication.id, label: medicationTitle(medication) })
        }
        data-tag-record=""
      >
        Tags
      </Button>
      {picker.sheet}
    </div>
  );
}
