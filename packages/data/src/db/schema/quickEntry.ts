import type { ActionKind, AssistantAction } from "./assistantActions";
import type { DoseStatus } from "./medication";
import type { ProviderType } from "./provider";
import type { ResolvedTime, TimeDirection, TimeSpec } from "./quickEntryTime";
import type { UnitChoices, UnitFor, VitalFieldSpec, VitalReading, VitalType } from "./vitals";

import { DEVICE_FUTURE_SKEW_MS, FUTURE_DATE_MESSAGE } from "./entryTiming";
import { findTime, resolveTime, saysFuture } from "./quickEntryTime";
import { foldSearchText } from "./search";
import { TIMELINE_LIMITS } from "./timelineEntry";
import { BP_ORDER_MESSAGE, fieldRange, fieldUnitLabel, fromDisplay, isUnusual, VITALS } from "./vitals";

// Quick entry: one line ("bp 130/85 hr 72, gave metformin, pain 4 left
// knee") read as assistant actions, one part per comma, semicolon or "and",
// each with its readings ranked best first. Pure and client-safe; nothing is
// saved here. English only.
//
// Rules, in order, per part: a kind prefix (`n:` `e:` `s:` `v:` `d:`) forces
// a kind; otherwise vitals (a keyword and a number, or a bare `n/n`), doses
// (give/gave/skip/refuse and a medication), symptoms (a phrase and 0–10 or
// `n/10`, or a symptom word), events (`appt`, or a time ahead), then a note.
// Every part gets a note reading, so nothing typed is lost. A time phrase
// ("at 8am", "30 min ago", "yesterday 9pm") sets any part's time, in the
// recipient's zone.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuickEntryMedication = {
  id: string;
  name: string;
  strength?: string | null;
  /** The usual amount ("1 tablet"), used when none is typed. */
  dose?: string | null;
  directions?: string | null;
  reason?: string | null;
};

export type QuickEntryProvider = {
  id: string;
  name: string;
  type: ProviderType;
  address?: string | null;
};

/** A medication pass (a named round), as quick entry reads it. */
export type QuickEntryPass = {
  id: string;
  name: string;
  /** "HH:MM" in the recipient's zone. */
  time: string;
  /** Due or overdue now, with medications still to give: "gave meds" means it. */
  due?: boolean;
  /** How many of its medications are still to give today (unknown when left out). */
  open?: number;
};

export type QuickEntryContext = {
  now: Date;
  /** The recipient's IANA zone: time phrases are read in it. */
  timeZone: string;
  /** The user's units: numbers without a unit are read in them. */
  units: UnitChoices;
  /** The group's current medications. */
  medications: readonly QuickEntryMedication[];
  /** The group's live providers. */
  providers: readonly QuickEntryProvider[];
  /** The group's live passes, in the day's order (due ones flagged). */
  passes?: readonly QuickEntryPass[];
};

/** Something to show on a card. A blocking one stops that card from saving. */
export type QuickEntryWarning = { message: string; blocking: boolean };

export type QuickEntryReading = {
  kind: ActionKind;
  /** The kind as a word, for the card and its alternative chips ("Vital", "Note"). */
  label: string;
  actions: AssistantAction[];
  /** 0–1; readings are sorted by it, best first. */
  confidence: number;
  warnings: QuickEntryWarning[];
};

export type QuickEntryPart = { text: string; readings: QuickEntryReading[] };
export type QuickEntryResult = { parts: QuickEntryPart[] };

export const KIND_LABELS: Record<ActionKind, string> = {
  vital: "Vital",
  symptom: "Symptom",
  dose: "Dose",
  note: "Note",
  event: "Event",
};

/** Kind prefixes: `v: …` is always a vital. */
const PREFIXES: Record<string, ActionKind> = { n: "note", e: "event", s: "symptom", v: "vital", d: "dose" };

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

type Token = { raw: string; w: string };

/** Titles and credentials around a name, never matched on their own. */
export const HONORIFICS: ReadonlySet<string> = new Set([
  "dr",
  "doctor",
  "mr",
  "mrs",
  "ms",
  "mx",
  "miss",
  "prof",
  "professor",
  "md",
  "do",
  "np",
  "pa",
  "rn",
  "lpn",
  "phd",
  "dds",
  "dmd",
  "dpm",
  "pharmd",
  "jr",
  "sr",
]);

/** Small words that never name anything here. */
const FILLER = new Set([
  "a",
  "an",
  "the",
  "her",
  "his",
  "him",
  "she",
  "he",
  "they",
  "them",
  "their",
  "my",
  "mom",
  "dad",
  "of",
  "to",
  "for",
  "with",
  "and",
  "also",
  "some",
  "is",
  "was",
  "has",
  "had",
  "it",
  "at",
  "on",
  "in",
  "just",
  "-",
  ":",
  "=",
]);

/** Vital keywords (longest first within a type), lowercase words. */
const VITAL_WORDS: [string[], VitalType][] = [
  [["blood", "pressure"], "bloodPressure"],
  [["bp"], "bloodPressure"],
  [["b/p"], "bloodPressure"],
  [["heart", "rate"], "heartRate"],
  [["heartrate"], "heartRate"],
  [["hr"], "heartRate"],
  [["pulse", "ox"], "spo2"],
  [["pulse"], "heartRate"],
  [["temperature"], "temperature"],
  [["temp"], "temperature"],
  [["fever"], "temperature"],
  [["oxygen", "saturation"], "spo2"],
  [["oxygen", "sat"], "spo2"],
  [["oxygen", "sats"], "spo2"],
  [["o2", "sat"], "spo2"],
  [["o2", "sats"], "spo2"],
  [["oxygen"], "spo2"],
  [["spo2"], "spo2"],
  [["sp02"], "spo2"],
  [["sats"], "spo2"],
  [["sat"], "spo2"],
  [["o2"], "spo2"],
  [["respiratory", "rate"], "respiratoryRate"],
  [["breathing", "rate"], "respiratoryRate"],
  [["resp", "rate"], "respiratoryRate"],
  [["respirations"], "respiratoryRate"],
  [["breaths"], "respiratoryRate"],
  [["resp"], "respiratoryRate"],
  [["rr"], "respiratoryRate"],
  [["weight"], "weight"],
  [["weighs"], "weight"],
  [["weighed"], "weight"],
  [["wt"], "weight"],
  [["blood", "sugar"], "bloodGlucose"],
  [["blood", "glucose"], "bloodGlucose"],
  [["sugar"], "bloodGlucose"],
  [["glucose"], "bloodGlucose"],
  [["bg"], "bloodGlucose"],
  [["bs"], "bloodGlucose"],
  [["bgl"], "bloodGlucose"],
  [["cbg"], "bloodGlucose"],
  [["bowel", "movement"], "bowelMovement"],
  [["bowels"], "bowelMovement"],
  [["bowel"], "bowelMovement"],
  [["bm"], "bowelMovement"],
  [["stool"], "bowelMovement"],
  [["poop"], "bowelMovement"],
  [["pooped"], "bowelMovement"],
  [["urine", "output"], "urineOutput"],
  [["urine"], "urineOutput"],
  [["urinated"], "urineOutput"],
  [["pee"], "urineOutput"],
  [["peed"], "urineOutput"],
  [["voided"], "urineOutput"],
  [["uo"], "urineOutput"],
  [["slept"], "sleep"],
  [["sleep"], "sleep"],
];
const VITAL_SINGLE_WORDS = new Set(VITAL_WORDS.filter(([w]) => w.length === 1).map(([w]) => w[0]!));

