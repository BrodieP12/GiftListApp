import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

// --- 1. Parameter Lists ---
// Define what parameters each screen accepts.
// 'undefined' means the screen takes no parameters.

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined; // Optional if you split them later
};

export type AppStackParamList = {
  Dashboard: undefined;
  
  ListDetail: { 
    listId: string; 
    ownerId: string; 
    title?: string; // Optional: Pass title to set header immediately
  };
  
  AddItem: { 
    listId: string; 
  };
};

// --- 2. Helper Types for Screens ---
// Use these in your components to type 'navigation' and 'route' props automatically.

// Example: export type DashboardScreenProps = AppNavProps<'Dashboard'>;
export type AppNavProps<T extends keyof AppStackParamList> = {
  navigation: StackNavigationProp<AppStackParamList, T>;
  route: RouteProp<AppStackParamList, T>;
};

export type AuthNavProps<T extends keyof AuthStackParamList> = {
  navigation: StackNavigationProp<AuthStackParamList, T>;
  route: RouteProp<AuthStackParamList, T>;
};