import type { MedicationForm } from "../medications/medication";
import type { ProviderType } from "../providers/provider";

import { MEDICATION_LIMITS } from "../medications/medication";
import { PROVIDER_LIMITS } from "../providers/provider";
import { foldSearchText } from "../search/search";
import { openingNewItem, vocabularyWord } from "./quickEntryVocabulary";

// Quick entry's new medications and providers: a line opening with "new
// med", "started" (with a strength or form), "add provider" and the like
// (the vocabulary's `newMedication` and `newProvider` rows) is read into what
// the Add sheet starts from. Nothing here is an assistant action: the card's
// Save opens the sheet filled in, and the sheet saves as it always does.
// Pure and client-safe. English only.

/** What the Add medication sheet starts from. */
export type NewMedicationDraft = {
  kind: "medication";
  name: string;
  strength: string | null;
  form: MedicationForm | null;
  directions: string | null;
};

/** What the Add provider sheet starts from. */
export type NewProviderDraft = {
  kind: "provider";
  type: ProviderType;
  name: string;
  specialty: string | null;
  /** A practice or pharmacy the group has, named after "at" ("at Riverside"). */
  practiceId: string | null;
  phone: string | null;
  address: string | null;
};

export type NewItemDraft = NewMedicationDraft | NewProviderDraft;

/** A practice or pharmacy a new clinician can be "at". */
type Practice = { id: string; name: string; type: ProviderType };

type Word = { raw: string; lower: string; w: string };

const wordsIn = (text: string): Word[] =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({
      raw,
      lower: raw
        .toLowerCase()
        .replace(/^[("'“‘[]+/, "")
        .replace(/[)"'”’\].,!?:;]+$/, ""),
      w: vocabularyWord(raw),
    }));

const LEADING = new Set(["a", "an", "the"]);

const joinRaw = (words: readonly Word[]) =>
  words
    .map((w) => w.raw)
    .join(" ")
    .replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, "");

const capitalize = (text: string) => (text ? text[0]!.toUpperCase() + text.slice(1) : text);
/** "dr kim" → "Dr Kim"; a name typed with capitals stays as typed. */
const titleCase = (text: string) =>
  text === text.toLowerCase()
    ? text.replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
    : text;

const clip = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max).trimEnd());
const orNull = (text: string, max: number) => (text ? clip(text, max) : null);

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

const UNITS = "mg|mcg|µg|ug|g|gm|ml|mls|units?|iu|meq|%";
/** A unit, maybe per volume: "mg", "units/ml", "mg/5ml". */
const UNIT = `(?:${UNITS})(?:/\\d*(?:ml|l))?`;
const STRENGTH_UNIT = new RegExp(`^${UNIT}$`);
const JOINED_STRENGTH = new RegExp(`^(\\d+(?:\\.\\d+)?)(${UNIT})$`);
const NUMBER = /^\d+(?:\.\d+)?$/;

const UNIT_TEXT: Record<string, string> = {
  ml: "mL",
  mls: "mL",
  l: "L",
  ug: "mcg",
  µg: "mcg",
  gm: "g",
  unit: "units",
  iu: "IU",
  meq: "mEq",
};
/** "10" "mg" → "10 mg"; "100" "units/ml" → "100 units/mL". */
const strengthText = (n: string, unit: string) => {
  const text = unit
    .split("/")
    .map((u) => u.replace(/^(\d*)([a-zµ]+)$/, (_, k: string, b: string) => k + (UNIT_TEXT[b] ?? b)))
    .join("/");
  return text === "%" ? `${n}%` : `${n} ${text}`;
};

/** Words that say a medication's form, as the form's select has them. */
const FORM_WORDS: Record<string, MedicationForm> = {
  tablet: "tablet",
  tablets: "tablet",
  tab: "tablet",
  tabs: "tablet",
  pill: "tablet",
  pills: "tablet",
  capsule: "capsule",
  capsules: "capsule",
  cap: "capsule",
  caps: "capsule",
  liquid: "liquid",
  solution: "liquid",
  syrup: "liquid",
  suspension: "liquid",
  injection: "injection",
  injections: "injection",
  injectable: "injection",
  shot: "injection",
  shots: "injection",
  patch: "patch",
  patches: "patch",
  inhaler: "inhaler",
  inhalers: "inhaler",
  drops: "drops",
  cream: "cream",
  ointment: "cream",
  gel: "cream",
};