const DOSE_VERBS: Record<string, DoseStatus> = {
  give: "given",
  gave: "given",
  given: "given",
  giving: "given",
  took: "given",
  taken: "given",
  take: "given",
  administered: "given",
  skip: "skipped",
  skipped: "skipped",
  missed: "skipped",
  held: "skipped",
  hold: "skipped",
  withheld: "skipped",
  omitted: "skipped",
  refuse: "refused",
  refused: "refused",
  refuses: "refused",
  declined: "refused",
  rejected: "refused",
};
const REFUSING = new Set(["wouldnt", "wouldn't", "wont", "won't", "didnt", "didn't"]);

/** Words that mean "the medications due" rather than naming one: "gave meds", "gave all". */
const GENERIC_MEDS_WORDS = [
  "meds",
  "medications",
  "medicines",
  "tablets",
  "all",
  "everything",
  "round",
  "pass",
];
const GENERIC_MEDS = new Set([
  ...GENERIC_MEDS_WORDS,
  "med",
  "medication",
  "medicine",
  "pill",
  "pills",
  "dose",
  "doses",
]);

/** Words in a dose line that aren't the medication's name. */
const DOSE_FILLER = new Set([
  ...FILLER,
  "dose",
  "doses",
  "med",
  "medication",
  "medicine",
  "pill",
  "pills",
  "her's",
  ...GENERIC_MEDS_WORDS,
]);

/** The start of words for things felt or reported (symptoms). */
const SYMPTOM_STEMS = [
  "pain",
  "ache",
  "achy",
  "aching",
  "sore",
  "hurt",
  "dizz",
  "lightheaded",
  "faint",
  "nause",
  "vomit",
  "threw up",
  "headache",
  "migraine",
  "cough",
  "tired",
  "fatigu",
  "exhaust",
  "weak",
  "confus",
  "disoriented",
  "anxi",
  "agitat",
  "restless",
  "constipat",
  "diarrh",
  "itch",
  "rash",
  "swell",
  "swollen",
  "chill",
  "cramp",
  "bloat",
  "insomnia",
  "numb",
  "tingl",
  "wheez",
  "breathless",
  "short of breath",
  "sob",
  "fever",
  "feverish",
  "sweat",
  "shak",
  "tremor",
  "heartburn",
  "reflux",
  "depress",
  "low mood",
  "sad",
  "tearful",
  "hallucinat",
  "drows",
  "sleepy",
  "lethargic",
  "groggy",
  "unwell",
  "sick",
  "stiff",
  "burning",
  "bleed",
  "bruis",
];

/** Words that make a line an appointment (with its time read ahead). */
const APPOINTMENT_WORDS = new Set([
  "appt",
  "appts",
  "appointment",
  "appointments",
  "apt",
  "visit",
  "checkup",
  "check-up",
  "consult",
  "consultation",
]);

/** Things that happened, read as events. */
const EVENT_WORDS = new Set([
  "fell",
  "fall",
  "fallen",
  "slipped",
  "tripped",
  "ambulance",
  "911",
  "hospital",
  "hospitalized",
  "admitted",
  "discharged",
  "er",
]);

const LEADING_SYMPTOM_FILLER = new Set([
  ...FILLER,
  "having",
  "feels",
  "feeling",
  "felt",
  "c/o",
  "complains",
  "complaining",
  "reports",
  "reported",
  "says",
  "said",
  "seems",
  "seemed",
]);

