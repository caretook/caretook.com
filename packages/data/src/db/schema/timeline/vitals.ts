import { z } from "zod";

// Vital signs and other measurements on the timeline (kind "vital").
// Client-safe: the same definitions drive the form, the card and the server.
//
// Values are stored in ONE canonical unit per measure (°C, kg, mg/dL, mL),
// at full precision. Each user picks display units (see userPreferences.ts),
// and conversion happens at the edges: the form converts what was typed,
// the card converts what it shows.

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Measures shown in a unit the user chooses. The first unit is canonical (stored). */
export const UNIT_OPTIONS = {
  temperature: ["c", "f"],
  weight: ["kg", "lb"],
  glucose: ["mg/dL", "mmol/L"],
  volume: ["mL", "fl oz"],
} as const;

export type Measure = keyof typeof UNIT_OPTIONS;
export type UnitFor<M extends Measure> = (typeof UNIT_OPTIONS)[M][number];
export type UnitChoices = { [M in Measure]: UnitFor<M> };

export const UNIT_LABEL: Record<UnitFor<Measure>, string> = {
  c: "°C",
  f: "°F",
  kg: "kg",
  lb: "lb",
  "mg/dL": "mg/dL",
  "mmol/L": "mmol/L",
  mL: "mL",
  "fl oz": "fl oz",
};

const LB_PER_KG = 1 / 0.45359237;
const MG_DL_PER_MMOL_L = 18.016;
const ML_PER_FL_OZ = 29.5735;

/** Canonical → display unit. */
const fromCanonical: Record<UnitFor<Measure>, (v: number) => number> = {
  c: (v) => v,
  f: (v) => (v * 9) / 5 + 32,
  kg: (v) => v,
  lb: (v) => v * LB_PER_KG,
  "mg/dL": (v) => v,
  "mmol/L": (v) => v / MG_DL_PER_MMOL_L,
  mL: (v) => v,
  "fl oz": (v) => v / ML_PER_FL_OZ,
};

/** Display unit → canonical. */
const toCanonical: Record<UnitFor<Measure>, (v: number) => number> = {
  c: (v) => v,
  f: (v) => ((v - 32) * 5) / 9,
  kg: (v) => v,
  lb: (v) => v / LB_PER_KG,
  "mg/dL": (v) => v,
  "mmol/L": (v) => v * MG_DL_PER_MMOL_L,
  mL: (v) => v,
  "fl oz": (v) => v * ML_PER_FL_OZ,
};

/** Decimal places worth showing (and accepting) in each unit. */
const DECIMALS: Record<UnitFor<Measure>, number> = {
  c: 1,
  f: 1,
  kg: 1,
  lb: 1,
  "mg/dL": 0,
  "mmol/L": 1,
  mL: 0,
  "fl oz": 1,
};

// ---------------------------------------------------------------------------
// Vital types
// ---------------------------------------------------------------------------

export const VITAL_TYPES = [
  "bloodPressure",
  "heartRate",
  "temperature",
  "spo2",
  "respiratoryRate",
  "weight",
  "bloodGlucose",
  "bowelMovement",
  "urineOutput",
  "sleep",
] as const;
export type VitalType = (typeof VITAL_TYPES)[number];

/** One number a reading asks for. Limits are in the canonical unit. */
export type VitalFieldSpec = {
  key: "value" | "systolic" | "diastolic" | "bristol";
  label: string;
  /** A measure the user picks units for, or a fixed unit label. */
  unit: Measure | { fixed: string };
  /** Hard limits: anything outside is impossible and rejected. */
  min: number;
  max: number;
  /** Typical range: outside it the form asks "double-check this?" but still saves. */
  typical?: { min: number; max: number };
  integer: boolean;
  /** Input step for a fixed-unit, non-integer field (sleep in quarter hours). */
  step?: number;
  /** May be left blank (a bowel movement without a Bristol type, urine not measured). */
  optional?: boolean;
};

export type VitalSpec = { label: string; short: string; fields: VitalFieldSpec[] };

const fixed = (label: string) => ({ fixed: label });