/** "lisinopril 10 mg tablet once daily": its name, strength, form, and the rest as directions. */
const readMedication = (words: readonly Word[]): NewMedicationDraft => {
  const taken = new Set<number>();
  let strength: string | null = null;
  let form: MedicationForm | null = null;
  words.forEach((word, i) => {
    if (taken.has(i)) return;
    const joined = JOINED_STRENGTH.exec(word.lower);
    if (!strength && joined) {
      strength = strengthText(joined[1]!, joined[2]!);
      taken.add(i);
    } else if (!strength && NUMBER.test(word.lower) && STRENGTH_UNIT.test(words[i + 1]?.lower ?? "")) {
      strength = strengthText(word.lower, words[i + 1]!.lower);
      taken.add(i).add(i + 1);
    } else if (!form && FORM_WORDS[word.lower] && i > 0) {
      form = FORM_WORDS[word.lower]!;
      taken.add(i);
    }
  });
  const first = Math.min(words.length, ...taken);
  const name = joinRaw(words.slice(0, first).filter((w, i) => i > 0 || !LEADING.has(w.w)));
  const rest = joinRaw(words.filter((_, i) => i > first && !taken.has(i)));
  return {
    kind: "medication",
    name: clip(capitalize(name), MEDICATION_LIMITS.name),
    strength,
    form,
    directions: orNull(rest, MEDICATION_LIMITS.directions),
  };
};

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/** Specialties typed after a name ("Dr Kim cardiology"), one or two words. */
const SPECIALTIES = [
  "allergy",
  "allergist",
  "audiology",
  "audiologist",
  "cardiology",
  "cardiologist",
  "dentist",
  "dental",
  "dermatology",
  "dermatologist",
  "endocrinology",
  "endocrinologist",
  "ent",
  "family medicine",
  "family practice",
  "gastroenterology",
  "gastroenterologist",
  "geriatrics",
  "geriatrician",
  "gi",
  "gynecology",
  "gynecologist",
  "hematology",
  "hematologist",
  "home health",
  "hospice",
  "internal medicine",
  "nephrology",
  "nephrologist",
  "neurology",
  "neurologist",
  "nutritionist",
  "dietitian",
  "obgyn",
  "occupational therapy",
  "occupational therapist",
  "oncology",
  "oncologist",
  "ophthalmology",
  "ophthalmologist",
  "optometrist",
  "orthopedics",
  "orthopedic",
  "pediatrics",
  "pediatrician",
  "physical therapy",
  "physical therapist",
  "podiatry",
  "podiatrist",
  "primary care",
  "psychiatry",
  "psychiatrist",
  "psychology",
  "psychologist",
  "pulmonology",
  "pulmonologist",
  "radiology",
  "rheumatology",
  "rheumatologist",
  "speech therapy",
  "speech therapist",
  "surgeon",
  "surgery",
  "therapist",
  "urology",
  "urologist",
].map((phrase) => phrase.split(" "));

/** Words in a name that make it a place, not a person. */
const PRACTICE_WORDS = new Set([
  "clinic",
  "hospital",
  "center",
  "centre",
  "practice",
  "medical",
  "dialysis",
  "lab",
  "labs",
  "imaging",
  "associates",
]);
const PHARMACY_WORDS = new Set(["pharmacy", "drugstore"]);

