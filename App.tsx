import 'react-native-gesture-handler'; // MUST be the very first import for React Navigation
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/hooks/useAuth';
import { RootNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    // 1. Provide Authentication Context to the entire app tree
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}