export const VITALS: Record<VitalType, VitalSpec> = {
  bloodPressure: {
    label: "Blood pressure",
    short: "BP",
    fields: [
      {
        key: "systolic",
        label: "Systolic (top)",
        unit: fixed("mmHg"),
        min: 40,
        max: 300,
        typical: { min: 90, max: 180 },
        integer: true,
      },
      {
        key: "diastolic",
        label: "Diastolic (bottom)",
        unit: fixed("mmHg"),
        min: 20,
        max: 200,
        typical: { min: 50, max: 120 },
        integer: true,
      },
    ],
  },
  heartRate: {
    label: "Heart rate",
    short: "HR",
    fields: [
      {
        key: "value",
        label: "Heart rate",
        unit: fixed("bpm"),
        min: 20,
        max: 300,
        typical: { min: 40, max: 130 },
        integer: true,
      },
    ],
  },
  temperature: {
    label: "Temperature",
    short: "Temp",
    fields: [
      {
        key: "value",
        label: "Temperature",
        unit: "temperature",
        min: 25,
        max: 45,
        typical: { min: 35, max: 38.5 },
        integer: false,
      },
    ],
  },
  spo2: {
    label: "Oxygen (SpO₂)",
    short: "SpO₂",
    fields: [
      {
        key: "value",
        label: "Oxygen saturation",
        unit: fixed("%"),
        min: 50,
        max: 100,
        typical: { min: 90, max: 100 },
        integer: true,
      },
    ],
  },
  respiratoryRate: {
    label: "Breathing rate",
    short: "Resp",
    fields: [
      {
        key: "value",
        label: "Breaths per minute",
        unit: fixed("/min"),
        min: 2,
        max: 80,
        typical: { min: 8, max: 30 },
        integer: true,
      },
    ],
  },
  weight: {
    label: "Weight",
    short: "Weight",
    fields: [{ key: "value", label: "Weight", unit: "weight", min: 0.5, max: 500, integer: false }],
  },
  bloodGlucose: {
    label: "Blood sugar",
    short: "Glucose",
    fields: [
      {
        key: "value",
        label: "Blood sugar",
        unit: "glucose",
        min: 10,
        max: 1000,
        typical: { min: 60, max: 250 },
        integer: false,
      },
    ],
  },
  bowelMovement: {
    label: "Bowel movement",
    short: "BM",
    fields: [
      {
        key: "bristol",
        label: "Bristol type",
        unit: fixed(""),
        min: 1,
        max: 7,
        integer: true,
        optional: true,
      },
    ],
  },
  urineOutput: {
    label: "Urine output",
    short: "Urine",
    fields: [
      { key: "value", label: "Amount", unit: "volume", min: 0, max: 5000, integer: false, optional: true },
    ],
  },
  sleep: {
    label: "Sleep",
    short: "Sleep",
    fields: [
      {
        key: "value",
        label: "Hours slept",
        unit: fixed("h"),
        min: 0,
        max: 24,
        typical: { min: 3, max: 14 },
        integer: false,
        step: 0.25,
      },
    ],
  },
};

/** The Bristol stool scale, for the picker and the card. */
export const BRISTOL_TYPES: Record<number, string> = {
  1: "Separate hard lumps",
  2: "Lumpy, sausage-shaped",
  3: "Sausage with cracks",
  4: "Smooth, soft sausage",
  5: "Soft blobs, clear edges",
  6: "Mushy, ragged edges",
  7: "Watery, no solid pieces",
};

// ---------------------------------------------------------------------------
// Unit helpers (for a field, given the user's choices)
// ---------------------------------------------------------------------------

const unitOf = (field: VitalFieldSpec, units: UnitChoices) =>
  typeof field.unit === "string" ? units[field.unit] : null;

/** The unit label to show next to a field: "°F", "mmHg", or "". */
export const fieldUnitLabel = (field: VitalFieldSpec, units: UnitChoices) => {
  const unit = unitOf(field, units);
  return unit ? UNIT_LABEL[unit] : typeof field.unit === "object" ? field.unit.fixed : "";
};

/** A stored (canonical) value as the user's unit, rounded for display. */
export const toDisplay = (field: VitalFieldSpec, value: number, units: UnitChoices) => {
  const unit = unitOf(field, units);
  if (!unit) return value;
  const factor = 10 ** DECIMALS[unit];
  return Math.round(fromCanonical[unit](value) * factor) / factor;
};

/** What the user typed (in their unit) as the canonical value to store. */
export const fromDisplay = (field: VitalFieldSpec, value: number, units: UnitChoices) => {
  const unit = unitOf(field, units);
  return unit ? toCanonical[unit](value) : value;
};

/** The input step for a field in the user's unit: 1, 0.1… */
export const fieldStep = (field: VitalFieldSpec, units: UnitChoices) => {
  const unit = unitOf(field, units);
  if (field.integer) return 1;
  if (!unit) return field.step ?? 1;
  return 10 ** -DECIMALS[unit];
};

