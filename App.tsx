import 'react-native-gesture-handler'; // MUST be the very first import for React Navigation
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/hooks/useAuth';
import { RootNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}