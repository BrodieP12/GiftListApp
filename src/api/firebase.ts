/**
 * firebase.ts
 *
 * Legacy/being-phased-out module. Firebase previously backed this app's
 * auth, Firestore data, and (still) its crash/analytics reporting. Auth and
 * Firestore data access have both been migrated to Supabase (see
 * `src/api/supabase.ts`), so this file no longer exports a Firebase app/
 * Firestore/Auth instance — it's an intentionally empty stub kept so any
 * stale imports of `src/api/firebase` don't break the build.
 *
 * Firebase itself is NOT fully removed from the app: Crashlytics and
 * Analytics still run on Firebase and are wired up directly in
 * `LoggingService` (via `@react-native-firebase/crashlytics` and
 * `@react-native-firebase/analytics`) rather than through this module.
 */
// Firebase is kept only for Crashlytics and Analytics.
// Auth and Firestore have been migrated to Supabase.
// LoggingService imports directly from @react-native-firebase/crashlytics and analytics.
export {};