/** A field's hard limits in the user's unit, for messages ("between 77 and 113 °F"). */
export const fieldRange = (field: VitalFieldSpec, units: UnitChoices) => ({
  min: toDisplay(field, field.min, units),
  max: toDisplay(field, field.max, units),
});

/** Outside the typical range? (Canonical value.) */
export const isUnusual = (field: VitalFieldSpec, value: number) =>
  !!field.typical && (value < field.typical.min || value > field.typical.max);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

// A tiny tolerance on hard limits, so 113 °F → 45.0000000001 °C still passes.
const EPSILON = 1e-6;

const specOf = (type: VitalType, key: VitalFieldSpec["key"]) => {
  const spec = VITALS[type].fields.find((f) => f.key === key);
  if (!spec) throw new Error(`No field ${key} on ${type}`);
  return spec;
};

const numberZ = (spec: VitalFieldSpec) =>
  (spec.integer ? z.int() : z.number()).min(spec.min - EPSILON).max(spec.max + EPSILON);

const fieldZ = (type: VitalType, key: VitalFieldSpec["key"]) => numberZ(specOf(type, key));
const optionalFieldZ = (type: VitalType, key: VitalFieldSpec["key"]) => numberZ(specOf(type, key)).nullish();

const reading = <T extends VitalType, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.strictObject({ type: z.literal(type), ...shape });

/** The one cross-field rule, named so forms can show it as is. */
export const BP_ORDER_MESSAGE = "The bottom number must be lower than the top one.";

export const vitalReadingZSchema = z.discriminatedUnion("type", [
  reading("bloodPressure", {
    systolic: fieldZ("bloodPressure", "systolic"),
    diastolic: fieldZ("bloodPressure", "diastolic"),
  }).refine((r) => r.diastolic < r.systolic, {
    path: ["diastolic"],
    message: BP_ORDER_MESSAGE,
  }),
  reading("heartRate", { value: fieldZ("heartRate", "value") }),
  reading("temperature", { value: fieldZ("temperature", "value") }),
  reading("spo2", { value: fieldZ("spo2", "value") }),
  reading("respiratoryRate", { value: fieldZ("respiratoryRate", "value") }),
  reading("weight", { value: fieldZ("weight", "value") }),
  reading("bloodGlucose", { value: fieldZ("bloodGlucose", "value") }),
  reading("bowelMovement", { bristol: optionalFieldZ("bowelMovement", "bristol") }),
  reading("urineOutput", { value: optionalFieldZ("urineOutput", "value") }),
  reading("sleep", { value: fieldZ("sleep", "value") }),
]);
export type VitalReading = z.infer<typeof vitalReadingZSchema>;

/** One sitting: one or more readings, at most one of each type. */
export const vitalDetailsZSchema = z
  .strictObject({ readings: z.array(vitalReadingZSchema).min(1).max(VITAL_TYPES.length) })
  .refine((d) => new Set(d.readings.map((r) => r.type)).size === d.readings.length, {
    path: ["readings"],
    message: "Each vital can appear once per entry",
  });
export type VitalDetails = z.infer<typeof vitalDetailsZSchema>;

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const num = (field: VitalFieldSpec, value: number, units: UnitChoices) =>
  toDisplay(field, value, units).toLocaleString(undefined, { maximumFractionDigits: 1 });

const withUnit = (text: string, unit: string) =>
  // "97%", "18/min" attach; "98.6 °F", "74 bpm" take a space.
  unit === "" ? text : unit === "%" || unit.startsWith("/") ? `${text}${unit}` : `${text} ${unit}`;

/**
 * Known to this build? Rows can carry types this code doesn't have yet (a
 * newer app synced them) or no longer has (pain moved to symptoms), so
 * screens skip unknown readings instead of crashing.
 */
export const isKnownReading = (reading: { type: string }): reading is VitalReading => reading.type in VITALS;

/** One reading as short text: "BP 128/82 mmHg", "Temp 98.6 °F", "BM type 4". */
export const formatReading = (reading: VitalReading, units: UnitChoices) => {
  const spec = VITALS[reading.type];
  const field = spec.fields[0]!;
  const measured = (value: number) =>
    `${spec.short} ${withUnit(num(field, value, units), fieldUnitLabel(field, units))}`;
  switch (reading.type) {
    case "bloodPressure":
      return `${spec.short} ${reading.systolic}/${reading.diastolic} mmHg`;
    case "bowelMovement":
      return reading.bristol == null ? spec.short : `${spec.short} type ${reading.bristol}`;
    case "urineOutput":
      return reading.value == null ? `${spec.short} (not measured)` : measured(reading.value);
    default:
      return measured(reading.value);
  }
};
