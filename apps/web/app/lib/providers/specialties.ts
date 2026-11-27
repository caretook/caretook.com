import type { ProviderType } from "@caretook/data/schema";

/**
 * Suggestions for the provider form's specialty field (a native datalist
 * beside it), per type. Only suggestions: any typed value saves as typed.
 */
export const SPECIALTY_SUGGESTIONS: Record<ProviderType, readonly string[]> = {
  clinician: [
    "Primary care",
    "Family medicine",
    "Internal medicine",
    "Pediatrics",
    "Geriatrics",
    "Cardiology",
    "Oncology",
    "Neurology",
    "Dermatology",
    "Gastroenterology",
    "Endocrinology",
    "Pulmonology",
    "Nephrology",
    "Rheumatology",
    "Urology",
    "Ophthalmology",
    "Orthopedics",
    "Psychiatry",
    "Psychology",
    "Physical therapy",
    "Occupational therapy",
    "Speech therapy",
    "Dentistry",
    "Nursing",
  ],
  practice: [
    "Family medicine clinic",
    "Specialty clinic",
    "Hospital",
    "Urgent care",
    "Lab",
    "Imaging center",
    "Therapy clinic",
    "Dental office",
  ],
  pharmacy: ["Retail", "Mail order", "Compounding", "Specialty", "Hospital"],
  other: [
    "Home health aide",
    "Caregiver",
    "Case manager",
    "Social worker",
    "Insurance",
    "Neighbor",
    "Family",
  ],
};
