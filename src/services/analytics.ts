import PostHog from 'posthog-react-native';

/**
 * PostHog client (replaces Firebase Analytics).
 * Configured via EXPO_PUBLIC_POSTHOG_KEY / EXPO_PUBLIC_POSTHOG_HOST.
 *
 * Exposed as a module singleton so LoggingService and screens can `capture`
 * without threading a provider through the tree.
 */
export const posthog = new PostHog(
  process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // Avoid noisy autocapture; we log explicit events like the old analytics.
    disabled: !process.env.EXPO_PUBLIC_POSTHOG_KEY,
  }
);
