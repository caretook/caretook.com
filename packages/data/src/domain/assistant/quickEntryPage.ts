// The page quick entry opened on, as the parser reads it: on a provider's
// page a note or event that names no provider is about that provider, and on
// a medication's page a dose line that names no medication ("gave 1",
// "skipped") is a dose of it. Pure and client-safe; the timeline has none.

/** The record whose page the box is on. */
export type QuickEntryPage = {
  providerId?: string;
  medicationId?: string;
};

/** The page context for a route's params (`useParams`): undefined on a page that is neither. */
export const pageContextFor = (
  params: Readonly<Record<string, string | undefined>>,
): QuickEntryPage | undefined => {
  const page: QuickEntryPage = {};
  if (params.providerId) page.providerId = params.providerId;
  if (params.medicationId) page.medicationId = params.medicationId;
  return page.providerId || page.medicationId ? page : undefined;
};
