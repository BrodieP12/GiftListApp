import React, { ReactNode } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../theme/ThemeContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { AddItemScreen } from '../screens/AddItemScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { ListEditScreen } from '../screens/ListEditScreen';
import { CreateProfile } from '../screens/CreateProfile';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';

import ProfileImage from '../components/common/ProfileImage'

export type AuthStackParamList = {
  Login: undefined;
  CreateProfile: undefined;
  ForgotPassword: undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
  ListDetail: { listId: string; ownerId: string };
  AddItem: { listId: string };
  ListEdit: { listId: string };
  UserProfileScreen: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();
const AppStack = createStackNavigator<AppStackParamList>();

const AuthNavigator = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen 
      name="Login" 
      component={LoginScreen} 
      options={{ headerShown: false }} 
    />
    <AuthStack.Screen
      name="CreateProfile"
      component={CreateProfile}
      options={{
        title: 'Create Profile',
        headerTintColor: '#007AFF', // Match the primary color
      }}
    />
    <AuthStack.Screen
      name="ForgotPassword"
      component={ForgotPasswordScreen}
      options={{
        title: 'Reset Password',
        headerTintColor: '#007AFF',
      }}
    />
  </AuthStack.Navigator>
);

const AppNavigator = () => {
  const { user } = useAuth();
  return (
    <AppStack.Navigator>
      <AppStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: 'My Lists',
          headerRight: () => (
             <View style={{marginRight: 20}}>
            <ProfileImage
              email={user?.email ?? ''}
              givenName={user?.givenName ?? ''}
              familyName={user?.familyName ?? ''}
              onPress={() => navigation.navigate('UserProfileScreen')}
            />
            </View>
          )
        })}
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
      <AppStack.Screen
        name="UserProfileScreen"
        component={UserProfileScreen}
        options={{ title: 'My Profile' }}
      />
      <AppStack.Screen
        name="ListEdit"
        component={ListEditScreen}
        options={{ title: 'Edit List' }}
      />
    </AppStack.Navigator>
  )
};

export const RootNavigator = () => {
  const { user, loading } = useAuth();
  const { isDark, colors } = useAppTheme();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Create a custom React Navigation theme mapping to our custom palette
  const appNavigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <NavigationContainer theme={appNavigationTheme}>
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