const PHONE_PART = /^\+?[\d(][\d().+-]*$/;
const digits = (text: string) => text.replace(/\D/g, "").length;
/** A street number: "12", "400a" (not a phone's digits). */
const STREET_NUMBER = /^\d{1,6}[a-z]?$/;

const foldWords = (text: string) => foldSearchText(text).match(/[\p{L}\p{N}]+/gu) ?? [];

/** The group's practice or pharmacy a place names: its whole name, or its name's start ("Riverside"). */
const practiceNamed = (place: readonly Word[], practices: readonly Practice[]) => {
  const said = place.map((w) => w.w).filter(Boolean);
  if (!said.length) return null;
  return (
    practices.find((p) => {
      const name = foldWords(p.name);
      return said.length <= name.length && said.every((w, k) => name[k] === w) && said.join("").length >= 4;
    }) ?? null
  );
};

/** "Dr Kim cardiology 555-0100 at 12 Main St": name, specialty, phone, and a practice or address. */
const readProvider = (words: readonly Word[], practices: readonly Practice[]): NewProviderDraft => {
  const taken = new Set<number>();
  // The phone: a run of digit groups with 7 or more digits.
  let phone: string | null = null;
  for (let i = 0; i < words.length && !phone; i++) {
    let j = i;
    // A comma ends it ("555-0100, 12 Main St").
    while (j < words.length && PHONE_PART.test(words[j]!.lower) && /\d/.test(words[j]!.lower))
      if (/,$/.test(words[j++]!.raw)) break;
    const run = words.slice(i, j);
    if (run.length && digits(run.map((w) => w.lower).join("")) >= 7) {
      phone = clip(joinRaw(run), PROVIDER_LIMITS.phoneNumber);
      for (let k = i; k < j; k++) taken.add(k);
    }
  }
  // A place: after "at", or from a street number on.
  const at = words.findIndex((w, i) => !taken.has(i) && w.w === "at");
  const street = words.findIndex(
    (w, i) => i > 0 && !taken.has(i) && STREET_NUMBER.test(w.lower) && /\p{L}/u.test(words[i + 1]?.w ?? ""),
  );
  const placeFrom = at >= 0 ? at : street;
  const place: Word[] = [];
  if (placeFrom >= 0)
    words.forEach((w, i) => {
      if (i < placeFrom || taken.has(i)) return;
      taken.add(i);
      if (i !== at) place.push(w);
    });
  // A specialty phrase among the words left.
  let specialty: string | null = null;
  for (let i = 0; i < words.length && !specialty; i++) {
    const found = SPECIALTIES.find((s) => s.every((w, k) => !taken.has(i + k) && words[i + k]?.w === w));
    if (found && i > 0) {
      specialty = capitalize(joinRaw(words.slice(i, i + found.length)));
      found.forEach((_, k) => taken.add(i + k));
    }
  }
  // The name: the words up to the first field, or to a comma ("Dr Kim, heart doctor").
  const name: Word[] = [];
  let i = 0;
  for (; i < words.length && !taken.has(i); i++) {
    if (!name.length && LEADING.has(words[i]!.w)) continue;
    name.push(words[i]!);
    if (/,$/.test(words[i]!.raw)) {
      i++;
      break;
    }
  }
  // With no specialty named, what's left before the next field is one ("Dr Kim, heart doctor, 555-0100").
  if (!specialty) {
    const rest: Word[] = [];
    for (; i < words.length && !taken.has(i); i++) rest.push(words[i]!);
    if (rest.length) specialty = capitalize(joinRaw(rest));
  }
  const nameText = titleCase(joinRaw(name));
  const nameWords = name.map((w) => w.w);
  const type: ProviderType = nameWords.some((w) => PHARMACY_WORDS.has(w))
    ? "pharmacy"
    : nameWords.some((w) => PRACTICE_WORDS.has(w))
      ? "practice"
      : "clinician";
  const practice = type === "clinician" ? practiceNamed(place, practices) : null;
  return {
    kind: "provider",
    type,
    name: clip(nameText, PROVIDER_LIMITS.name),
    specialty: specialty && clip(specialty, PROVIDER_LIMITS.specialty),
    practiceId: practice?.id ?? null,
    phone,
    address: practice ? null : orNull(joinRaw(place), PROVIDER_LIMITS.address),
  };
};

// ---------------------------------------------------------------------------
// The line
// ---------------------------------------------------------------------------

/** How sure a reading of a new item is: above a loose name match's dose or note. */
const NEW_ITEM_CONFIDENCE = 0.97;
/** "started metformin" with no strength or form may be something else started: offered, not first. */
const STARTED_ALONE_CONFIDENCE = 0.35;

/**
 * The new medication or provider a part asks for, when it opens with one of
 * the vocabulary's new-item phrases, with how sure that is; null otherwise.
 * "started" needs a medication's name after it, and ranks first only with a
 * strength or a form ("started lisinopril 10 mg"). Pure.
 */
export const readNewItem = (
  text: string,
  practices: readonly Practice[],
): { draft: NewItemDraft; confidence: number } | null => {
  const words = wordsIn(text);
  const opening = openingNewItem(words.map((w) => w.w));
  if (!opening) return null;
  const rest = words.slice(opening.used.length);
  if (opening.entry.role === "newProvider")
    return {
      draft: readProvider(
        rest,
        practices.filter((p) => p.type === "practice" || p.type === "pharmacy"),
      ),
      confidence: NEW_ITEM_CONFIDENCE,
    };
  const draft = readMedication(rest);
  if (opening.entry.wholeLine) return { draft, confidence: NEW_ITEM_CONFIDENCE };
  if (!draft.name) return null;
  return { draft, confidence: draft.strength || draft.form ? NEW_ITEM_CONFIDENCE : STARTED_ALONE_CONFIDENCE };
};

/** Whether a line opens with a phrase that keeps it whole ("add provider Dr Kim, cardiology"). */
export const keepsNewItemLine = (line: string) =>
  !!openingNewItem(line.split(/\s+/).slice(0, 4).map(vocabularyWord))?.entry.wholeLine;
