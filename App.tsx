import 'react-native-gesture-handler';
import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogProvider } from 'posthog-react-native';
import { AuthProvider } from './src/hooks/useAuth';
import { RootNavigator } from './src/navigation/AppNavigator';
import { FeedbackTrigger } from './src/components/common/FeedbackTrigger';
import { ErrorBoundary } from './src/components/common/ErrorBoundary';
import { FeedbackProvider } from './src/theme/FeedbackContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import { CrashLogger } from './src/services/LoggingService';
import * as SplashScreen from 'expo-splash-screen';

// Suppress PostHog network errors from the red LogBox overlay — they are
// transient flush failures (no connectivity) and do not affect app function.
LogBox.ignoreLogs([
  'PostHogFetchNetworkError',
  'Error while flushing PostHog',
  'Network error while fetching PostHog',
]);

SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(err => CrashLogger.error(err, 'SplashScreen.hideAsync'));
  }, []);

  return (
    <PostHogProvider
      apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY!}
      options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST }}
      autocapture={{ captureScreens: false, captureTouches: true }}
      debug={__DEV__}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <FeedbackProvider>
                <FeedbackTrigger>
                  <RootNavigator />
                  <StatusBar style="auto" />
                </FeedbackTrigger>
              </FeedbackProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </PostHogProvider>
  );
}
