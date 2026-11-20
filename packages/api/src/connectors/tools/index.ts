import type { Tool } from "../registry";

import { groupOverview } from "./groupOverview";
import { listTimeline } from "./listTimeline";
import { addEvent, addNote, addTask, givePass, logDose, logSymptom, logVitals } from "./writes";

// Every connector tool, in the order tools/list shows them. Reads first,
// then writes; a new tool adds one line at the end of its group.
export const CONNECTOR_TOOLS: readonly Tool[] = [
  // Reads
  groupOverview,
  listTimeline,
  // Writes
  logVitals,
  logSymptom,
  logDose,
  givePass,
  addNote,
  addEvent,
  addTask,
];
