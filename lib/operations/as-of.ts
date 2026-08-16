/**
 * Parses the "YYYY-MM-DD" asOf string supplied by /api/operations (the
 * company-timezone "business today") into a Date at local midnight.
 *
 * Every surface that measures booking age — the operations route, the
 * operational client fallback, and the Dashboard/Booking/Stock pages'
 * filtered recomputes — parses the payload through this single helper so
 * the business date can never drift between callers.
 */
export function asOfDate(asOf: string): Date {
  return new Date(`${asOf}T00:00:00`);
}

