import { posthog } from '../config/posthog';

type LogAttributes = Record<string, string | number | boolean>;

/**
 * Purpose-built PostHog log writer. Existing app and crash loggers remain
 * independent so only log records explicitly added here leave the device.
 */
export const PostHogLog = {
  info(message: string, attributes: LogAttributes = {}) {
    posthog?.logger.info(message, attributes);
  },
};
