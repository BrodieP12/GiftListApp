// Dummy Supabase env so src/api/supabase.ts initializes quietly in tests.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock native modules that can't run under jest-expo's node environment.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// PostHog pulls in survey UI with native transitive deps; stub the client.
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    identify: jest.fn(),
    screen: jest.fn(),
  })),
}));

// Sentry's native SDK can't load under jest; stub the surface we use.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
  nativeCrash: jest.fn(),
}));
