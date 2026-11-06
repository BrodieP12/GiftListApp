/**
 * supabase.ts
 *
 * Sets up and exports the single, app-wide Supabase client used for all
 * backend access (Postgres data via PostgREST, Supabase Auth, and Supabase
 * Realtime subscriptions) now that the app has migrated off Firebase. Every
 * service under `src/services/*.ts` and hook under `src/hooks/*.ts` that
 * talks to the backend should import `supabase` from here rather than
 * constructing its own client, so the whole app shares one auth session and
 * one set of realtime connections.
 *
 * Reads the project URL/anon key from Expo public env vars
 * (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`), which must
 * be present at build/runtime (see `.env.example`).
 */
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * The shared Supabase client instance.
 *
 * Auth config notes (why each option is set):
 * - `storage: AsyncStorage` — React Native has no `window.localStorage`, so
 *   the Supabase Auth session must be persisted via AsyncStorage instead;
 *   without this, sessions wouldn't survive an app restart.
 * - `autoRefreshToken: true` — silently refreshes the access token before
 *   it expires, so a long-lived app session doesn't get logged out.
 * - `persistSession: true` — writes the session to `storage` so the user
 *   stays signed in across app restarts.
 * - `detectSessionInUrl: false` — disables Supabase's browser-only
 *   URL-based session detection (used for OAuth/magic-link redirects on
 *   the web), which is not applicable/would error in a React Native
 *   environment with no `window.location`.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
