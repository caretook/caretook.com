import type { ActionKind, AssistantAction } from "./assistantActions";
import type { DoseStatus } from "../medications/medication";
import type { ProviderType } from "../providers/provider";
import type { ResolvedTime, TimeDirection, TimeSpec } from "./quickEntryTime";
import type { VocabularyMatch, VocabularyRole } from "./quickEntryVocabulary";
import type { UnitChoices, UnitFor, VitalFieldSpec, VitalReading, VitalType } from "../timeline/vitals";

import { DEVICE_FUTURE_SKEW_MS, FUTURE_DATE_MESSAGE, localDate } from "../core/entryTiming";
import { findTime, periodUnderway, resolveTime, saysFuture, wallTime } from "./quickEntryTime";
import { findVocabulary, vocabularyWord } from "./quickEntryVocabulary";
import { foldSearchText } from "../search/search";
import { TODO_LIMITS } from "../todos/todo";
import { localTime } from "../todos/todoRules";
import { TIMELINE_LIMITS } from "../timeline/timelineEntry";
import {
  BP_ORDER_MESSAGE,
  fieldRange,
  fieldUnitLabel,
  fromDisplay,
  isUnusual,
  VITALS,
} from "../timeline/vitals";

// Quick entry: one line ("bp 130/85 hr 72, gave metformin, pain 4 left
// knee") read as assistant actions, one part per comma, semicolon or "and",
// each with its readings ranked best first. Pure and client-safe; nothing is
// saved here. English only.
//
// Rules, in order, per part: a kind prefix (`n:` `e:` `s:` `v:` `d:`) forces
// a kind; otherwise vitals (a keyword and a number, or a bare `n/n`), doses
// (give/gave/skip/refuse and a medication), symptoms (a phrase and 0–10 or
// `n/10`, a symptom word, or an incident: "fell"), events (`appt`, a named
// provider, or a time ahead), then a note. The words that pick a kind live
// in one table (quickEntryVocabulary.ts). Every part gets a note reading, so
// nothing typed is lost, and keeps every plausible kind as a reading. A time
// phrase ("at 8am", "30 min ago", "yesterday 9pm", "the 25th") sets any
// part's time, in the recipient's zone; which way an ambiguous one reads is
// the reading's: ahead for events and todos (back after a visit verb:
// "saw Dr. Lee friday"), back for the rest, notes included. A todo is asked
// for (`t:`, `task:`, `todo:`: its "for Sam" or "@Sam" names a member, and
// its time phrase is the due day), or is what a note that says a time ahead
// becomes ("call the pharmacy tomorrow"): notes are past-only.

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
  /** The group's members, whom a todo's "for Sam" or "@Sam" can name. */
  members?: readonly QuickEntryMember[];
};

/** A member of the group, as a todo's assignee. */
export type QuickEntryMember = { id: string; name: string };

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
  todo: "Todo",
};

/** Kind prefixes: `v: …` is always a vital. */
const PREFIXES: Record<string, ActionKind> = { n: "note", e: "event", s: "symptom", v: "vital", d: "dose" };

/** A todo's prefix: `t:`, `task:`, `todo:` (or `todo` alone, `to-do:`). */
const TODO_PREFIX = /^\s*(?:(?:t|task|todo|to-do|to do)\s*:|todo\b)\s*/i;

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
const REFUSING = new Set(["wouldnt", "wont", "didnt"]);

