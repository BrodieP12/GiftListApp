process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
process.env.EXPO_PUBLIC_POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || 'mock-posthog-key';
process.env.EXPO_PUBLIC_POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationCategoryAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id-1'),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6, MAX: 7 },
  AndroidNotificationPriority: { MIN: 'min', LOW: 'low', DEFAULT: 'default', HIGH: 'high', MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 2 },
}));
