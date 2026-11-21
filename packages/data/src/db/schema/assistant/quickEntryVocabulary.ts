import { foldSearchText } from "../search/search";

// Quick entry's vocabulary: every word or phrase that picks a part's kind,
// in one reviewable table. A reported miss ("quick entry reads X as Y") is a
// row here and a test row in quickEntry.test.ts, never a list elsewhere.
// Pure and client-safe; the parser (quickEntry.ts) reads it. English only.
//
// Symptom words that aren't incidents ("dizzy", "pain") stay in the parser's
// SYMPTOM_STEMS: they make a symptom named by what was typed.

/**
 * What a phrase does to its part:
 * - `symptomIncident`: a symptom named by the row's `name` ("fell" → "Fall"), with no severity.
 * - `noteIncident`: a note ("911", "went to the ER").
 * - `visitVerb`: with a provider, an event that looks back ("saw Dr. Lee").
 * - `contactVerb`: with a provider, a note that mentions it ("called Dr. Lee").
 * - `appointmentWord`: an event that looks ahead ("appt", "checkup").
 */
export type VocabularyRole =
  "symptomIncident" | "noteIncident" | "visitVerb" | "contactVerb" | "appointmentWord";

export type VocabularyEntry = {
  /** One or more words, matched folded and in order ("passed out"). */
  phrase: string;
  role: VocabularyRole;
  /** A symptom incident's canonical name ("Fall"). */
  name?: string;
  /** Words that, right after the phrase, mean it isn't this ("fell asleep"). */
  unlessNext?: readonly string[];
};

const ASLEEP = ["asleep"];

export const QUICK_ENTRY_VOCABULARY: readonly VocabularyEntry[] = [
  // Incidents tracked as symptoms.
  { phrase: "fell", role: "symptomIncident", name: "Fall", unlessNext: ASLEEP },
  { phrase: "fall", role: "symptomIncident", name: "Fall", unlessNext: ASLEEP },
  { phrase: "fallen", role: "symptomIncident", name: "Fall", unlessNext: ASLEEP },
  { phrase: "seizure", role: "symptomIncident", name: "Seizure" },
  { phrase: "seizures", role: "symptomIncident", name: "Seizure" },
  { phrase: "passed out", role: "symptomIncident", name: "Passed out" },
  { phrase: "choked", role: "symptomIncident", name: "Choking" },
  { phrase: "choking", role: "symptomIncident", name: "Choking" },
  { phrase: "wandered", role: "symptomIncident", name: "Wandering" },
  { phrase: "wandering", role: "symptomIncident", name: "Wandering" },

  // Incidents kept as notes (linked to a provider only when one is named).
  { phrase: "911", role: "noteIncident" },
  { phrase: "er", role: "noteIncident" },
  { phrase: "emergency room", role: "noteIncident" },
  { phrase: "urgent care", role: "noteIncident" },
  { phrase: "ambulance", role: "noteIncident" },
  { phrase: "hospital", role: "noteIncident" },
  { phrase: "hospitalized", role: "noteIncident" },
  { phrase: "admitted", role: "noteIncident" },
  { phrase: "discharged", role: "noteIncident" },

  // A visit that happened: with a provider, an event looking back.
  { phrase: "saw", role: "visitVerb" },
  { phrase: "visited", role: "visitVerb" },
  { phrase: "went to", role: "visitVerb" },
  { phrase: "went", role: "visitVerb" },
  { phrase: "had", role: "visitVerb" },

  // Getting in touch: with a provider, a note.
  { phrase: "called", role: "contactVerb" },
  { phrase: "phoned", role: "contactVerb" },
  { phrase: "talked to", role: "contactVerb" },
  { phrase: "talked with", role: "contactVerb" },
  { phrase: "spoke to", role: "contactVerb" },
  { phrase: "spoke with", role: "contactVerb" },
  { phrase: "emailed", role: "contactVerb" },
  { phrase: "texted", role: "contactVerb" },
  { phrase: "messaged", role: "contactVerb" },

  // Appointments: an event, its time read ahead.
  { phrase: "appt", role: "appointmentWord" },
  { phrase: "appts", role: "appointmentWord" },
  { phrase: "apt", role: "appointmentWord" },
  { phrase: "appointment", role: "appointmentWord" },
  { phrase: "appointments", role: "appointmentWord" },
  { phrase: "visit", role: "appointmentWord" },
  { phrase: "checkup", role: "appointmentWord" },
  { phrase: "check-up", role: "appointmentWord" },
  { phrase: "consult", role: "appointmentWord" },
  { phrase: "consultation", role: "appointmentWord" },
];

/** A word as the vocabulary compares it: folded, letters and digits only ("E.R." → "er"). */
export const vocabularyWord = (word: string) =>
  (foldSearchText(word).match(/[\p{L}\p{N}]+/gu) ?? []).join("");

const ROWS = QUICK_ENTRY_VOCABULARY.map((entry) => ({
  entry,
  words: entry.phrase.split(/\s+/).map(vocabularyWord),
  unless: new Set((entry.unlessNext ?? []).map(vocabularyWord)),
}))
  // Longest phrase first, so "went to" wins over "went".
  .sort((a, b) => b.words.length - a.words.length);

export type VocabularyMatch = { entry: VocabularyEntry; used: number[] };

/**
 * The vocabulary's phrases among `words` (already `vocabularyWord`ed), at
 * the indexes `free` allows, each word in at most one match, in the line's
 * order. A phrase's words must be next to each other.
 */
export const findVocabulary = (
  words: readonly string[],
  free: (i: number) => boolean = () => true,
): VocabularyMatch[] => {
  const taken = new Set<number>();
  const found: VocabularyMatch[] = [];
  for (const row of ROWS) {
    for (let i = 0; i + row.words.length <= words.length; i++) {
      const used = row.words.map((_, k) => i + k);
      if (!used.every((k, n) => free(k) && !taken.has(k) && words[k] === row.words[n])) continue;
      if (row.unless.has(words[i + row.words.length] ?? "")) continue;
      used.forEach((k) => taken.add(k));
      found.push({ entry: row.entry, used });
    }
  }
  return found.sort((a, b) => a.used[0]! - b.used[0]!);
};
