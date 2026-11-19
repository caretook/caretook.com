import type { dbToModel } from "./medicationModel";

export type MedicationModel = ReturnType<typeof dbToModel>;
