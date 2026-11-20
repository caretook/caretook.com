// Moved to @caretook/data/schema (shared with the connector); this keeps the old import path.
export type {
  AsNeededToday,
  DoseSlot,
  DoseSlotsBetweenInput,
  DoseWarning,
  DueDose,
  DueDoses,
  DueDosesInput,
  DueMedication,
  PlannedDose,
  SlotState,
} from "@caretook/data/schema";
export {
  OVERDUE_AFTER_MINUTES,
  doseSlotsBetween,
  doseWarnings,
  dueDoses,
  dueNow,
  isDueNow,
  isOpen,
  missedDoseCounts,
} from "@caretook/data/schema";
