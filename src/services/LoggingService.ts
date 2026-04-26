import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

/**
 * REGULAR LOGGING CLASS
 * Used for tracking app flow, and user actions
 */
class AppLogger {
    private static async isDebugEnabled(): Promise<boolean> {
        const val = true// = await AsyncStorage.getItem('debug_mode');
        return val;
    }

    // Logs to console and Firebase Analytics (if debug mode is on)
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
    // Sets a persistent attribute (e.g., current APK version or User ID)
    static setContext(key: string, value: string) {
        if (Platform.OS !== 'web') {
            crashlytics().setAttribute(key, value);
        }
    }
    static error(error: any, context: string = 'General') {
        const err = error as Error;
        if (__DEV__) console.error(`[CRASH]: ${context}`, err);
        if (Platform.OS !== 'web') {
            crashlytics().setAttribute('error_context', context);
            crashlytics().recordError(err);
        }
    }

    // Forces a crash (Only use this to TEST your integration)
    static testCrash() {
        if (Platform.OS !== 'web') {
            crashlytics().crash();
        }
    }
}

export { AppLogger, CrashLogger };