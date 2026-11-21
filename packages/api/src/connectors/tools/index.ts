import type { Tool } from "../registry";

import { groupOverview } from "./groupOverview";
import { latestVitals } from "./latestVitals";
import { listMedications } from "./listMedications";
import { listProviders } from "./listProviders";
import { listTasks } from "./listTasks";
import { listTimeline } from "./listTimeline";
import { recipientProfile } from "./recipientProfile";
import { search } from "./search";
import { todaysDoses } from "./todaysDoses";
import { upcoming } from "./upcoming";
import {
  addEvent,
  addNote,
  addTask,
  appendToEntry,
  givePass,
  logDose,
  logSymptom,
  logVitals,
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
  upcoming,
  listTasks,
  listProviders,
  recipientProfile,
  // Writes
  logVitals,
  logSymptom,
  logDose,
  givePass,
  addNote,
  addEvent,
  addTask,
  appendToEntry,
  updateEntry,
];
