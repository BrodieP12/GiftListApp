/**
 * collections.ts
 *
 * Legacy module — this file previously defined Firestore collection name
 * constants/references used by the Firebase data layer. Now that the app's
 * backend has migrated to Supabase (Postgres), there are no Firestore
 * collections to reference, so this file is an intentionally empty stub
 * kept only so any stale imports of it don't break the build. All data
 * access now goes through `src/api/supabase.ts` (the Supabase client) and
 * the per-domain services in `src/services/*.ts`.
 */
// Firestore collections removed — data layer migrated to Supabase.
// See src/api/supabase.ts and src/services/*.ts for all data access.
export {};
