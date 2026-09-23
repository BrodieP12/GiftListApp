import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

/**
 * LoggingService
 * --------------
 * App-wide logging, split into two concerns:
 * - `AppLogger`: informational/flow logging (console in dev, optionally
 *   Firebase Analytics events, always a Crashlytics breadcrumb log).
 * - `CrashLogger`: non-fatal error/crash reporting via Firebase
 *   Crashlytics, independent of the Supabase backend migration (crash
 *   reporting isn't backend-specific, so it was left on Firebase — see
 *   FirebaseService.ts for the analogous analytics wrapper).
 *
 * Both classes no-op their native calls on web (`Platform.OS === 'web'`)
 * since `@react-native-firebase/analytics` and `crashlytics` have no web
 * implementation here.
 */

/**
 * REGULAR LOGGING CLASS
 * Used for tracking app flow, and user actions
 */
class AppLogger {
    /**
     * Logs an informational/flow message describing app or user activity.
     *
     * @param message - Human-readable description of the event.
     * @param params - Optional structured context attached to the log entry.
     *
     * Always console.logs in `__DEV__`. On native platforms, additionally reads the
     * `'debug_mode'` flag directly from `AsyncStorage` (persisted user/dev setting) and, only
     * when it's `'true'`, forwards the message as a Firebase Analytics `app_info` event —
     * this keeps routine flow logging from flooding Analytics for normal users while still
     * being available when debug mode is turned on. Independently of that flag, it always
     * writes a breadcrumb line to Crashlytics (`crashlytics().log(...)`) so this message shows
     * up in the trail leading up to any crash report, even if debug mode is off.
     */
    static async info(message: string, params: object = {}) {
        if (__DEV__) console.log(`[INFO]: ${message}`, params);
        if (Platform.OS !== 'web') {
            const isDebug = await AsyncStorage.getItem('debug_mode') === 'true';
            if (isDebug) await analytics().logEvent('app_info', { message, ...params });
            crashlytics().log(`INFO: ${message} | ${JSON.stringify(params)}`);
        }
    }
}

/**
 * CRASH LOGGING CLASS
 * Used for tracking non-fatal errors, exceptions, and crashes.
 */
class CrashLogger {
    /**
     * Sets a persistent key/value attribute attached to all future Crashlytics reports on this
     * device (e.g. app version, current user id) — useful for correlating crash reports with
     * app/user state without needing that state at crash time.
     *
     * @param key - Attribute name.
     * @param value - Attribute value.
     */
    static setContext(key: string, value: string) {
        if (Platform.OS !== 'web') {
            crashlytics().setAttribute(key, value);
        }
    }

    /**
     * Records a non-fatal error to Crashlytics, tagged with a context label describing where
     * it happened.
     *
     * @param error - The caught error/exception. Cast to `Error` for `crashlytics().recordError`;
     *   pass an actual `Error` instance for a useful stack trace.
     * @param context - Short label identifying the call site (e.g. `'RetailerService.fetchItemMetadata'`),
     *   defaults to `'General'`. Stored both as a Crashlytics attribute (`error_context`) and
     *   printed alongside the error in dev console output, so a failure can be traced back to
     *   the calling code without needing the original stack trace to survive minification.
     */
    static error(error: any, context: string = 'General') {
        const err = error as Error;
        if (__DEV__) console.error(`[CRASH]: ${context}`, err);
        if (Platform.OS !== 'web') {
            crashlytics().setAttribute('error_context', context);
            crashlytics().recordError(err);
        }
    }

    /**
     * Deliberately force-crashes the app via Crashlytics's native `.crash()`.
     *
     * FOR MANUAL TESTING ONLY — verifies that the Crashlytics integration is wired up
     * correctly end-to-end (crash reports actually reach the Firebase console). Never call
     * this from real app logic.
     */
    static testCrash() {
        if (Platform.OS !== 'web') {
            crashlytics().crash();
        }
    }
}

export { AppLogger, CrashLogger };