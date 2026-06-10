import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

/**
 * Single shared Supabase client for the app.
 *
 * Replaces the old Firebase singletons (`auth`, `db`, `functions`) from
 * `src/api/firebase.ts`. Session is persisted in AsyncStorage so users stay
 * logged in across launches — the React Native analogue of Firebase Auth's
 * native persistence.
 *
 * Values are injected at build time via Expo public env vars
 * (EXPO_PUBLIC_* are inlined into the JS bundle):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surfaced loudly in dev; in prod the call sites fail fast with a clear error.
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native (used by web OAuth redirects only).
    detectSessionInUrl: false,
  },
});
