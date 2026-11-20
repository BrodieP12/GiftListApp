import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';
import { supabase } from '../api/supabase';

/**
 * Shared PostHog client instance used across the app (both inside React components
 * via PostHogProvider and in non-React services).
 */
export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY || '', {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
});

/**
 * AppLogger
 * Used for tracking application flow and informational user actions.
 */
class AppLogger {
  /**
   * Logs an informational message.
   * In development, writes to console.
   * If 'debug_mode' is enabled in AsyncStorage, also forwards event to PostHog.
   */
  static async info(message: string, params: object = {}) {
    if (__DEV__) {
      console.log(`[INFO]: ${message}`, params);
    }
    try {
      const isDebug = (await AsyncStorage.getItem('debug_mode')) === 'true';
      if (isDebug) {
        posthog.capture('app_info', { message, ...params });
      }
    } catch {
      // Telemetry errors must never crash the app
    }
  }
}

/**
 * CrashLogger
 * Used for tracking non-fatal errors, exceptions, and app diagnostics.
 * Integrates directly with PostHog and Supabase (per-account) without any Firebase dependency.
 */
class CrashLogger {
  private static contextAttributes: Record<string, string> = {};

  /**
   * Sets persistent key/value context attributes for error tracking.
   */
  static setContext(key: string, value: string) {
    CrashLogger.contextAttributes[key] = value;
    try {
      posthog.register({ [key]: value });
    } catch {
      // Non-fatal
    }
  }

  /**
   * Records a non-fatal error tagged with context.
   * 1. Logs to console.error in __DEV__.
   * 2. Forwards exception event to PostHog with session and device metadata.
   * 3. Attempts to log to Supabase error_logs table tagged with active account ID (fail-safe).
   */
  static async error(error: any, context: string = 'General') {
    const err = error instanceof Error ? error : new Error(String(error));
    if (__DEV__) {
      console.error(`[ERROR]: ${context}`, err);
    }

    // 1. PostHog exception capture
    try {
      posthog.capture('$exception', {
        $exception_message: err.message,
        $exception_stack_trace_raw: err.stack || '',
        context,
        ...CrashLogger.contextAttributes,
      });
    } catch {
      // Non-fatal
    }

    // 2. Supabase account-scoped error logging
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const userEmail = session?.user?.email ?? null;

      // Fail-safe attempt to log in Supabase per active user account
      await supabase.from('error_logs').insert({
        user_id: userId,
        context,
        message: err.message,
        stack: err.stack || null,
        metadata: {
          user_email: userEmail,
          ...CrashLogger.contextAttributes,
          platform: Platform.OS,
        },
      });
    } catch {
      // Fail-safe: logging should never bubble up to callers or disrupt user actions
    }
  }

  /**
   * Deliberately throws an error to test error boundary and crash capturing.
   */
  static testCrash() {
    throw new Error('Test crash triggered from CrashLogger.testCrash()');
  }
}

export { AppLogger, CrashLogger };
