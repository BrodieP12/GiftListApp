import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

import { useAuth } from '../hooks/useAuth';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { AddItemScreen } from '../screens/AddItemScreen';

export type AuthStackParamList = {
  Login: undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
  ListDetail: { listId: string; ownerId: string };
  AddItem: { listId: string };
};

const AuthStack = createStackNavigator<AuthStackParamList>();
const AppStack = createStackNavigator<AppStackParamList>();

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
  </AuthStack.Navigator>
);

const AppNavigator = () => (
  <AppStack.Navigator>
    <AppStack.Screen 
      name="Dashboard" 
      component={DashboardScreen} 
      options={{ title: 'My Lists' }} 
    />
    <AppStack.Screen 
      name="ListDetail" 
      component={ListDetailScreen} 
      options={{ title: 'List Details' }}
    />
    <AppStack.Screen 
      name="AddItem" 
      component={AddItemScreen} 
      options={{ 
        presentation: 'modal',
        title: 'Add New Item' 
      }} 
    />
  </AppStack.Navigator>
);

export const RootNavigator = () => {
  const { user, loading } = useAuth();
  const { isDarkMode, colors } = useAppTheme();

  // Pick the base navigation theme based on dark mode
  const navTheme = isDarkMode ? DarkTheme : DefaultTheme;
  
  // Create an extended theme to map custom colors into React Navigation if needed
  const navigationTheme = {
    ...navTheme,
    colors: {
      ...navTheme.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
});