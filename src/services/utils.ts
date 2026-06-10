/**
 * Converts a value coming from Supabase (ISO 8601 string), the UI (Date),
 * or a legacy Firestore-style object ({ seconds, nanoseconds }) into a Date.
 * Returns null for empty/invalid input.
 */
export const convertDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  // Legacy Firestore timestamp shape, in case any cached data lingers.
  if (typeof val === 'object' && val.seconds !== undefined) {
    return new Date(val.seconds * 1000);
  }
  return null;
};

/** Serializes a Date (or passthrough string) to an ISO string for Postgres. */
export const toIso = (val: Date | string | null | undefined): string | null => {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return val;
};
