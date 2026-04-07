# GiftListApp - Project Summary

## Overview
GiftListApp is a cross-platform mobile application built to help users seamlessly create, manage, and share gift lists. It's built with React Native and Expo, utilizing Firebase as the backend for authentication and database management. The primary entity is a "List", which can contain multiple "Items" and be shared with other users via a unique 7-character code.

## Technology Stack
- **Framework:** React Native (v0.81.x) with Expo (v54.x)
- **Language:** TypeScript
- **Navigation:** React Navigation v7 (Stack and Native)
- **UI & Styling:** `@rneui/themed` (React Native Elements) and custom stylesheet implementations.
- **Backend:** Firebase (v12.9.0)
  - **Database:** Firestore (Collections: `lists`, internal subcollections: `items`)
  - **Auth:** Firebase Authentication
- **Ads:** React Native Google Mobile Ads

## Key Features & Architecture

### 1. Navigation Flow
The app uses a Stack Navigator (`AppNavigator.tsx`), conditionally rendering based on user authentication state managed by the `useAuth` hook.
- **Unauthenticated:** Shows `LoginScreen`
- **Authenticated:** Shows `DashboardScreen` (Home), `ListDetailScreen`, and `AddItemScreen` (Modal presentation).

### 2. State & Theming
- **Theming:** Implements custom Light/Dark themes using a `ThemeProvider` context (`src/theme/ThemeContext`). This theme extends and maps directly to the React Navigation theme configuration to ensure seamless transitions.
- **Authentication:** Wrapped globally via an `AuthProvider` (`src/hooks/useAuth.tsx`), managing user login states.

### 3. Services & Data Management
Data fetching and backend logic are strictly encapsulated within dedicated service files (`src/services/`):
- **`ListService.ts`:** Handles CRUD for lists and items. Implements Firebase Transactions to handle and resolve list share-code collisions robustly.
- **`AuthService.ts`:** Manages user authentication functions.
- **`AdsService.ts`:** Configuration for integrating and displaying advertisements.
- **Other Services:** `ClaimService.ts`, `FeedbackService.ts`, `RetailerService.ts`.

### 4. Folder Structure
- `/src/components/`: Reusable, purely presentational UI components (buttons, list rows, form inputs).
- `/src/screens/`: High-level view components connected to routes (e.g., `DashboardScreen`, `ListDetailScreen`).
- `/src/services/`: Pure functions and helpers for backend integrations via Firebase.
- `/src/navigation/`: Route definitions and navigation configuration.
- `/src/theme/`: Constants and React Context for app-wide UI consistency.
- `/src/hooks/`: Custom React hooks, notably `useAuth`.
- `/src/types/`: Centralized TypeScript interfaces (e.g., `GiftList`, `GiftItem` models).

## Development Guidelines
- Always use the `ListService` or respective service classes rather than making direct Firestore calls inside the screens.
- Keep the UI components functional and use styling derived from `useAppTheme()` to consistently support Light/Dark mode toggles.
- Firebase initializations and basic references should be loaded from `src/api/`.

## User Rules Reference
- When resolving library documentation or setup config (e.g. for context7), explicitly use Context7 MCP tools.
- Alpha Vantage API is available with the provided API Key if backend external integrations are needed in the future.
