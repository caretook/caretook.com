import type { AllergyLike } from "./allergies";

import { suggestNames } from "../core/nameSuggestions";

// Suggestions for the allergy form's two free-text fields (`AllergyForm`):
// what they're allergic to, and what it does. The group's own allergies
// first (so a second one is spelled the same), then a curated list, through
// the shared matcher (`suggestNames`). Static lists, worded as a family
// would say them: nothing is fetched, and any other text can be typed.
// Pure: web:unit tests it.

/** Common drug, food and environmental allergens, alphabetical, one entry each. */
export const ALLERGY_SUBSTANCES: readonly string[] = [
  "ACE inhibitors",
  "Adhesive tape",
  "Amoxicillin",
  "Ampicillin",
  "Animal dander",
  "Aspirin",
  "Bee stings",
  "Carbamazepine",
  "Cats",
  "Cephalosporins",
  "Codeine",
  "Contrast dye (iodine)",
  "Corn",
  "Dairy (milk)",
  "Dogs",
  "Dust mites",
  "Eggs",
  "Erythromycin",
  "Fish",
  "Fragrance",
  "Gluten",
  "Grass pollen",
  "Hair dye",
  "Ibuprofen",
  "Insect stings",
  "Latex",
  "Lidocaine",
  "Mold",
  "Morphine",
  "Mustard",
  "Naproxen",
  "Nickel",
  "NSAIDs",
  "Oxycodone",
  "Peanuts",
  "Penicillin",
  "Phenytoin",
  "Pollen",
  "Ragweed",
  "Sesame",
  "Shellfish",
  "Soy",
  "Statins",
  "Strawberries",
  "Sulfa drugs",
  "Sulfites",
  "Tetracycline",
  "Tramadol",
  "Tree nuts",
  "Tree pollen",
  "Vancomycin",
  "Wasp stings",
  "Wheat",
  "Wool",
];

/** Common reactions, in everyday words, alphabetical, one entry each. */
export const ALLERGY_REACTIONS: readonly string[] = [
  "Anaphylaxis",
  "Blisters",
  "Confusion",
  "Coughing",
  "Diarrhea",
  "Dizziness",
  "Fainting",
  "Fever",
  "Headache",
  "Hives",
  "Itching",
  "Itchy eyes",
  "Nausea",
  "Rash",
  "Runny nose",
  "Sneezing",
  "Stomach pain",
  "Swelling",
  "Swollen face",
  "Swollen lips or tongue",
  "Throat tightness",
  "Trouble breathing",
  "Vomiting",
  "Watery eyes",
  "Wheezing",
];

/** Up to 20 substances for what's typed: the group's own first, then the curated list. */
export const substanceSuggestions = (
  query: string,
  groupAllergies: readonly Pick<AllergyLike, "substance">[],
  { names = ALLERGY_SUBSTANCES, limit }: { names?: readonly string[]; limit?: number } = {},
): string[] =>
  suggestNames(
    query,
    groupAllergies.map((a) => a.substance),
    names,
    limit,
  );

/** Up to 20 reactions for what's typed: the group's own first, then the curated list. */
export const reactionSuggestions = (
  query: string,
  groupAllergies: readonly Pick<AllergyLike, "reaction">[],
  { names = ALLERGY_REACTIONS, limit }: { names?: readonly string[]; limit?: number } = {},
): string[] =>
  suggestNames(
    query,
    groupAllergies.flatMap((a) => (a.reaction ? [a.reaction] : [])),
    names,
    limit,
  );
