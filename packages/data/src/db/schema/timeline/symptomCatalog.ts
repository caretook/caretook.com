import { uuidV5 } from "../core/uuidV5";

// The symptom catalog's rules (symptom-catalog PRD), pure and client-safe:
// the one place a symptom name is folded. The device, the server and the
// backfill all call these, so a name typed offline on two devices, or found
// in an old entry, lands on the same catalog row (`symptom_type`).

/** The namespace for catalog ids (a fixed, random UUID; never change it). */
export const SYMPTOM_TYPE_NAMESPACE = "b4e7c2d9-6a13-4f58-9c0e-2d8a5f1b7e36";

/**
 * The longest name: a symptom entry's (`TIMELINE_LIMITS.symptomName`, kept
 * equal by a test; not imported, so timelineEntry.ts can import this area).
 */
export const SYMPTOM_NAME_MAX = 120;

/** A name as stored and shown: trimmed, with runs of spaces made one. */
export const symptomName = (name: string) => name.trim().replace(/\s+/g, " ");

/**
 * What makes two names one symptom: case and spaces only. "knee pain" and
 * "Knee  Pain" are one type; "knee ache" stays its own.
 */
export const symptomKey = (name: string) => symptomName(name).toLocaleLowerCase("en-US");

/**
 * A catalog row's id: the version 5 UUID of its group and key, so two
 * devices adding "Nausea" offline write one row. Case-insensitive in the group id.
 */
export const symptomTypeId = (groupId: string, name: string) =>
  uuidV5(`${groupId.toLowerCase()}:${symptomKey(name)}`, SYMPTOM_TYPE_NAMESPACE);

/**
 * Every group's starting catalog: common caretaking symptoms, in everyday
 * words. Copied into each group when it's made, and into older groups by the
 * backfill (`symptomTypeService.backfill`), which adds any new name here too.
 */
export const DEFAULT_SYMPTOMS = [
  "Pain",
  "Headache",
  "Nausea",
  "Vomiting",
  "Dizziness",
  "Fatigue",
  "Shortness of breath",
  "Cough",
  "Fever",
  "Chills",
  "Constipation",
  "Diarrhea",
  "Loss of appetite",
  "Trouble sleeping",
  "Confusion",
  "Anxiety",
  "Low mood",
  "Agitation",
  "Swelling",
  "Rash",
  "Itching",
  "Numbness or tingling",
  "Fall",
] as const;
