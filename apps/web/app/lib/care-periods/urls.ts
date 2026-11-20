import { groupHome, searchString, segment } from "../core/urls";

/** The care period add sheet's prefills: `periods/new?type=hospital&startedAt=<ISO>&dateOnly=1&place=<providerId>`. */
export const PERIOD_PREFILL_PARAMS = {
  type: "type",
  startedAt: "startedAt",
  dateOnly: "dateOnly",
  place: "place",
} as const;
export type PeriodPrefill = { type?: string; startedAt?: string; dateOnly?: boolean; place?: string };

export const carePeriodUrls = {
  /** A group's care periods: where care has happened, newest first. */
  periods: (groupId: string) => `${groupHome(groupId)}/periods`,
  /**
   * The add sheet over the periods page. It can start prefilled (a type, a
   * start, date-only, a place); `lib/care-periods/periodSheets` checks what it reads.
   */
  newPeriod: (groupId: string, prefill: PeriodPrefill = {}) =>
    `${groupHome(groupId)}/periods/new${searchString({
      [PERIOD_PREFILL_PARAMS.type]: prefill.type,
      [PERIOD_PREFILL_PARAMS.startedAt]: prefill.startedAt,
      [PERIOD_PREFILL_PARAMS.dateOnly]: prefill.dateOnly ? "1" : null,
      [PERIOD_PREFILL_PARAMS.place]: prefill.place,
    })}`,
  /** A care period's page: its place, dates and notes. */
  period: (groupId: string, periodId: string) => `${groupHome(groupId)}/periods/${segment(periodId)}`,
  /** The edit sheet for one care period, over the periods page. */
  editPeriod: (groupId: string, periodId: string) =>
    `${groupHome(groupId)}/periods/${segment(periodId)}/edit`,
} as const;
