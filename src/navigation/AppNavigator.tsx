/**
 * AppNavigator.tsx
 *
 * Defines the entire app's navigation structure and is the single place
 * that auth-gates routes: {@link RootNavigator} renders either the
 * unauthenticated {@link AuthNavigator} (Login / CreateProfile) or the
 * authenticated {@link AppTabs} bottom-tab navigator, based on `useAuth()`'s
 * `user` state, showing a loading spinner while that state is being
 * resolved. There is no per-screen auth check elsewhere — being inside
 * `AppTabs` at all implies the user is signed in.
 *
 * `AppTabs` is a 4-tab bottom navigator (Lists / Friends / Messages /
 * Profile), each tab hosting its own stack navigator so screens can push
 * deeper (e.g. Dashboard -> ListDetail -> AddItem) without leaving that
 * tab's context. Also builds a `react-navigation` theme object from the
 * app's own `ThemeContext` colors so native navigation chrome (header,
 * tab bar) matches the app's light/dark theme rather than react-navigation's
 * defaults.
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../theme/ThemeContext';
import { LoginScreen } from '../screens/LoginScreen';
import { CreateProfile } from '../screens/CreateProfile';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { AddItemScreen } from '../screens/AddItemScreen';
import { ListEditScreen } from '../screens/ListEditScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ConversationScreen } from '../screens/ConversationScreen';

/** Screens available before the user is signed in. */
export type AuthStackParamList = {
  Login: undefined;
  CreateProfile: undefined;
};

/** Screens available once the user is signed in, with their route params.
 * Note: several of these (`ListDetail`, `AddItem`, `ListEdit`) carry a
 * `listId`, and `ListDetail` additionally carries `ownerId` so the detail
 * screen can determine claim-visibility (owner vs. non-owner) without an
 * extra fetch. */
export type AppStackParamList = {
  Dashboard: undefined;
  ListDetail: { listId: string; ownerId: string };
  AddItem: { listId: string };
  ListEdit: { listId: string };
  UserProfileScreen: undefined;
  Friends: undefined;
  Conversations: undefined;
  Conversation: { conversationId: string };
};

export type TabParamList = {
  ListsTab: undefined;
  FriendsTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();
const AppStack = createStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/** Stack shown to signed-out users: Login, then CreateProfile for new
 * sign-ups (header shown only on CreateProfile since Login has its own
 * custom header-less design). */
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen
      name="CreateProfile"
      component={CreateProfile}
      options={{ headerShown: true, title: 'Create Account' }}
    />
  </AuthStack.Navigator>
);

/** "Lists" tab stack: Dashboard (list of the user's/shared lists) -> list
 * detail -> add/edit item screens. `AddItem` is presented as a modal sheet
 * rather than a pushed screen. */
const ListsStack = () => (
  <AppStack.Navigator>
    <AppStack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'My Lists' }} />
    <AppStack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: 'List Details' }} />
    <AppStack.Screen name="AddItem" component={AddItemScreen} options={{ presentation: 'modal', title: 'Add Item' }} />
    <AppStack.Screen name="ListEdit" component={ListEditScreen} options={{ title: 'Edit List' }} />
  </AppStack.Navigator>
);

/** "Friends" tab stack: currently a single-screen stack for the friends
 * list/friend-request UI. */
const FriendsStack = () => (
  <AppStack.Navigator>
    <AppStack.Screen name="Friends" component={FriendsScreen} options={{ title: 'Friends' }} />
  </AppStack.Navigator>
);

/** "Messages" tab stack: conversation list -> an individual conversation's
 * thread. */
const MessagesStack = () => (
  <AppStack.Navigator>
    <AppStack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Messages' }} />
    <AppStack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Chat' }} />
  </AppStack.Navigator>
);

/** "Profile" tab stack: the signed-in user's own profile/settings screen. */
const ProfileStack = () => (
  <AppStack.Navigator>
    <AppStack.Screen name="UserProfileScreen" component={UserProfileScreen} options={{ title: 'Profile' }} />
  </AppStack.Navigator>
);

/**
 * Bottom tab navigator shown to authenticated users. Each tab hosts its own
 * independent stack (`ListsStack`/`FriendsStack`/`MessagesStack`/
 * `ProfileStack`) so navigating deeper within a tab doesn't affect the
 * other tabs' navigation state. Tab bar colors are pulled from the app's
 * theme (`useAppTheme`) so the tab bar matches light/dark mode.
 */
const AppTabs = () => {
  const { colors } = useAppTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            ListsTab: 'gift',
            FriendsTab: 'user-friends',
            MessagesTab: 'comment-alt',
            ProfileTab: 'user',
          };
          return <FontAwesome5 name={icons[route.name]} size={size - 2} color={color} solid />;
        },
        // NOTE: This screenOptions-level tabBarLabel always renders `null`
        // (the `labels` map it builds is unused/dead) — but each
        // individual <Tab.Screen> below sets its own `options.tabBarLabel`
        // string (e.g. 'Lists', 'Friends'), which takes precedence, so tab
        // labels do still show correctly in practice.
        tabBarLabel: ({ color }) => {
          const labels: Record<string, string> = {
            ListsTab: 'Lists',
            FriendsTab: 'Friends',
            MessagesTab: 'Messages',
            ProfileTab: 'Profile',
          };
          return null; // labels rendered by tabBarLabel default
        },
      })}
    >
      <Tab.Screen name="ListsTab" component={ListsStack} options={{ tabBarLabel: 'Lists' }} />
      <Tab.Screen name="FriendsTab" component={FriendsStack} options={{ tabBarLabel: 'Friends' }} />
      <Tab.Screen name="MessagesTab" component={MessagesStack} options={{ tabBarLabel: 'Messages' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
};

/**
 * Top-level navigator and the app's auth gate. While the auth state is
 * still being resolved (`loading`), shows a full-screen spinner instead of
 * any navigator (avoids a flash of the login screen for already-authenticated
 * users whose session is still being restored from storage). Once resolved,
 * renders `AppTabs` for a signed-in `user` or `AuthNavigator` otherwise —
 * this single branch is the entire routing-level auth guard for the app.
 */
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

  // Merge the app's own theme colors into react-navigation's base
  // Default/Dark theme so native chrome (headers, tab bar, screen
  // background) matches the app's light/dark mode instead of
  // react-navigation's own default palette.
  const navTheme = {
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

  // The auth gate: signed-in users get the full tabbed app; anyone else
  // (including a just-signed-out user) is dropped back to the auth flow.
  return (
    <NavigationContainer theme={navTheme}>
      {user ? <AppTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
