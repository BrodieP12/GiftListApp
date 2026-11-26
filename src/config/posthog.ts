import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

const extra = Constants.expoConfig?.extra;
const projectToken = extra?.posthogProjectToken as string | undefined;
const host = extra?.posthogHost as string | undefined;

export const isPostHogConfigured = Boolean(projectToken && host);

if (!isPostHogConfigured && __DEV__) {
  if (!projectToken) {
    console.error(
      new Error(
        'EXPO_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_KEY is configured',
      ),
    );
  }

  if (!host) {
    console.error(
      new Error(
        'EXPO_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_HOST is configured',
      ),
    );
  }
}

export const posthog = isPostHogConfigured
  ? new PostHog(projectToken!, {
      host: host!,
      logs: {
        serviceName: 'giftlist-mobile',
      },
      captureAppLifecycleEvents: true,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          // The app's existing ErrorBoundary handles render failures; omitting
          // console capture prevents those errors from being reported twice.
          console: [],
        },
      },
      debug: __DEV__,
      preloadFeatureFlags: true,
    })
  : undefined;
