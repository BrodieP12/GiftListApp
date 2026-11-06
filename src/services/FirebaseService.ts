// Firebase Analytics helper — thin wrapper used by PostHog's debug mode.
// Crashlytics is used directly in LoggingService.ts.
import analytics from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

/**
 * FirebaseService
 * ---------------
 * Leftover Firebase Analytics wrapper surviving the Firebase -> Supabase
 * backend migration. Data and auth now live in Supabase, but this app still
 * uses Firebase Analytics (and Crashlytics, via LoggingService.ts) purely
 * for app telemetry/crash reporting — those are independent of the backend
 * a request talks to, so they weren't migrated.
 *
 * Every call is deliberately fire-and-forget/non-fatal: analytics logging
 * must never be allowed to break app flow or throw into calling code.
 */
export const FirebaseService = {
  /**
   * Logs an analytics event to Firebase Analytics.
   *
   * @param name - The event name (Firebase's naming rules apply, e.g. no spaces, <=40 chars).
   * @param params - Optional key/value payload attached to the event.
   *
   * No-ops on web (`Platform.OS === 'web'`) because `@react-native-firebase/analytics` has no
   * web implementation in this project. Any failure from the native analytics call (e.g. not
   * initialized yet, offline) is swallowed silently — analytics is best-effort and should
   * never surface an error to the caller or crash the app.
   */
  async logEvent(name: string, params?: Record<string, any>) {
    if (Platform.OS === 'web') return;
    try {
      await analytics().logEvent(name, params);
    } catch {
      // Non-fatal — analytics should never crash the app
    }
  },
};
