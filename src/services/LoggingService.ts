import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { posthog } from './analytics';

/**
 * REGULAR LOGGING CLASS
 * Tracks app flow and user actions. Crashlytics Analytics -> PostHog.
 */
class AppLogger {
    // Logs to console and PostHog (when debug mode is enabled).
    static async info(message: string, params: object = {}) {
        if (__DEV__) console.log(`[INFO]: ${message}`, params);
        if (Platform.OS !== 'web') {
            const isDebug = (await AsyncStorage.getItem('debug_mode')) === 'true';
            if (isDebug) posthog.capture('app_info', { message, ...params });
        }
        // Breadcrumb so the message appears in any later Sentry crash report.
        Sentry.addBreadcrumb({ category: 'info', message, data: params });
    }
}

/**
 * CRASH LOGGING CLASS
 * Tracks non-fatal errors, exceptions, and crashes. Crashlytics -> Sentry.
 */
class CrashLogger {
    // Sets a persistent attribute (e.g., app version or user id).
    static setContext(key: string, value: string) {
        Sentry.setTag(key, value);
    }

    static error(error: any, context: string = 'General') {
        const err = error as Error;
        if (__DEV__) console.error(`[CRASH]: ${context}`, err);
        Sentry.captureException(err, { tags: { error_context: context } });
    }

    // Forces a crash (only to TEST the integration).
    static testCrash() {
        Sentry.nativeCrash();
    }
}

export { AppLogger, CrashLogger };
