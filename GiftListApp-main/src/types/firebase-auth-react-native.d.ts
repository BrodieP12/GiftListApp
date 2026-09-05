declare module 'firebase/auth/react-native' {
  import type { Persistence } from 'firebase/auth';

  // Minimal typing for React Native persistence helper used with initializeAuth
  export function getReactNativePersistence(storage: any): Persistence;
}
