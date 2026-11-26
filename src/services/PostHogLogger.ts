import { posthog } from '../config/posthog';

type LogAttributes = Record<string, string | number | boolean>;

/**
 * Dedicated logger for the small set of application outcomes intentionally
 * exported to PostHog Logs. It does not proxy console, Firebase, or
 * Crashlytics output, keeping exported log volume and contents explicit.
 */
export const PostHogLogger = {
  info(message: string, attributes: LogAttributes = {}) {
    posthog?.logger.info(message, attributes);
  },
};