const tokenize = (text: string): Token[] => {
  const normalized = text
    // "130 / 85" → "130/85"; "99.1 °F" → "99.1°F"
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2")
    .replace(/(\d)\s+°/g, "$1°");
  const tokens: Token[] = [];
  for (const raw of normalized.split(/\s+/).filter(Boolean)) {
    const w = raw
      .toLowerCase()
      .replace(/^[("'“‘[]+/, "")
      .replace(/[)"'”’\].,!?:;]+$/, "");
    if (!w) continue;
    // "bp130/85", "hr72": a keyword joined to its number.
    const joined = /^([a-z/]+)(\d.*)$/.exec(w);
    if (joined && VITAL_SINGLE_WORDS.has(joined[1]!)) {
      tokens.push({ raw: raw.slice(0, joined[1]!.length), w: joined[1]! });
      tokens.push({ raw: raw.slice(joined[1]!.length), w: joined[2]! });
      continue;
    }
    tokens.push({ raw, w });
  }
  return tokens;
};

const capitalize = (text: string) => (text ? text[0]!.toUpperCase() + text.slice(1) : text);
const rawOf = (tokens: readonly Token[], idx: readonly number[]) =>
  idx
    .map((i) => tokens[i]!.raw)
    .join(" ")
    .replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, "");
const meaningful = (tokens: readonly Token[], idx: readonly number[], filler: ReadonlySet<string> = FILLER) =>
  idx.some((i) => !filler.has(tokens[i]!.w));

/** Optimal string alignment distance (Levenshtein with swaps), for misspelled names. */
export const editDistance = (a: string, b: string) => {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[a.length]![b.length]!;
};

const wordsOf = (text: string): string[] => foldSearchText(text).match(/[\p{L}\p{N}]+/gu) ?? [];

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------

type FoundVital = {
  reading: Record<string, number | null>;
  type: VitalType;
  units: UnitChoices;
  used: number[];
};

const UNIT_WORDS: Record<
  string,
  { measure: keyof UnitChoices; unit: UnitFor<keyof UnitChoices> } | { fixed: VitalType[] }
> = {
  f: { measure: "temperature", unit: "f" },
  "°f": { measure: "temperature", unit: "f" },
  fahrenheit: { measure: "temperature", unit: "f" },
  c: { measure: "temperature", unit: "c" },
  "°c": { measure: "temperature", unit: "c" },
  celsius: { measure: "temperature", unit: "c" },
  "°": { fixed: ["temperature"] },
  degrees: { fixed: ["temperature"] },
  kg: { measure: "weight", unit: "kg" },
  kgs: { measure: "weight", unit: "kg" },
  kilo: { measure: "weight", unit: "kg" },
  kilos: { measure: "weight", unit: "kg" },
  lb: { measure: "weight", unit: "lb" },
  lbs: { measure: "weight", unit: "lb" },
  pound: { measure: "weight", unit: "lb" },
  pounds: { measure: "weight", unit: "lb" },
  "mg/dl": { measure: "glucose", unit: "mg/dL" },
  mgdl: { measure: "glucose", unit: "mg/dL" },
  mmol: { measure: "glucose", unit: "mmol/L" },
  "mmol/l": { measure: "glucose", unit: "mmol/L" },
  ml: { measure: "volume", unit: "mL" },
  mls: { measure: "volume", unit: "mL" },
  cc: { measure: "volume", unit: "mL" },
  oz: { measure: "volume", unit: "fl oz" },
  floz: { measure: "volume", unit: "fl oz" },
  bpm: { fixed: ["heartRate", "respiratoryRate"] },
  "%": { fixed: ["spo2"] },
  mmhg: { fixed: ["bloodPressure"] },
  h: { fixed: ["sleep"] },
  hr: { fixed: ["sleep"] },
  hrs: { fixed: ["sleep"] },
  hour: { fixed: ["sleep"] },
  hours: { fixed: ["sleep"] },
  "/min": { fixed: ["respiratoryRate"] },
};

/** Units that say which vital a number is, without a keyword ("65 kg", "72 bpm", "99.1°F"). */
const IMPLYING_UNITS: Record<string, VitalType> = {
  kg: "weight",
  kgs: "weight",
  lb: "weight",
  lbs: "weight",
  pounds: "weight",
  bpm: "heartRate",
  "°f": "temperature",
  "°c": "temperature",
  fahrenheit: "temperature",
  celsius: "temperature",
  "mg/dl": "bloodGlucose",
  mgdl: "bloodGlucose",
  mmol: "bloodGlucose",
  "mmol/l": "bloodGlucose",
};

const MEASURE_OF: Partial<Record<VitalType, keyof UnitChoices>> = {
  temperature: "temperature",
  weight: "weight",
  bloodGlucose: "glucose",
  urineOutput: "volume",
};

/** A unit word for `type`: the units to read its number in, or null when the word isn't its unit. */
const unitFor = (type: VitalType, word: string | undefined, units: UnitChoices): UnitChoices | null => {
  if (!word) return null;
  const spec = UNIT_WORDS[word];
  if (!spec) return null;
  if ("fixed" in spec) return spec.fixed.includes(type) ? units : null;
  return MEASURE_OF[type] === spec.measure ? { ...units, [spec.measure]: spec.unit } : null;
};

/** A number, optionally with a unit stuck to it: "99.1", "99.1f", "65kg", "98%", "7h". */
const numberToken = (w: string | undefined) => {
  const m = w ? /^(\d+(?:\.\d+)?)(°?[a-z%/]+)?$/.exec(w) : null;
  return m ? { value: Number(m[1]), unit: m[2] } : null;
};

const CONNECTORS = new Set([":", "=", "-", "is", "was", "of", "at", "about", "around", "~"]);

const readVitalValue = (
  type: VitalType,
  tokens: readonly Token[],
  start: number,
  free: (i: number) => boolean,
  units: UnitChoices,
): Omit<FoundVital, "type"> | null => {
  let i = start;
  while (i < tokens.length && free(i) && CONNECTORS.has(tokens[i]!.w) && tokens[i]!.w !== "at") i++;
  const w = (k: number) => (free(k) ? tokens[k]?.w : undefined);

  if (type === "bloodPressure") {
    const m = /^(\d{2,4})\/(\d{2,4})(mmhg)?$/.exec(w(i) ?? "");
    if (m) {
      const used = [i];
      if (w(i + 1) === "mmhg") used.push(i + 1);
      return { reading: { systolic: Number(m[1]), diastolic: Number(m[2]) }, units, used };
    }
    if (/^\d{2,4}$/.test(w(i) ?? "") && w(i + 1) === "over" && /^\d{2,4}$/.test(w(i + 2) ?? ""))
      return {
        reading: { systolic: Number(w(i)), diastolic: Number(w(i + 2)) },
        units,
        used: [i, i + 1, i + 2],
      };
    return null;
  }
  if (type === "bowelMovement") {
    if ((w(i) === "type" || w(i) === "bristol") && /^[1-7]$/.test(w(i + 1) ?? ""))
      return { reading: { bristol: Number(w(i + 1)) }, units, used: [i, i + 1] };
    const t = /^t?([1-7])$/.exec(w(i) ?? "");
    if (t && !(w(i + 1) && /^(am|pm|min|mins|hours?|hrs?)$/.test(w(i + 1)!)))
      return { reading: { bristol: Number(t[1]) }, units, used: [i] };
    return { reading: { bristol: null }, units, used: [] };
  }
  const n = numberToken(w(i));
  if (!n) return type === "urineOutput" ? { reading: { value: null }, units, used: [] } : null;
  // "37.2c", or "37.2 c", or "65 kg"; "7 hours", "fl oz" (two words).
  let readUnits = units;
  const used = [i];
  if (n.unit) {
    const u = unitFor(type, n.unit, units);
    if (!u) return null;
    readUnits = u;
  } else {
    const next = w(i + 1);
    if (next === "fl" && w(i + 2) === "oz" && type === "urineOutput") {
      readUnits = { ...units, volume: "fl oz" };
      used.push(i + 1, i + 2);
    } else {
      const u = unitFor(type, next, units);
      if (u) {
        readUnits = u;
        used.push(i + 1);
      }
    }
  }
  return { reading: { value: n.value }, units: readUnits, used };
};

const findVitals = (tokens: readonly Token[], taken: ReadonlySet<number>, units: UnitChoices) => {
  const used = new Set<number>();
  const free = (i: number) => !taken.has(i) && !used.has(i);
  const found: FoundVital[] = [];
  const seen = new Set<VitalType>();
  const add = (v: FoundVital) => {
    if (seen.has(v.type)) return;
    seen.add(v.type);
    found.push(v);
    for (const i of v.used) used.add(i);
  };

  for (let i = 0; i < tokens.length; i++) {
    if (!free(i)) continue;
    for (const [words, type] of VITAL_WORDS) {
      if (seen.has(type)) continue;
      if (!words.every((word, k) => free(i + k) && tokens[i + k]?.w === word)) continue;
      const value = readVitalValue(type, tokens, i + words.length, free, units);
      if (!value) continue;
      add({ type, ...value, used: [...words.map((_, k) => i + k), ...value.used] });
      break;
    }
  }
  return { found, used };
};

/** Numbers whose unit says which vital they are, and bare blood pressures, with no keyword. */
const findImplied = (tokens: readonly Token[], taken: ReadonlySet<number>, units: UnitChoices) => {
  const found: FoundVital[] = [];
  const used = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (taken.has(i) || used.has(i)) continue;
    const w = tokens[i]!.w;
    const bp = /^(\d{2,3})\/(\d{2,3})$/.exec(w);
    if (bp) {
      const systolic = Number(bp[1]);
      const diastolic = Number(bp[2]);
      if (systolic >= 60 && systolic <= 260 && diastolic >= 30 && diastolic < systolic) {
        const u = [i];
        if (tokens[i + 1]?.w === "mmhg") u.push(i + 1);
        found.push({ type: "bloodPressure", reading: { systolic, diastolic }, units, used: u });
        u.forEach((k) => used.add(k));
      }
      continue;
    }
    const n = numberToken(w);
    if (!n) continue;
    const unitWord = n.unit ?? tokens[i + 1]?.w;
    const type = unitWord ? IMPLYING_UNITS[unitWord] : undefined;
    if (!type || found.some((f) => f.type === type)) continue;
    const readUnits = unitFor(type, unitWord, units) ?? units;
    const u = n.unit ? [i] : [i, i + 1];
    found.push({ type, reading: { value: n.value }, units: readUnits, used: u });
    u.forEach((k) => used.add(k));
  }
  return { found, used };
};

const rangeMessage = (field: VitalFieldSpec, units: UnitChoices, label: string) => {
  const { min, max } = fieldRange(field, units);
  const unit = fieldUnitLabel(field, units);
  const what = field.integer ? "a whole number" : "a number";
  return `${label}: enter ${what} from ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}${unit ? ` ${unit}` : ""}.`;
};

const EPSILON = 1e-6;

/** A found vital as a stored reading (canonical units), with its warnings. */
const toReading = (v: FoundVital): { reading: VitalReading; warnings: QuickEntryWarning[] } => {
  const spec = VITALS[v.type];
  const warnings: QuickEntryWarning[] = [];
  const values: Record<string, number | null> = {};
  for (const field of spec.fields) {
    const typed = v.reading[field.key];
    if (typed == null) {
      values[field.key] = null;
      continue;
    }
    const label = spec.fields.length > 1 ? field.label : spec.label;
    const canonical = fromDisplay(field, typed, v.units);
    values[field.key] = canonical;
    if (field.integer && !Number.isInteger(typed)) {
      warnings.push({ message: rangeMessage(field, v.units, label), blocking: true });
    } else if (canonical < field.min - EPSILON || canonical > field.max + EPSILON) {
      warnings.push({ message: rangeMessage(field, v.units, label), blocking: true });
    } else if (isUnusual(field, canonical)) {
      warnings.push({ message: `${label}: that's unusual. Double-check it before saving.`, blocking: false });
    }
  }
  if (v.type === "bloodPressure" && values.systolic != null && values.diastolic != null) {
    if (values.diastolic >= values.systolic) warnings.push({ message: BP_ORDER_MESSAGE, blocking: true });
  }
  const reading = { type: v.type, ...values } as unknown as VitalReading;
  if (v.type === "bowelMovement" && values.bristol == null)
    (reading as { bristol: number | null }).bristol = null;
  return { reading, warnings };
};

// ---------------------------------------------------------------------------
// Names: medications and providers
// ---------------------------------------------------------------------------

type NameMatch<T> = { item: T; score: number; used: number[] };

/** How well `tokens` (by index) name a medication: 1 exact, 0.9 a prefix … 0.7 a near miss, 0 none. */
const matchMedication = (
  med: QuickEntryMedication,
  tokens: readonly Token[],
  idx: readonly number[],
): NameMatch<QuickEntryMedication> | null => {
  const nameWords = wordsOf(med.name);
  if (!nameWords.length) return null;
  const otherWords = new Set(wordsOf(`${med.directions ?? ""} ${med.reason ?? ""}`));
  let best = 0;
  const used = new Set<number>();
  for (const i of idx) {
    const words = wordsOf(tokens[i]!.w);
    if (words.length !== 1) continue;
    const t = words[0]!;
    if (t.length < 3 || /^\d/.test(t)) continue;
    let score = 0;
    if (nameWords.includes(t)) score = nameWords[0] === t ? 1 : 0.95;
    else if (nameWords[0]!.startsWith(t)) score = 0.9;
    else if (nameWords.some((n) => n.startsWith(t))) score = 0.85;
    else if (t.length >= 4 && otherWords.has(t)) score = 0.8;
    else if (
      t.length >= 4 &&
      nameWords.some((n) => n.length >= 4 && editDistance(t, n) <= (n.length >= 8 ? 2 : 1))
    )
      score = 0.7;
    if (score > 0) {
      used.add(i);
      best = Math.max(best, score);
    }
  }
  return best > 0 ? { item: med, score: best, used: [...used] } : null;
};

const matchMedications = (context: QuickEntryContext, tokens: readonly Token[], idx: readonly number[]) =>
  context.medications
    .map((m) => matchMedication(m, tokens, idx))
    .filter((m): m is NameMatch<QuickEntryMedication> => !!m)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .filter((m, _, all) => m.score >= all[0]!.score - 0.15)
    .slice(0, 3);

/** How well the words name a provider: a whole practice name, or a clinician's name word of 3+ letters. */
const matchProvider = (
  provider: QuickEntryProvider,
  tokens: readonly Token[],
  idx: readonly number[],
): NameMatch<QuickEntryProvider> | null => {
  const nameWords = wordsOf(provider.name).filter((w) => !HONORIFICS.has(w));
  if (!nameWords.length) return null;
  const typed = idx.map((i) => ({ i, w: wordsOf(tokens[i]!.w).join("") }));
  const person = provider.type === "clinician" || provider.type === "other";
  const used: number[] = [];
  let score = 0;
  if (person) {
    for (const { i, w } of typed) {
      if (w.length < 3 || HONORIFICS.has(w)) continue;
      const exact = nameWords.indexOf(w);
      const s = exact >= 0 ? (exact === nameWords.length - 1 ? 0.95 : 0.85) : 0;
      if (s > 0) {
        used.push(i);
        score = Math.max(score, s);
      }
    }
    // "dr lee": the honorific goes with the name.
    for (const i of [...used]) if (HONORIFICS.has(wordsOf(tokens[i - 1]?.w ?? "").join(""))) used.push(i - 1);
  } else {
    // Every word of the name, in order, among the typed words.
    const words = typed.map((t) => t.w);
    for (let s = 0; s + nameWords.length <= words.length; s++) {
      if (nameWords.every((n, k) => words[s + k] === n)) {
        score = 1;
        used.push(...typed.slice(s, s + nameWords.length).map((t) => t.i));
        break;
      }
    }
    if (!score && nameWords.length > 1) {
      // The name's first word alone, when it's distinctive ("Riverside" for "Riverside Dialysis").
      const first = typed.find((t) => t.w === nameWords[0] && t.w.length >= 4);
      if (first) {
        score = 0.8;
        used.push(first.i);
      }
    }
  }
  return score > 0 ? { item: provider, score, used } : null;
};

const matchProviders = (context: QuickEntryContext, tokens: readonly Token[], idx: readonly number[]) => {
  const matches = context.providers
    .map((p) => matchProvider(p, tokens, idx))
    .filter((m): m is NameMatch<QuickEntryProvider> => !!m)
    .sort((a, b) => b.score - a.score);
  // One provider per typed word: the best one.
  const claimed = new Set<number>();
  return matches.filter((m) => {
    if (m.used.some((i) => claimed.has(i) && !HONORIFICS.has(tokens[i]!.w))) return false;
    m.used.forEach((i) => claimed.add(i));
    return true;
  });
};

// ---------------------------------------------------------------------------
// One part
// ---------------------------------------------------------------------------

type PartTime = {
  spec: TimeSpec | null;
  past: ResolvedTime;
  future: ResolvedTime;
};

const timeOf = (spec: TimeSpec | null, context: QuickEntryContext): PartTime => {
  const resolve = (direction: TimeDirection) =>
    spec
      ? resolveTime(spec, { now: context.now, timeZone: context.timeZone, direction })
      : { at: context.now, allDay: false };
  return { spec, past: resolve("past"), future: resolve("future") };
};

const futureWarning = (at: Date, context: QuickEntryContext): QuickEntryWarning[] =>
  at.getTime() > context.now.getTime() + DEVICE_FUTURE_SKEW_MS
    ? [{ message: FUTURE_DATE_MESSAGE, blocking: true }]
    : [];

const reading = (
  kind: ActionKind,
  action: AssistantAction,
  confidence: number,
  warnings: QuickEntryWarning[] = [],
): QuickEntryReading => ({ kind, label: KIND_LABELS[kind], actions: [action], confidence, warnings });

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

type PartState = {
  text: string;
  tokens: Token[];
  time: PartTime;
  /** Word indexes not taken by the time phrase. */
  free: number[];
  context: QuickEntryContext;
  /** The status of a dose in the part before, for "gave metformin and lisinopril". */
  previousDose: DoseStatus | null;
  /** Words a vital or dose reading took, which a symptom can't use ("slept 7", "gave 2 tablets"). */
  claimed: Set<number>;
};

const vitalReadings = (s: PartState, forced: boolean): QuickEntryReading[] => {
  const taken = new Set(s.tokens.map((_, i) => i).filter((i) => !s.free.includes(i)));
  const keyword = findVitals(s.tokens, taken, s.context.units);
  for (const i of keyword.used) taken.add(i);
  const implied = findImplied(s.tokens, taken, s.context.units);
  const found = [
    ...keyword.found,
    ...implied.found.filter((f) => !keyword.found.some((k) => k.type === f.type)),
  ];
  if (!found.length) return [];
  const used = new Set([...keyword.used, ...implied.used]);
  for (const i of used) s.claimed.add(i);
  const rest = s.free.filter((i) => !used.has(i));
  const converted = found.map(toReading);
  const at = s.time.past.at;
  const note = meaningful(s.tokens, rest) ? truncate(rawOf(s.tokens, rest), TIMELINE_LIMITS.body) : null;
  const warnings = [...converted.flatMap((c) => c.warnings), ...futureWarning(at, s.context)];
  const onlyBareBp = !keyword.found.length;
  const confidence = forced ? 1 : onlyBareBp ? (note ? 0.5 : 0.8) : 0.95;
  return [
    reading(
      "vital",
      { type: "logVital", readings: converted.map((c) => c.reading), note, occurredAt: at.toISOString() },
      confidence,
      warnings,
    ),
  ];
};

/** The amount in a dose line: "2 tablets", "500 mg", "half a tablet", "10ml". */
const AMOUNT_UNITS =
  /^(tablets?|tabs?|capsules?|caps?|pills?|mg|mcg|g|ml|mls|cc|units?|puffs?|drops?|patch(es)?|sprays?|teaspoons?|tsp|tablespoons?|tbsp|sachets?|doses?|inhalations?)$/;
const findAmount = (tokens: readonly Token[], idx: readonly number[]) => {
  const at = (k: number) => (idx.includes(k) ? tokens[k]!.w : undefined);
  for (const i of idx) {
    const w = tokens[i]!.w;
    const joined = /^(\d+(?:\.\d+)?|½)([a-z]+)$/.exec(w);
    if (joined && AMOUNT_UNITS.test(joined[2]!)) return [i];
    const isCount = /^(\d+(?:\.\d+)?|\d\/\d|½|half|one|two|three|four)$/.test(w);
    if (isCount && AMOUNT_UNITS.test(at(i + 1) ?? "")) return [i, i + 1];
    if ((w === "half" || w === "a" || w === "an") && at(i + 1) === "a" && AMOUNT_UNITS.test(at(i + 2) ?? ""))
      return [i, i + 1, i + 2];
    if ((w === "a" || w === "an") && AMOUNT_UNITS.test(at(i + 1) ?? "") && !/^doses?$/.test(at(i + 1) ?? ""))
      return [i, i + 1];
  }
  return [];
};

const PRONOUNS = new Set(["her", "his", "him", "them", "their", "the", "a", "an", "my", "she", "he"]);

const doseReadings = (s: PartState, forced: boolean): QuickEntryReading[] => {
  let status: DoseStatus | null = null;
  const verbUsed: number[] = [];
  for (const i of s.free) {
    const w = s.tokens[i]!.w;
    if (
      REFUSING.has(w) ||
      (w === "did" && s.tokens[i + 1]?.w === "not") ||
      (w === "would" && s.tokens[i + 1]?.w === "not")
    ) {
      const take = s.free.find(
        (k) => k > i && k <= i + 3 && ["take", "have", "swallow"].includes(s.tokens[k]!.w),
      );
      if (take !== undefined) {
        status = "refused";
        for (let k = i; k <= take; k++) verbUsed.push(k);
        break;
      }
    }
    if (w in DOSE_VERBS) {
      status = DOSE_VERBS[w]!;
      verbUsed.push(i);
      break;
    }
  }
  const rest = s.free.filter((i) => !verbUsed.includes(i));
  const amountUsed = findAmount(s.tokens, rest);
  const nameIdx = rest.filter((i) => !amountUsed.includes(i) && !DOSE_FILLER.has(s.tokens[i]!.w));
  const matches = matchMedications(s.context, s.tokens, nameIdx);
  if (!matches.length) return [];
  // Without a verb of its own, only a medication's name counts (not its notes).
  if (!status && !forced && matches[0]!.score < 0.85) return [];
  const inherited = status ?? s.previousDose;
  // A line that is only a medication's name (and maybe an amount) is a dose too.
  const nameOnly = matches[0]!.score >= 0.85 && nameIdx.every((i) => matches[0]!.used.includes(i));
  if (!inherited && !forced && !nameOnly) return [];
  for (const i of [...verbUsed, ...amountUsed, ...matches[0]!.used]) s.claimed.add(i);
  const at = s.time.past.at;
  const amount = amountUsed.length ? rawOf(s.tokens, amountUsed) : null;
  return matches.map((m, rank) => {
    const noteIdx = stripLeading(
      s.tokens,
      rest.filter((i) => !amountUsed.includes(i) && !m.used.includes(i)),
      PRONOUNS,
    );
    const note = meaningful(s.tokens, noteIdx, DOSE_FILLER) ? truncate(rawOf(s.tokens, noteIdx), 500) : null;
    const base = status ? 0.9 : s.previousDose ? 0.8 : forced ? 0.9 : 0.6;
    return reading(
      "dose",
      {
        type: "logDose",
        medicationId: m.item.id,
        status: inherited ?? "given",
        amount: amount ?? m.item.dose ?? null,
        note,
        occurredAt: at.toISOString(),
      },
      (forced ? 1 : base * m.score) - rank * 0.01,
      futureWarning(at, s.context),
    );
  });
};

/**
 * A pass's Given all: "gave evening meds", "gave morning", "evening meds
 * given", and "gave meds" or "gave all", which mean the pass due now (the
 * pass nearest a time phrase when there is one; otherwise due passes first,
 * then the nearest by the clock). Only "given": skipping or refusing a whole
 * pass is a dose at a time. Any other word (a medication's name, a note)
 * makes it something else.
 */
const passReadings = (s: PartState, forced: boolean): QuickEntryReading[] => {
  const passes = s.context.passes ?? [];
  if (!passes.length) return [];
  let status: DoseStatus | null = null;
  let verb = -1;
  for (const i of s.free) {
    const w = s.tokens[i]!.w;
    if (REFUSING.has(w) || w === "not") return [];
    if (w in DOSE_VERBS) {
      status = DOSE_VERBS[w]!;
      verb = i;
      break;
    }
  }
  const inherited = status ?? s.previousDose;
  if (inherited && inherited !== "given") return [];
  const rest = s.free.filter((i) => i !== verb);

  // A pass named by all its words, the longest name first ("Late evening" over "Evening").
  const restWords = new Map(rest.map((i) => [i, wordsOf(s.tokens[i]!.w)[0] ?? ""]));
  const named = passes
    .map((pass) => {
      const words = wordsOf(pass.name);
      const used = words.map((w) => [...restWords].find(([, t]) => t === w)?.[0]);
      return words.length && used.every((i) => i !== undefined) ? { pass, used } : null;
    })
    .filter((m): m is { pass: QuickEntryPass; used: number[] } => !!m)
    .sort((a, b) => b.used.length - a.used.length)[0];
  const others = rest.filter((i) => !named?.used.includes(i) && !FILLER.has(s.tokens[i]!.w));
  if (!others.every((i) => GENERIC_MEDS.has(s.tokens[i]!.w))) return [];
  const generic = others.length > 0;
  if (!named && !generic) return [];
  if (!inherited && !forced && !(named && generic)) return [];

  const at = s.time.past.at;
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const clock = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: s.context.timeZone,
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    return minutes(`${get("hour")}:${get("minute")}`);
  };
  const distance = (pass: QuickEntryPass) => {
    const d = Math.abs(minutes(pass.time) - clock(at));
    return Math.min(d, 24 * 60 - d);
  };
  // Without a name: with a time phrase, the pass nearest it; otherwise due passes first.
  const ranked = named
    ? [named.pass]
    : [...passes].sort(
        (a, b) =>
          Number(a.open === 0) - Number(b.open === 0) ||
          (s.time.spec ? 0 : Number(!a.due) - Number(!b.due)) ||
          distance(a) - distance(b),
      );
  for (const i of [...(verb >= 0 ? [verb] : []), ...(named?.used ?? []), ...others]) s.claimed.add(i);
  return ranked.slice(0, 3).map((pass, rank) => {
    const base = named
      ? status || forced
        ? 0.97
        : inherited
          ? 0.85
          : 0.75
      : (pass.due && pass.open !== 0) || s.time.spec
        ? 0.92
        : 0.55;
    const warnings = futureWarning(at, s.context);
    if (pass.open === 0 && !s.time.spec)
      warnings.push({ message: `Nothing is left to give in ${pass.name} today.`, blocking: true });
    return reading(
      "dose",
      { type: "givePass", passId: pass.id, occurredAt: at.toISOString() },
      base - rank * 0.05,
      warnings,
    );
  });
};

const hasSymptomWord = (tokens: readonly Token[], idx: readonly number[]) => {
  const text = ` ${idx.map((i) => tokens[i]!.w).join(" ")} `;
  return SYMPTOM_STEMS.some((stem) =>
    stem.includes(" ") ? text.includes(` ${stem} `) : idx.some((i) => tokens[i]!.w.startsWith(stem)),
  );
};

const stripLeading = (tokens: readonly Token[], idx: number[], filler: ReadonlySet<string>) => {
  let k = 0;
  while (k < idx.length && filler.has(tokens[idx[k]!]!.w)) k++;
  return idx.slice(k);
};

/** A number before one of these is an amount or a length, not a severity. */
const NOT_SEVERITY_AFTER =
  /^(tablets?|tabs?|capsules?|caps?|pills?|mg|mcg|g|ml|mls|cc|units?|puffs?|drops?|hours?|hrs?|h|min|mins|minutes?|times|x|kg|lbs?|pounds?|days?|weeks?|%)$/;

const symptomReadings = (s: PartState, forced: boolean): QuickEntryReading[] => {
  const at = s.time.past.at;
  const make = (name: string, severity: number | null, note: string | null, confidence: number) =>
    reading(
      "symptom",
      {
        type: "logSymptom",
        name: capitalize(truncate(name, TIMELINE_LIMITS.symptomName)),
        severity,
        note,
        occurredAt: at.toISOString(),
      },
      confidence,
      futureWarning(at, s.context),
    );

  const free = s.free.filter((i) => !s.claimed.has(i));
  if (free.some((i) => s.tokens[i]!.w in DOSE_VERBS)) return [];
  // A severity: "6", "6/10", "6 out of 10".
  for (const [pos, i] of free.entries()) {
    const w = s.tokens[i]!.w;
    if (NOT_SEVERITY_AFTER.test(s.tokens[i + 1]?.w ?? "")) continue;
    const outOf = s.tokens[i + 1]?.w === "out" && s.tokens[i + 2]?.w === "of" && s.tokens[i + 3]?.w === "10";
    const m = /^(\d{1,2})(?:\/10)?$/.exec(w);
    if (!m || Number(m[1]) > TIMELINE_LIMITS.severityMax) continue;
    const severity = Number(m[1]);
    const explicit = w.includes("/") || outOf;
    let before = stripLeading(s.tokens, free.slice(0, pos), LEADING_SYMPTOM_FILLER);
    // "pain level 6", "pain of 6"
    while (before.length && ["level", "of", "is", "at", "-", ":", "="].includes(s.tokens[before.at(-1)!]!.w))
      before = before.slice(0, -1);
    const after = free.slice(pos + 1 + (outOf ? 3 : 0));
    if (before.length) {
      const noteIdx = stripLeading(s.tokens, after, new Set(["in", "on", "at", "-", ":", "the"]));
      const note = meaningful(s.tokens, noteIdx) ? rawOf(s.tokens, noteIdx) : null;
      const long = before.length > 6;
      return [make(rawOf(s.tokens, before), severity, note, forced ? 1 : long ? 0.5 : 0.85)];
    }
    if (explicit && after.length) {
      const cut = after.findIndex((k) =>
        ["in", "on", "when", "after", "since", "at"].includes(s.tokens[k]!.w),
      );
      const nameIdx = cut > 0 ? after.slice(0, cut) : after;
      const noteIdx = cut > 0 ? stripLeading(s.tokens, after.slice(cut), new Set(["in", "on", "at"])) : [];
      if (!meaningful(s.tokens, nameIdx)) continue;
      return [
        make(
          rawOf(s.tokens, nameIdx),
          severity,
          meaningful(s.tokens, noteIdx) ? rawOf(s.tokens, noteIdx) : null,
          forced ? 1 : 0.8,
        ),
      ];
    }
  }

  // No severity: a short complaint ("dizzy", "nausea after lunch").
  if (free.length < s.free.length) return [];
  const idx = stripLeading(s.tokens, free, LEADING_SYMPTOM_FILLER);
  if (!meaningful(s.tokens, idx)) return [];
  const word = hasSymptomWord(s.tokens, idx);
  if (!word && !forced) return [];
  const short = idx.length <= 5;
  return [make(rawOf(s.tokens, idx), null, null, forced ? 1 : short ? 0.6 : 0.3)];
};

const eventReadings = (s: PartState, forced: boolean): QuickEntryReading[] => {
  const keywordIdx = s.free.filter((i) => APPOINTMENT_WORDS.has(s.tokens[i]!.w));
  const keyword = keywordIdx.length > 0;
  const happened = s.free.some((i) => EVENT_WORDS.has(s.tokens[i]!.w));
  const ahead = !!s.time.spec && saysFuture(s.time.spec);
  if (!keyword && !ahead && !happened && !forced) return [];

  const future = keyword || ahead;
  const when = future ? s.time.future : s.time.past;
  let rest = s.free.filter((i) => !keywordIdx.includes(i));

  // The place: "at Riverside" (a time after "at" was taken already).
  const placeIdx: number[] = [];
  const atPos = rest.findIndex((i) => s.tokens[i]!.w === "at");
  if (keyword || ahead) {
    if (atPos >= 0) {
      for (
        let k = atPos + 1;
        k < rest.length && !["with", "for", "to", "about"].includes(s.tokens[rest[k]!]!.w);
        k++
      )
        placeIdx.push(rest[k]!);
      if (placeIdx.length) rest = rest.filter((i) => i !== rest[atPos] && !placeIdx.includes(i));
    }
  }
  const providers = matchProviders(s.context, s.tokens, [...rest, ...placeIdx]);
  const providerUsed = new Set(providers.flatMap((p) => p.used));
  const placeProvider = providers.find((p) => p.used.some((i) => placeIdx.includes(i)));
  const placeText = placeIdx.length ? rawOf(s.tokens, placeIdx) : null;
  const place = placeProvider ? placeProvider.item.address?.trim() || placeText : placeText;

  const titleIdx = stripLeading(
    s.tokens,
    rest.filter((i) => !providerUsed.has(i)),
    new Set([...FILLER, "see", "seeing", "w/", "w"]),
  ).filter((i, k, all) => !(k === all.length - 1 && ["with", "w/", "for", "to"].includes(s.tokens[i]!.w)));
  const titleWords = meaningful(s.tokens, titleIdx) ? rawOf(s.tokens, titleIdx) : "";
  const keywordWord = keyword ? "appointment" : "";
  const named = providers[0]?.item.name;
  const title = keyword
    ? titleWords
      ? `${capitalize(titleWords)} ${keywordWord}`
      : named
        ? `Appointment with ${named}`
        : "Appointment"
    : capitalize(titleWords || s.text);

  const warnings: QuickEntryWarning[] = [];
  if (keyword && !s.time.spec)
    warnings.push({ message: "No time given, so it's set to now. Edit it to choose when.", blocking: false });
  const confidence = forced ? 1 : keyword ? 0.9 : ahead ? 0.7 : 0.5;
  return [
    reading(
      "event",
      {
        type: "addEvent",
        title: truncate(title, TIMELINE_LIMITS.title),
        occurredAt: when.at.toISOString(),
        allDay: when.allDay,
        place: place ? truncate(place, TIMELINE_LIMITS.place) : null,
        providerIds: providers.map((p) => p.item.id),
        timeZone: s.context.timeZone,
      },
      confidence,
      warnings,
    ),
  ];
};

const noteReading = (s: PartState, confidence: number): QuickEntryReading => {
  // A note dated ahead is a reminder; otherwise it's about what happened.
  const ahead =
    (!!s.time.spec && saysFuture(s.time.spec)) || s.free.some((i) => APPOINTMENT_WORDS.has(s.tokens[i]!.w));
  const when = ahead ? s.time.future : s.time.past;
  return reading(
    "note",
    {
      type: "addNote",
      title: null,
      text: truncate(s.text, TIMELINE_LIMITS.body),
      occurredAt: when.at.toISOString(),
    },
    confidence,
  );
};

/** An event from any text ("Save as event instead"): the text is its title. */
const eventFromText = (s: PartState, confidence: number): QuickEntryReading => {
  const when = s.time.spec && saysFuture(s.time.spec) ? s.time.future : s.time.past;
  return reading(
    "event",
    {
      type: "addEvent",
      title: truncate(capitalize(s.text), TIMELINE_LIMITS.title),
      occurredAt: when.at.toISOString(),
      allDay: when.allDay,
      place: null,
      providerIds: [],
      timeZone: s.context.timeZone,
    },
    confidence,
  );
};

const DETECTORS: Record<
  Exclude<ActionKind, "note">,
  (s: PartState, forced: boolean) => QuickEntryReading[]
> = {
  vital: vitalReadings,
  dose: (s, forced) => [...passReadings(s, forced), ...doseReadings(s, forced)],
  symptom: symptomReadings,
  event: eventReadings,
};

const parsePart = (
  text: string,
  context: QuickEntryContext,
  previousDose: DoseStatus | null,
): QuickEntryPart => {
  const prefix = /^\s*([nesvd]):\s*/i.exec(text);
  const forced = prefix ? PREFIXES[prefix[1]!.toLowerCase()]! : null;
  const body = prefix ? text.slice(prefix[0].length).trim() : text.trim();
  const tokens = tokenize(body);
  const time = findTime(tokens.map((t) => t.w));
  const s: PartState = {
    text: body,
    tokens,
    time: timeOf(time?.spec ?? null, context),
    free: tokens.map((_, i) => i).filter((i) => !time?.used.has(i)),
    context,
    previousDose,
    claimed: new Set(),
  };

  let readings: QuickEntryReading[];
  if (forced === "note") readings = [noteReading(s, 1), eventFromText(s, 0.2)];
  else if (forced) {
    readings = DETECTORS[forced](s, true);
    if (!readings.length && forced === "event") readings = [eventFromText(s, 1)];
    const fallback = noteReading(s, readings.length ? 0.4 : 0.5);
    if (!readings.length)
      fallback.warnings.push({
        message: `Couldn't read a ${KIND_LABELS[forced].toLowerCase()} in this, so it's a note.`,
        blocking: false,
      });
    readings.push(fallback);
  } else {
    readings = [
      ...vitalReadings(s, false),
      ...passReadings(s, false),
      ...doseReadings(s, false),
      ...symptomReadings(s, false),
      ...eventReadings(s, false),
      noteReading(s, 0.4),
    ];
    if (!readings.some((r) => r.kind === "event")) readings.push(eventFromText(s, 0.2));
  }
  readings.sort((a, b) => b.confidence - a.confidence);
  return { text: body, readings };
};

// ---------------------------------------------------------------------------
// The line
// ---------------------------------------------------------------------------

/**
 * A line's parts: split on commas, semicolons, new lines and "and" (not a
 * comma inside a number, "1,000"). A line that starts with `n:` or `e:` is
 * one note or event, whatever it says.
 */
export const splitQuickEntry = (text: string): string[] => {
  const line = text.trim();
  if (!line) return [];
  if (/^[ne]:/i.test(line)) return [line];
  return line
    .split(/\s*(?:;|\n|(?<!\d),|,(?!\d)|\band\b|\bthen\b|&|\+)\s*/i)
    .map((p) => p.trim())
    .filter((p) => /[\p{L}\p{N}]/u.test(p));
};

const best = (part: QuickEntryPart) => part.readings[0]!;

/** Vitals in neighbouring parts ("bp 130/85 and hr 72") are one sitting: one entry, as the form makes it. */
const mergeVitals = (parts: QuickEntryPart[]): QuickEntryPart[] => {
  const merged: QuickEntryPart[] = [];
  for (const part of parts) {
    const prev = merged.at(-1);
    const a = prev && best(prev);
    const b = best(part);
    const av = a?.actions[0];
    const bv = b.actions[0];
    if (
      prev &&
      a &&
      av?.type === "logVital" &&
      bv?.type === "logVital" &&
      av.occurredAt === bv.occurredAt &&
      !av.note &&
      !bv.note &&
      !bv.readings.some((r) => av.readings.some((x) => x.type === r.type))
    ) {
      const action = { ...av, readings: [...av.readings, ...bv.readings] };
      const text = `${prev.text}, ${part.text}`;
      const vital: QuickEntryReading = {
        ...a,
        actions: [action],
        confidence: Math.min(a.confidence, b.confidence),
        warnings: [...a.warnings, ...b.warnings],
      };
      const note: QuickEntryReading = {
        ...prev.readings.find((r) => r.kind === "note")!,
        actions: [{ type: "addNote", title: null, text, occurredAt: av.occurredAt }],
      };
      merged[merged.length - 1] = { text, readings: [vital, note] };
      continue;
    }
    merged.push(part);
  }
  return merged;
};

/** Read a quick-entry line. Every part has at least one reading (a note); nothing is saved. */
export const parseQuickEntry = (text: string, context: QuickEntryContext): QuickEntryResult => {
  const parts: QuickEntryPart[] = [];
  let previousDose: DoseStatus | null = null;
  for (const piece of splitQuickEntry(text)) {
    const part = parsePart(piece, context, previousDose);
    const top = best(part).actions[0];
    previousDose = top?.type === "logDose" ? top.status : top?.type === "givePass" ? "given" : null;
    parts.push(part);
  }
  return { parts: mergeVitals(parts) };
};
