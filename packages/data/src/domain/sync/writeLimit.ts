// What one write may upload, shared by the server and the device. Pure and
// client-safe.

/**
 * The most ops one write (one save's local transaction) may hold: a request
 * holds up to the batch limit, or a single write alone up to this. Pinned
 * against the largest device write, a daily series split over the full
 * window (`deviceWrites.browser.test.tsx`).
 */
export const SYNC_WRITE_LIMIT = 1000;
