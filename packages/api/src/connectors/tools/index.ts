import type { Tool } from "../registry";

import { groupOverview } from "./groupOverview";
import { latestVitals } from "./latestVitals";
import { listMedications } from "./listMedications";
import { listProviders } from "./listProviders";
import { listTodos } from "./listTodos";
import { listTimeline } from "./listTimeline";
import { recipientProfile } from "./recipientProfile";
import { search } from "./search";
import { doseSchedule } from "./doseSchedule";
import { pastDoses } from "./pastDoses";
import { todaysDoses } from "./todaysDoses";
import { upcoming } from "./upcoming";
import {
  addCondition,
  addEvent,
  addNote,
  addTodo,
  appendToEntry,
  givePass,
  logDose,
  logSymptom,
  logVitals,
  resolveCondition,
  updateCondition,
  updateEntry,
} from "./writes";

// Every connector tool, in the order tools/list shows them. Reads first,
// then writes; a new tool adds one line at the end of its group.
export const CONNECTOR_TOOLS: readonly Tool[] = [
  // Reads
  groupOverview,
  listTimeline,
  latestVitals,
  search,
  listMedications,
  todaysDoses,
  doseSchedule,
  pastDoses,
  upcoming,
  listTodos,
  listProviders,
  recipientProfile,
  // Writes
  logVitals,
  logSymptom,
  logDose,
  givePass,
  addNote,
  addEvent,
  addTodo,
  appendToEntry,
  updateEntry,
  addCondition,
  updateCondition,
  resolveCondition,
];