/** Words that say something didn't happen, compared with the apostrophe removed (phones type a curly one). */
const NEGATING = new Set([
  "not",
  "never",
  "no",
  "cannot",
  "unable",
  "forgot",
  "didnt",
  "dont",
  "doesnt",
  "couldnt",
  "cant",
  "wasnt",
  "werent",
  "isnt",
  "hasnt",
  "havent",
  "hadnt",
  "wouldnt",
  "wont",
]);
const withoutApostrophe = (w: string) => w.replace(/['’]/g, "");
const isNegating = (w: string) => NEGATING.has(withoutApostrophe(w));

/** Helpers around a negating word that belong to it, not to a dose's note: "did not", "forgot to". */
const NEGATION_LEADS = new Set([
  "did",
  "do",
  "does",
  "could",
  "can",
  "would",
  "was",
  "were",
  "is",
  "has",
  "have",
  "had",
]);
const NEGATION_LINKS = new Set(["to", "be", "been", "being", "was", "get", "able", "ever"]);

/**
 * The negating word that decides for the verb at `verb`: the nearest within
 * three words before it, not counting the words in `names` (a medication's
 * name can be long). A negating word after the verb is ordinary text.
 */
const negationBefore = (
  tokens: readonly Token[],
  free: readonly number[],
  verb: number,
  names: ReadonlySet<number>,
) =>
  free
    .filter((i) => i < verb && !names.has(i))
    .slice(-3)
    .filter((i) => isNegating(tokens[i]!.w))
    .at(-1);

/** The words a negated verb claims: the negating word, its helpers and the verb. */
const negationWords = (tokens: readonly Token[], free: readonly number[], negation: number, verb: number) => {
  const lead = free[free.indexOf(negation) - 1];
  return [
    ...(lead !== undefined && lead === negation - 1 && NEGATION_LEADS.has(tokens[lead]!.w) ? [lead] : []),
    negation,
    ...free.filter((i) => i > negation && i < verb && NEGATION_LINKS.has(tokens[i]!.w)),
    verb,
  ];
};

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

/** Words for trouble that a "no" can open a phrase about, beside the symptom words: "no problems when…". */
const TROUBLE_WORDS = new Set([
  "problem",
  "problems",
  "issue",
  "issues",
  "trouble",
  "complaint",
  "complaints",
]);
/** Words that end the phrase a "no" opens, before what happened: "no pain after…", "no problems when…". */
const PHRASE_ENDS = new Set(["after", "when", "while", "since", "before"]);

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
  /** Read back, for what happened: now when the period said has begun but its usual hour hasn't come. */
  past: ResolvedTime;
  /** Read back at the period's usual hour, even ahead: how `noteAhead` tells a plan from a log. */
  usual: ResolvedTime;
  future: ResolvedTime;
};

const timeOf = (spec: TimeSpec | null, context: QuickEntryContext): PartTime => {
  const resolve = (direction: TimeDirection) =>
    spec
      ? resolveTime(spec, { now: context.now, timeZone: context.timeZone, direction })
      : { at: context.now, allDay: false };
  const usual = resolve("past");
  const underway = !!spec && periodUnderway(spec, context);
  return {
    spec,
    past: underway ? { at: context.now, allDay: false } : usual,
    usual,
    future: resolve("future"),
  };
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
  /** The vocabulary's phrases among the free words. */
  vocab: VocabularyMatch[];
  /** The providers the words name, best first. */
  providers: NameMatch<QuickEntryProvider>[];
  /** Those named clearly enough to make the part about them (an event, or a note with a contact verb). */
  naming: NameMatch<QuickEntryProvider>[];
};

const roleIdx = (s: PartState, ...roles: VocabularyRole[]) =>
  s.vocab.filter((m) => roles.includes(m.entry.role)).flatMap((m) => m.used);
const hasRole = (s: PartState, ...roles: VocabularyRole[]) =>
  s.vocab.some((m) => roles.includes(m.entry.role));

/**
 * Whether a match names its provider clearly: a clinician's last name or a
 * title with a name ("Dr. Elena"), a practice's whole name, or its first word
 * as a place or after a verb ("at Riverside", "called Riverside"). A first
 * name alone ("Sandra said") only links when something else makes an event.
 */
const namesClearly = (m: NameMatch<QuickEntryProvider>, tokens: readonly Token[], verb: boolean) =>
  m.score >= 0.95 ||
  m.used.some((i) => HONORIFICS.has(tokens[i]!.w)) ||
  (m.score === 0.8 && (verb || m.used.some((i) => ["at", "to", "from"].includes(tokens[i - 1]?.w ?? ""))));

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

/** Count words a dose can be typed in; digits, decimals and fractions are read by `countValue`. */
const COUNT_WORDS = new Map([
  ["½", 0.5],
  ["half", 0.5],
  ["quarter", 0.25],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
]);
const MAX_COUNT = 20;
const COUNT_LINKS = new Set(["of", "a", "an"]);

const countValue = (w: string) => {
  const named = COUNT_WORDS.get(w);
  if (named !== undefined) return named;
  const fraction = /^(\d)\/(\d)$/.exec(w);
  if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : null;
  return /^\d+(?:\.\d+)?$/.test(w) ? Number(w) : null;
};
const isCount = (value: number | null): value is number => value !== null && value > 0 && value <= MAX_COUNT;

/** Units a dose is counted in. A measure ("500 mg", "5 ml") can't take a bare count. */
const COUNTED_UNITS = new Map(
  [
    "tablet",
    "tab",
    "capsule",
    "cap",
    "pill",
    "unit",
    "puff",
    "drop",
    "spray",
    "teaspoon",
    "tablespoon",
    "sachet",
    "dose",
    "inhalation",
  ].flatMap((unit) => [
    [unit, { one: unit, many: `${unit}s` }],
    [`${unit}s`, { one: unit, many: `${unit}s` }],
  ]),
);
for (const w of ["patch", "patches"]) COUNTED_UNITS.set(w, { one: "patch", many: "patches" });
for (const w of ["tsp", "tbsp"]) COUNTED_UNITS.set(w, { one: w, many: w });

/** The usual dose's unit, when it is a count and a unit ("2 tablets", "half a tablet"). */
const usualUnit = (dose: string | null | undefined) => {
  const m = /^(?:\d+(?:\.\d+)?|\d\/\d|½|half|quarter|one|two|three|four|an?)\s*(?:an?\s+)?([a-z]+)$/i.exec(
    dose?.trim() ?? "",
  );
  return m ? COUNTED_UNITS.get(m[1]!.toLowerCase()) : undefined;
};

/** The amount a typed count records, in the usual dose's unit when it has one. */
const countedAmount = (word: string, value: number, dose: string | null | undefined) => {
  const unit = usualUnit(dose);
  if (!unit) return word;
  const article = /^[aeio]/.test(unit.one) ? "an" : "a";
  if (word === "half") return `half ${article} ${unit.one}`;
  if (word === "quarter") return `quarter of ${article} ${unit.one}`;
  return `${word} ${value <= 1 ? unit.one : unit.many}`;
};

/** Words in directions that describe how to take a medication; only another word there can be a brand. */
const DIRECTION_WORDS = new Set(
  (
    "take takes taking give use apply inhale swallow chew dissolve by mouth orally with without before after " +
    "during food foods meal meals water milk juice breakfast lunch dinner supper snack bedtime morning " +
    "afternoon evening night nightly daily weekly monthly once twice times every each hour hours needed " +
    "tablet tablets capsule capsules pill pills dose doses empty stomach full glass day days week weeks " +
    "when while then until left right side"
  ).split(" "),
);

/**
 * The place a medication goes in its directions ("to left knee", "under the
 * tongue"), up to punctuation or a word that starts how or when to take it.
 */
const APPLICATION_SITE =
  /\b(?:to|on|onto|into|in|under|over|around|behind)\b[^,;.\n]*?(?=[,;.\n]|\b(?:once|twice|thrice|daily|nightly|weekly|monthly|hourly|every|times|as|at|before|after|with|without|when|while|until|for|by|then|per)\b|$)/gi;

/**
 * Whether the word at `i` really names this medication, so a number beside it
 * is about the medication: its name, or a brand word in its directions. A
 * symptom, what it is for ("for arthritis"), where it goes ("to knee"), a word
 * of how to take it, or (without a verb) a short partial name ("arm" for Armour) doesn't.
 */
const namesMedication = (
  med: QuickEntryMedication,
  tokens: readonly Token[],
  i: number,
  { verb = false } = {},
) => {
  if (hasSymptomWord(tokens, [i])) return false;
  const score = matchMedication(med, tokens, [i])?.score ?? 0;
  const word = wordsOf(tokens[i]!.w)[0] ?? "";
  if (score === 0.8)
    return (
      !DIRECTION_WORDS.has(word) &&
      wordsOf(
        (med.directions ?? "").replace(/\bfor\b[^,;.]*/gi, " ").replace(APPLICATION_SITE, " "),
      ).includes(word)
    );
  if (score >= 0.85 && word.length < 4 && !wordsOf(med.name).includes(word)) return verb;
  return score > 0;
};

/**
 * The numbers typed next to the word at `u` that continue the medication's
 * name in that direction: the 3 of "omega 3", the 5 of "5 htp". "omega 3
 * times" is a number of times, so that 3 stays out.
 */
const nameNumbers = (
  med: QuickEntryMedication,
  tokens: readonly Token[],
  u: number,
  step: 1 | -1,
  open: (k: number) => boolean,
) => {
  const nameWords = wordsOf(med.name);
  const word = wordsOf(tokens[u]!.w)[0] ?? "";
  const exact = nameWords.indexOf(word);
  const at =
    exact >= 0
      ? exact
      : nameWords.findIndex((n) => n.startsWith(word) || (n.length >= 4 && editDistance(word, n) <= 2));
  const found: number[] = [];
  if (at < 0) return found;
  for (let j = at + step, k = u + step; /^\d/.test(nameWords[j] ?? ""); j += step, k += step) {
    if (!open(k) || tokens[k]!.w !== nameWords[j]) break;
    if (step === 1 && NOT_SEVERITY_AFTER.test(tokens[k + 1]?.w ?? "")) break;
    found.push(k);
  }
  return found;
};

/**
 * What was typed beside a medication's words: a count directly before them
 * ("3 tylenol", "half a tylenol") or after ("tylenol 2", "tylenol x2"), and
 * numbers that are no count: its strength after them ("lisinopril 10") or a
 * number in its name ("omega 3"), returned together as `strength`.
 */
const typedBeside = (
  s: PartState,
  rest: readonly number[],
  m: NameMatch<QuickEntryMedication>,
  { wantCount, verb }: { wantCount: boolean; verb: boolean },
) => {
  const open = (k: number) => rest.includes(k) && !m.used.includes(k) && !s.claimed.has(k);
  const naming = m.used.filter((i) => namesMedication(m.item, s.tokens, i, { verb }));
  const strengths = (m.item.strength?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  let count: { used: number[]; amount: string } | null = null;
  const strength: number[] = [];
  const counted = (k: number, word: string, links: number[]) => {
    const value = countValue(word);
    if (!count && isCount(value))
      count = { used: [k, ...links], amount: countedAmount(word, value, m.item.dose) };
  };
  if (wantCount)
    for (const u of naming) {
      const links: number[] = [];
      let k = u - 1 - nameNumbers(m.item, s.tokens, u, -1, open).length;
      while (links.length < 2 && open(k) && COUNT_LINKS.has(s.tokens[k]!.w)) links.push(k--);
      if (open(k)) counted(k, s.tokens[k]!.w, links);
    }
  for (const u of naming) strength.push(...nameNumbers(m.item, s.tokens, u, -1, open));
  for (const u of naming) {
    const inName = nameNumbers(m.item, s.tokens, u, 1, open);
    strength.push(...inName);
    const k = u + 1 + inName.length;
    if (!open(k) || NOT_SEVERITY_AFTER.test(s.tokens[k + 1]?.w ?? "")) continue;
    const w = s.tokens[k]!.w;
    const times = /^[x×](\d+(?:\.\d+)?)$/.exec(w);
    if (times) {
      if (wantCount) counted(k, times[1]!, []);
    } else if (/^\d/.test(w) && strengths.includes(countValue(w) ?? NaN)) strength.push(k);
    else if (wantCount) counted(k, w, []);
  }
  return { count: count as { used: number[]; amount: string } | null, strength };
};

/**
 * The words of a "no" that opens the part and is about a symptom or trouble,
 * not the dose: "no pain" in "no pain gave tylenol", "no chest pain after
 * metformin given". The phrase's last word decides, so "no pain meds" and "no
 * pain relief" still negate, as does any word that names a medication.
 */
const symptomPhrase = (s: PartState, negation: number, verb: number) => {
  if (negation !== s.free[0] || s.tokens[negation]!.w !== "no") return null;
  const between = s.free.filter((i) => i > negation && i < verb);
  const end = between.findIndex((i) => PHRASE_ENDS.has(s.tokens[i]!.w));
  const head = end < 0 ? between : between.slice(0, end);
  const last = head.at(-1);
  if (last === undefined) return null;
  const lastWord = s.tokens[last]!.w;
  if (/killer|reliever/.test(lastWord)) return null;
  if (!TROUBLE_WORDS.has(lastWord) && !hasSymptomWord(s.tokens, [last])) return null;
  const namesOne = (i: number) =>
    s.context.medications.some(
      (m) => namesMedication(m, s.tokens, i) || (matchMedication(m, s.tokens, [i])?.score ?? 0) >= 0.85,
    );
  return head.some(namesOne) ? null : [negation, ...head];
};

const PRONOUNS = new Set(["her", "his", "him", "them", "their", "the", "a", "an", "my", "she", "he"]);

const doseReadings = (s: PartState, forced: boolean): QuickEntryReading[] => {
  let status: DoseStatus | null = null;
  let negated = false;
  const verbUsed: number[] = [];
  // "no pain gave tylenol": words about something else, kept for the note and never read as a name.
  let otherPhrase: number[] = [];
  const nameWords = new Set(
    matchMedications(
      s.context,
      s.tokens,
      s.free.filter((i) => !isNegating(s.tokens[i]!.w) && !(s.tokens[i]!.w in DOSE_VERBS)),
    ).flatMap((m) => m.used),
  );
  for (const i of s.free) {
    const w = s.tokens[i]!.w;
    if (
      REFUSING.has(withoutApostrophe(w)) ||
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
      const negation = negationBefore(s.tokens, s.free, i, nameWords);
      otherPhrase =
        (negation !== undefined && DOSE_VERBS[w] === "given" && symptomPhrase(s, negation, i)) || [];
      if (negation === undefined || otherPhrase.length) {
        status = DOSE_VERBS[w]!;
        verbUsed.push(i);
      } else {
        // "didn't skip" is too unclear to log: the part stays a note.
        if (DOSE_VERBS[w] !== "given") return [];
        status = "skipped";
        negated = true;
        verbUsed.push(...negationWords(s.tokens, s.free, negation, i));
      }
      break;
    }
  }
  // "gave tylenol and not metoprolol": the negating word opens a part with no verb.
  const opener = s.free[0];
  const carriedNegation = !status && opener !== undefined && isNegating(s.tokens[opener]!.w);
  if (carriedNegation) verbUsed.push(opener);
  const rest = s.free.filter((i) => !verbUsed.includes(i));
  const amountUsed = findAmount(s.tokens, rest);
  const nameIdx = rest.filter(
    (i) => !amountUsed.includes(i) && !DOSE_FILLER.has(s.tokens[i]!.w) && !otherPhrase.includes(i),
  );
  const matches = matchMedications(s.context, s.tokens, nameIdx);
  if (!matches.length) return [];
  const typed = matches.map((m) =>
    typedBeside(s, rest, m, { wantCount: !amountUsed.length, verb: !!status || forced }),
  );
  const typedUsed = (rank: number) => [...(typed[rank]!.count?.used ?? []), ...typed[rank]!.strength];
  // A count or strength beside a brand word in the directions names the medication; a carried negation doesn't.
  const sureName =
    matches[0]!.score >= 0.85 || (!carriedNegation && (!!typed[0]!.count || typed[0]!.strength.length > 0));
  // Without a verb of its own, only a medication's name counts (not its notes).
  if (!status && !forced && !sureName) return [];
  // A line that is only a medication's name (and maybe an amount) is a dose too.
  const nameOnly = sureName && nameIdx.every((i) => matches[0]!.used.includes(i) || typedUsed(0).includes(i));
  // Only a carried "given" can be negated, and only over a bare name ("no lisinopril side effects" is a note).
  if (carriedNegation && (!nameOnly || (s.previousDose ?? (forced ? "given" : null)) !== "given")) return [];
  const inherited = carriedNegation ? "skipped" : (status ?? s.previousDose);
  if (!inherited && !forced && !nameOnly) return [];
  for (const i of [...verbUsed, ...amountUsed, ...matches[0]!.used, ...typedUsed(0)]) s.claimed.add(i);
  const at = s.time.past.at;
  const amount = amountUsed.length ? rawOf(s.tokens, amountUsed) : null;
  return matches.map((m, rank) => {
    const noteIdx = stripLeading(
      s.tokens,
      rest.filter((i) => !amountUsed.includes(i) && !m.used.includes(i) && !typedUsed(rank).includes(i)),
      PRONOUNS,
    );
    const note = meaningful(s.tokens, noteIdx, DOSE_FILLER) ? truncate(rawOf(s.tokens, noteIdx), 500) : null;
    const base = negated
      ? 0.85
      : carriedNegation
        ? 0.75
        : status
          ? 0.9
          : s.previousDose
            ? 0.8
            : forced
              ? 0.9
              : 0.6;
    return reading(
      "dose",
      {
        type: "logDose",
        medicationId: m.item.id,
        status: inherited ?? "given",
        amount: amount ?? typed[rank]!.count?.amount ?? m.item.dose ?? null,
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
  // Given all is the worst wrong reading: any negating word in the part rules it out.
  if (s.tokens.some((t) => isNegating(t.w))) return [];
  let status: DoseStatus | null = null;
  let verb = -1;
  for (const i of s.free) {
    const w = s.tokens[i]!.w;
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

/** Whether the words are only a medication's: "tylenol" is never a symptom's name. */
const onlyMedicationWords = (s: PartState, idx: readonly number[]) => {
  const words = idx.filter((i) => !LEADING_SYMPTOM_FILLER.has(s.tokens[i]!.w) && !isNegating(s.tokens[i]!.w));
  return (
    words.length > 0 && words.every((i) => s.context.medications.some((m) => namesMedication(m, s.tokens, i)))
  );
};

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

  // An incident ("fell in the bathroom"): the symptom by its canonical name,
  // no severity, the words after it as the note. A visit to a named provider
  // ("saw Dr. Lee after the fall") is about the visit first.
  const incident = s.vocab.find((m) => m.entry.role === "symptomIncident");
  if (incident) {
    const last = incident.used.at(-1)!;
    const afterIdx = stripLeading(
      s.tokens,
      free.filter((i) => i > last),
      new Set(["-", ":", "="]),
    );
    const note = meaningful(s.tokens, afterIdx)
      ? truncate(rawOf(s.tokens, afterIdx), TIMELINE_LIMITS.body)
      : null;
    const visit = s.naming.length > 0 && hasRole(s, "visitVerb", "appointmentWord");
    return [make(incident.entry.name!, null, note, forced ? 1 : visit ? 0.7 : 0.88)];
  }

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
      // "not 2 tylenol": a negating word is no symptom's name either.
      if (!forced && (before.every((k) => isNegating(s.tokens[k]!.w)) || onlyMedicationWords(s, before)))
        return [];
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
      if (!forced && onlyMedicationWords(s, nameIdx)) return [];
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

/** Words that never start an event's title. */
const TITLE_LEADING = new Set([...FILLER, "see", "seeing", "w/", "w", "about", "re"]);

/**
 * An event's time, read `direction` when ambiguous: a day without a time of
 * day is all day; no time phrase at all is null (the caller decides).
 */
const eventTime = (s: PartState, direction: TimeDirection): ResolvedTime | null => {
  const spec = s.time.spec;
  if (!spec) return null;
  const resolved = direction === "past" ? s.time.past : s.time.future;
  const dayOnly = !("relativeMinutes" in spec) && !!spec.day && !spec.clock && !spec.period;
  if (dayOnly && !resolved.allDay) {
    const tz = s.context.timeZone;
    return { at: wallTime(localDate(resolved.at, tz), 0, 0, tz), allDay: true };
  }
  return resolved;
};

/** All day today, in the recipient's zone. */
const allDayToday = (s: PartState): ResolvedTime => ({
  at: wallTime(localDate(s.context.now, s.context.timeZone), 0, 0, s.context.timeZone),
  allDay: true,
});

/**
 * An event: an appointment word ("appt dr lee tue 2pm"), a provider named
 * clearly ("Dr. Elena Alvarez on the 25th", "saw Dr. Lee today"), or a time
 * ahead ("dinner tomorrow", only an alternative to the todo such a line
 * makes). Its time reads ahead, or back after a visit
 * verb; a provider's event with no time is all day today. Its title is the
 * words left once the time, the provider, the verb and filler are out, else
 * the provider's name; its place is "at <place>" (a provider's address when
 * that names one), else the first provider's address. With a contact verb or
 * a note incident it's only an alternative to the note.
 */
const eventReadings = (s: PartState, forced: boolean): QuickEntryReading[] => {
  const keywordIdx = roleIdx(s, "appointmentWord");
  const verbIdx = roleIdx(s, "visitVerb", "contactVerb");
  const keyword = keywordIdx.length > 0;
  const visit = hasRole(s, "visitVerb");
  const naming = s.naming.length > 0;
  const ahead = !!s.time.spec && saysFuture(s.time.spec);
  if (!keyword && !ahead && !naming && !forced) return [];

  let rest = s.free.filter((i) => !keywordIdx.includes(i) && !verbIdx.includes(i));

  // The place: "at Riverside" (a time after "at" was taken already).
  const placeIdx: number[] = [];
  const atPos = rest.findIndex((i) => s.tokens[i]!.w === "at");
  if (atPos >= 0) {
    for (
      let k = atPos + 1;
      k < rest.length && !["with", "for", "to", "about"].includes(s.tokens[rest[k]!]!.w);
      k++
    )
      placeIdx.push(rest[k]!);
    if (placeIdx.length) rest = rest.filter((i) => i !== rest[atPos] && !placeIdx.includes(i));
  }
  const providers = s.providers;
  const providerUsed = new Set(providers.flatMap((p) => p.used));
  const placeProvider = providers.find((p) => p.used.some((i) => placeIdx.includes(i)));
  const placeText = placeIdx.length ? rawOf(s.tokens, placeIdx) : null;
  const address = (p: NameMatch<QuickEntryProvider> | undefined) => p?.item.address?.trim() || null;
  const place = placeProvider
    ? address(placeProvider) || placeText
    : (placeText ?? address(providers.find((p) => address(p))));

  const titleIdx = stripLeading(
    s.tokens,
    rest.filter((i) => !providerUsed.has(i)),
    TITLE_LEADING,
  ).filter((i, k, all) => !(k === all.length - 1 && ["with", "w/", "for", "to"].includes(s.tokens[i]!.w)));
  const titleWords = meaningful(s.tokens, titleIdx) ? rawOf(s.tokens, titleIdx) : "";
  const named = (s.naming[0] ?? providers[0])?.item.name;
  const title = keyword
    ? titleWords
      ? `${capitalize(titleWords)} appointment`
      : named
        ? `Appointment with ${named}`
        : "Appointment"
    : capitalize(titleWords || named || s.text);

  const warnings: QuickEntryWarning[] = [];
  let when = eventTime(s, visit ? "past" : "future");
  if (!when) {
    if (providers.length) when = allDayToday(s);
    else {
      when = s.time.past;
      if (keyword)
        warnings.push({
          message: "No time given, so it's set to now. Edit it to choose when.",
          blocking: false,
        });
    }
  }
  const noteFirst = hasRole(s, "contactVerb", "noteIncident");
  const confidence = forced
    ? 1
    : keyword
      ? 0.9
      : naming
        ? noteFirst
          ? 0.5
          : visit
            ? 0.85
            : 0.8
        : ahead
          ? 0.3 // below the todo a note line ahead becomes: plans without a provider are todos
          : 0.5;
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TRAILING_PUNCTUATION = /[)"'”’\].,!?:;]+$/;

/**
 * The part's text with each clearly named provider's words ("dr lee") as
 * "@<their name>" ("@Dr. Sandra Lee"), where the note's mention of them goes.
 * Words that aren't one run in the text are left as typed; the mention then
 * goes at the end (`noteDocFromText`).
 */
const mentionedText = (s: PartState) => {
  let text = s.text;
  for (const m of s.naming) {
    const used = [...m.used].sort((a, b) => a - b);
    if (used.some((i, k) => k > 0 && i !== used[k - 1]! + 1)) continue;
    const raws = used.map((i) => s.tokens[i]!.raw);
    const trailing = TRAILING_PUNCTUATION.exec(raws.at(-1)!)?.[0] ?? "";
    raws[raws.length - 1] = raws.at(-1)!.slice(0, raws.at(-1)!.length - trailing.length);
    const pattern = new RegExp(
      `(^|[\\s("'“‘[])${raws.map(escapeRegExp).join("\\s+")}(?![\\p{L}\\p{N}])`,
      "u",
    );
    text = text.replace(pattern, (_, before: string) => `${before}@${m.item.name}`);
  }
  return text;
};

/**
 * Whether the part says a time ahead for a note: a phrase that points ahead
 * on its own ("tomorrow", "in 2 hours", "next friday"), any time beside an
 * appointment word that isn't a visit ("appt friday 3pm"), or one that, read
 * back as a note's is, is still to come today ("tonight", "this evening").
 * A note can't be ahead, so such a line is a todo.
 */
const noteAhead = (s: PartState) => {
  if (!s.time.spec) return false;
  const forward = saysFuture(s.time.spec) || (hasRole(s, "appointmentWord") && !hasRole(s, "visitVerb"));
  const at = forward ? s.time.future.at : s.time.usual.at;
  return at.getTime() > s.context.now.getTime() + DEVICE_FUTURE_SKEW_MS;
};

/**
 * A note: what happened, at the part's time read back (a bare weekday or
 * day of the month is the last one). A time still ahead blocks it. With
 * `now`, it's dated now whatever the line says (the note a todo line offers).
 */
const noteReading = (s: PartState, confidence: number, { now = false } = {}): QuickEntryReading => {
  const at = now ? s.context.now : s.time.past.at;
  // The providers it names clearly are mentioned in it, and linked.
  const providerIds = [...new Set(s.naming.map((m) => m.item.id))];
  return reading(
    "note",
    {
      type: "addNote",
      title: null,
      text: truncate(providerIds.length ? mentionedText(s) : s.text, TIMELINE_LIMITS.body),
      occurredAt: at.toISOString(),
      providerIds,
    },
    confidence,
    now ? [] : futureWarning(at, s.context),
  );
};

/** An event from any text ("Save as event instead"): the text is its title, its time read ahead. */
const eventFromText = (s: PartState, confidence: number): QuickEntryReading => {
  const when = eventTime(s, "future") ?? s.time.past;
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

/** Words left at the end of a todo's title by its due or assignee ("call pharmacy by friday"). */
const TODO_TRAILING = new Set([
  "by",
  "on",
  "at",
  "before",
  "due",
  "for",
  "until",
  "till",
  "to",
  "-",
  ":",
  "@",
]);

/**
 * The member a todo names after "for" or "@", starting at word `k`: the
 * longest match of a member's full name, else their first name. Two members
 * sharing the words is ambiguous (nobody is assigned).
 */
/** A token as one folded word, or "" when it's more ("sam's" isn't Sam). */
const oneWord = (w: string) => {
  const words = wordsOf(w);
  return words.length === 1 ? words[0]! : "";
};

const matchMember = (s: PartState, k: number, first: string) => {
  const members = s.context.members ?? [];
  let bestLength = 0;
  let found: QuickEntryMember[] = [];
  for (const member of members) {
    const words = wordsOf(member.name);
    if (!words.length) continue;
    const said = (n: number) => (n === 0 ? first : oneWord(s.tokens[k + n]?.w ?? ""));
    let length = 0;
    while (length < words.length && s.free.includes(k + length) && said(length) === words[length]) length++;
    // Only the whole name, or the first name on its own.
    if (length !== words.length && length !== 1) length = length > 1 ? 1 : 0;
    if (!length) continue;
    if (length > bestLength) {
      bestLength = length;
      found = [member];
    } else if (length === bestLength) found.push(member);
  }
  return bestLength ? { members: found, used: Array.from({ length: bestLength }, (_, n) => k + n) } : null;
};

/**
 * A todo (when the part asks for one, or a note line says a time ahead): its
 * title is what's left once the due phrase and the assignee are taken out.
 * "for Sam" or "@Sam" names a member (a name that matches nobody stays in the
 * title; a typed-in assignee is chosen in the sheet). A time phrase is the
 * due day and, when it says one, the time, read ahead in the recipient's zone.
 */
const todoReadings = (s: PartState, forced: boolean): QuickEntryReading[] =>
  forced ? [todoReading(s, 1)] : [];

const todoReading = (s: PartState, confidence: number): QuickEntryReading => {
  const warnings: QuickEntryWarning[] = [];
  let assigneeId: string | null = null;
  let assigneeUsed: number[] = [];
  for (const i of s.free) {
    const w = s.tokens[i]!.w;
    const at = w.startsWith("@") && w.length > 1;
    if (!at && w !== "for") continue;
    const match = at
      ? matchMember(s, i, oneWord(w.slice(1)))
      : s.free.includes(i + 1)
        ? matchMember(s, i + 1, oneWord(s.tokens[i + 1]!.w))
        : null;
    if (!match) continue;
    assigneeUsed = at ? match.used : [i, ...match.used];
    if (match.members.length === 1) assigneeId = match.members[0]!.id;
    else {
      const said = rawOf(s.tokens, match.used).replace(/^@/, "");
      warnings.push({
        message: `More than one member is called ${said}, so nobody is assigned. Edit it to choose.`,
        blocking: false,
      });
    }
    break;
  }

  let titleIdx = s.free.filter((i) => !assigneeUsed.includes(i));
  while (titleIdx.length && TODO_TRAILING.has(s.tokens[titleIdx.at(-1)!]!.w))
    titleIdx = titleIdx.slice(0, -1);
  titleIdx = stripLeading(s.tokens, titleIdx, new Set(["due", "-", ":"]));
  const title = truncate(capitalize(rawOf(s.tokens, titleIdx)), TODO_LIMITS.title);
  if (!title) warnings.push({ message: "Say what the todo is.", blocking: true });

  let dueOn: string | null = null;
  let dueTime: string | null = null;
  if (s.time.spec) {
    const { at, allDay } = s.time.future;
    dueOn = localDate(at, s.context.timeZone);
    if (!allDay) dueTime = localTime(at, s.context.timeZone).slice(0, 5);
    const passed = allDay
      ? dueOn < localDate(s.context.now, s.context.timeZone)
      : at.getTime() < s.context.now.getTime();
    if (passed) warnings.push({ message: "That's already past, so it's overdue.", blocking: false });
  }

  return reading(
    "todo",
    {
      type: "addTodo",
      title,
      assigneeId,
      dueOn,
      dueTime,
      providerId: null,
      medicationId: null,
      eventId: null,
    },
    confidence,
    warnings,
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
  todo: todoReadings,
};

/** A proper fraction with a dose-like denominator: "3/8", "1/6", not "4/3" or "3/7". */
const DOSE_FRACTION = /^([1-9])\/([234568])$/;

const isDoseFraction = (tokens: readonly Token[], i: number) => {
  const fraction = DOSE_FRACTION.exec(tokens[i]!.w);
  return !!fraction && Number(fraction[1]) < Number(fraction[2]) && tokens[i - 1]?.w !== "on";
};

/**
 * Whether the word at `i` is a fraction typed directly before a medication's
 * words ("gave 3/8 tylenol", "3/8 of a tylenol"), so its amount and not a date.
 * "on" still makes it a date ("on 3/8 tylenol"). Without a dose verb the line
 * must be only the fraction and the name, so "appt 3/8 tylenol review" and
 * "dr lee 3/8 tylenol refill" keep their date.
 */
const isFractionAmount = (
  tokens: readonly Token[],
  medications: readonly QuickEntryMedication[],
  i: number,
  forcedDose: boolean,
) => {
  if (!isDoseFraction(tokens, i)) return false;
  let first = i + 1;
  while (first <= i + 2 && COUNT_LINKS.has(tokens[first]?.w ?? "")) first++;
  let named = first;
  while (/^\d/.test(tokens[named]?.w ?? "")) named++;
  if (named >= tokens.length) return false;
  const verb = forcedDose || tokens.some((t) => t.w in DOSE_VERBS);
  return medications.some(
    (m) =>
      namesMedication(m, tokens, named, { verb }) &&
      nameNumbers(m, tokens, named, -1, (k) => k >= first).length === named - first &&
      (verb || (i === 0 && tokens.slice(named).every((_, k) => namesMedication(m, tokens, named + k)))),
  );
};

/**
 * Whether the word at `i` is a fraction typed directly after a medication's
 * name on a line that gives it ("gave tylenol 3/8"), so its amount and not a
 * date. A dose not given has no amount, so there it stays a date ("skipped
 * tylenol 3/8"), as it does after a count ("gave 2 tylenol 3/8") or a time
 * unit ("gave tylenol 3/8 days"). Without a verb the line must be only the
 * name and the fraction, so "refill tylenol 3/8" keeps its date.
 */
const isFractionAfterName = (
  tokens: readonly Token[],
  medications: readonly QuickEntryMedication[],
  i: number,
  forcedDose: boolean,
  previousDose: DoseStatus | null,
) => {
  if (i === 0 || !isDoseFraction(tokens, i)) return false;
  const next = tokens[i + 1]?.w ?? "";
  if (NOT_SEVERITY_AFTER.test(next) && !AMOUNT_UNITS.test(next)) return false;
  const verb = tokens.findIndex((t) => t.w in DOSE_VERBS);
  const status = verb < 0 ? previousDose : DOSE_VERBS[tokens[verb]!.w]!;
  if ((status ?? "given") !== "given") return false;
  const all = tokens.map((_, k) => k);
  if (verb >= 0 && negationBefore(tokens, all, verb, new Set()) !== undefined) return false;
  let named = i - 1;
  while (named > 0 && /^\d/.test(tokens[named]!.w)) named--;
  return medications.some((m) => {
    const hasVerb = verb >= 0 || forcedDose;
    if (!namesMedication(m, tokens, named, { verb: hasVerb })) return false;
    if (nameNumbers(m, tokens, named, 1, (k) => k < i).length !== i - 1 - named) return false;
    let start = named;
    while (start > 0 && namesMedication(m, tokens, start - 1, { verb: hasVerb })) start--;
    start -= nameNumbers(m, tokens, start, -1, (k) => k >= 0).length;
    let before = start - 1;
    while (before >= 0 && COUNT_LINKS.has(tokens[before]!.w)) before--;
    if (before >= 0 && isCount(countValue(tokens[before]!.w))) return false;
    return hasVerb || (start === 0 && i === tokens.length - 1);
  });
};

/**
 * Vital keywords whose following slash number is a reading, even a mistyped
 * one. Not bare "sat" (Saturday), words for what happened on a day ("fever
 * 12/8", "weighed 12/8"), or the vitals logged as events (bowels, urine, sleep).
 */
const MEASURED_VITAL_WORDS = VITAL_WORDS.filter(
  ([words, type]) =>
    !["bowelMovement", "urineOutput", "sleep"].includes(type) &&
    !["sat", "fever", "weighed", "weighs"].includes(words.join(" ")),
).map(([words]) => words);

/** Symptoms people score: a slash number after one is a score when it's at most n/10. */
const SCALE_WORDS = new Set([
  "pain",
  "ache",
  "soreness",
  "headache",
  "migraine",
  "nausea",
  "dizziness",
  "fatigue",
  "anxiety",
  "itching",
  "swelling",
  "cramps",
]);

const MEASUREMENT_LINKS = new Set([":", "=", "-", "is", "was", "of", "level"]);

/**
 * Whether the slash number at `i` follows a measurement word ("bp 12/8", "pain
 * is 5/5"), so it's a value and not a date. A year, "on" or an appointment word
 * in the line keeps the date ("bp 12/8/26", "bp on 12/8", "appt for bp 12/8").
 */
const isMeasurementValue = (tokens: readonly Token[], i: number) => {
  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(tokens[i]!.w);
  if (!slash) return false;
  let last = i - 1;
  while (last >= 0 && MEASUREMENT_LINKS.has(tokens[last]!.w)) last--;
  if (last < 0) return false;
  const measured = SCALE_WORDS.has(tokens[last]!.w)
    ? Number(slash[1]) <= Number(slash[2]) && Number(slash[2]) <= 10
    : MEASURED_VITAL_WORDS.some((words) =>
        words.every((word, k) => tokens[last - words.length + 1 + k]?.w === word),
      );
  if (!measured) return false;
  return !findVocabulary(
    tokens.map((t) => vocabularyWord(t.w)),
    () => true,
  ).some((m) => m.entry.role === "appointmentWord");
};

const parsePart = (
  text: string,
  context: QuickEntryContext,
  previousDose: DoseStatus | null,
): QuickEntryPart => {
  const todoPrefix = TODO_PREFIX.exec(text);
  const prefix = todoPrefix ?? /^\s*([nesvd]):\s*/i.exec(text);
  const forced = todoPrefix ? "todo" : prefix ? PREFIXES[prefix[1]!.toLowerCase()]! : null;
  const body = prefix ? text.slice(prefix[0].length).trim() : text.trim();
  const tokens = tokenize(body);
  // A fraction that is a dose's amount is hidden from the date finder; a line forced to another kind keeps it.
  const readsAmounts = forced === null || forced === "dose";
  // So is a measurement's value, unless the line was asked to be something with a day.
  const readsValues = forced !== "event" && forced !== "todo";
  const time = findTime(
    tokens.map((t, i) =>
      (readsAmounts &&
        (isFractionAmount(tokens, context.medications, i, forced === "dose") ||
          isFractionAfterName(tokens, context.medications, i, forced === "dose", previousDose))) ||
      (readsValues && isMeasurementValue(tokens, i))
        ? ""
        : t.w,
    ),
  );
  const free = tokens.map((_, i) => i).filter((i) => !time?.used.has(i));
  const vocab = findVocabulary(
    tokens.map((t) => vocabularyWord(t.w)),
    (i) => free.includes(i),
  );
  const providers = matchProviders(context, tokens, free);
  const verb = vocab.some((m) => m.entry.role !== "appointmentWord" && m.entry.role !== "symptomIncident");
  const s: PartState = {
    text: body,
    tokens,
    time: timeOf(time?.spec ?? null, context),
    free,
    context,
    previousDose,
    claimed: new Set(),
    vocab,
    providers,
    naming: providers.filter((m) => namesClearly(m, tokens, verb)),
  };
  // A note incident ("911", "the ER"), or a contact verb with a provider
  // ("called Dr. Lee"), makes a note first.
  const noteFirst = hasRole(s, "noteIncident") || (hasRole(s, "contactVerb") && s.naming.length > 0);

  // A note can't be ahead: a line that says a time ahead offers a todo where
  // its note would be, and the note (dated now, the whole line) after it.
  const ahead = noteAhead(s);

  let readings: QuickEntryReading[];
  if (forced === "note")
    // Asked for a note: it stays one (blocked when ahead), with the todo one tap away.
    readings = [noteReading(s, 1), ...(ahead ? [todoReading(s, 0.3)] : []), eventFromText(s, 0.2)];
  else if (forced) {
    readings = DETECTORS[forced](s, true);
    if (!readings.length && forced === "event") readings = [eventFromText(s, 1)];
    const confidence = readings.length ? 0.4 : 0.5;
    const fallback =
      forced === "todo" || ahead ? noteReading(s, confidence, { now: true }) : noteReading(s, confidence);
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
      ...(ahead
        ? [todoReading(s, noteFirst ? 0.8 : 0.4), noteReading(s, noteFirst ? 0.45 : 0.35, { now: true })]
        : [noteReading(s, noteFirst ? 0.8 : 0.4)]),
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
 * one note or event, whatever it says. A todo keeps its "and" ("todo: pick
 * up milk and bread") up to the next comma, semicolon or line.
 */
const SOFT_SPLIT = /\s*(?:\band\b|\bthen\b|&|\+)\s*/i;
const SOFT_SPLIT_START = /^\s*(?:\band\b|\bthen\b|&|\+)\s*/i;
const TODO_AFTER_SOFT = /\s*(?:\band\b|\bthen\b|&|\+)\s*(?=(?:t|task|todo|to-do|to do)\s*:|todo\b)/i;

export const splitQuickEntry = (text: string): string[] => {
  const line = text.trim();
  if (!line) return [];
  if (/^[ne]:/i.test(line)) return [line];
  return line
    .split(/\s*(?:;|\n|(?<!\d),|,(?!\d))\s*/)
    .flatMap((piece) => {
      // From a todo's prefix on, the piece is the todo.
      const todo = TODO_PREFIX.test(piece) ? 0 : piece.search(TODO_AFTER_SOFT);
      const head = todo < 0 ? piece : piece.slice(0, todo);
      const tail = todo < 0 ? [] : [piece.slice(todo).replace(SOFT_SPLIT_START, "")];
      return [...(head ? head.split(SOFT_SPLIT) : []), ...tail];
    })
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
        actions: [{ type: "addNote", title: null, text, occurredAt: av.occurredAt, providerIds: [] }],
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
