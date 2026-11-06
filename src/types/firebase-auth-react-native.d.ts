/**
 * firebase-auth-react-native.d.ts
 *
 * Ambient module declaration (declaration merging) for
 * `firebase/auth/react-native` — a Firebase subpath export that ships
 * without its own TypeScript types for React Native's persistence helper.
 * Without this file, importing `getReactNativePersistence` from that path
 * would fail to type-check. Only relevant to the legacy Firebase Auth setup
 * (now migrated to Supabase Auth, see `src/api/supabase.ts`); kept for any
 * remaining Firebase-auth-adjacent code paths that still reference it.
 */
declare module 'firebase/auth/react-native' {
  import type { Persistence } from 'firebase/auth';

  // Minimal typing for React Native persistence helper used with initializeAuth
  export function getReactNativePersistence(storage: any): Persistence;
}
