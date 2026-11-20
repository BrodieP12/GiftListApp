# GiftListApp - Project Summary

## Overview
GiftListApp is a cross-platform mobile application built to help users seamlessly create, manage, and share gift lists. It is built with React Native and Expo, utilizing Supabase as the exclusive backend for database, authentication, realtime synchronization, storage, and edge functions. Telemetry and error tracking are handled via PostHog and Supabase. The primary entity is a "List", which can contain multiple "Items" and be shared with other users via a unique share code.

## Technology Stack
- **Framework:** React Native (v0.81.x) with Expo (v54.x)
- **Language:** TypeScript
- **Navigation:** React Navigation v7 (Stack and Bottom Tabs)
- **UI & Styling:** Tailwind CSS / NativeWind and custom stylesheet implementations.
- **Backend:** Supabase
  - **Database:** PostgreSQL (Tables: `lists`, `items`, `profiles`, `friendships`, `claims`, `conversations`, `messages`, `feedback`, `error_logs`)
  - **Auth:** Supabase Auth (`@supabase/supabase-js`)
  - **Storage:** Supabase Storage (`item-images`)
  - **Functions:** Supabase Edge Functions (`moderate-and-upload-image`, `fetch-item-metadata`)
- **Telemetry & Analytics:** PostHog (`posthog-react-native`) and per-account Supabase error logging

## Key Features & Architecture

### 1. Navigation Flow
The app uses a Stack Navigator (`AppNavigator.tsx`), conditionally rendering based on user authentication state managed by the `useAuth` hook.
- **Unauthenticated:** Shows `LoginScreen`
- **Authenticated:** Shows `DashboardScreen` (Home), `ListDetailScreen`, `AddItemScreen`, and tab flows.

### 2. State & Theming
- **Theming:** Implements custom Light/Dark themes using a `ThemeProvider` context (`src/theme/ThemeContext`).
- **Authentication:** Wrapped globally via an `AuthProvider` (`src/hooks/useAuth.tsx`), managing user login states.

### 3. Services & Data Management
Data fetching and backend logic are strictly encapsulated within dedicated service files (`src/services/`):
- **`ListService.ts`:** Handles CRUD for lists and items via Supabase PostgREST and Realtime.
- **`AuthService.ts`:** Manages user authentication functions with Supabase Auth.
- **`LoggingService.ts`:** App flow logging and error diagnostics integrated with PostHog and Supabase.
- **`ClaimService.ts`:** Handles item reservation and claim tracking.
- **`FriendService.ts`:** Manages friend lists and requests.
- **`MessageService.ts`:** Handles direct messaging and conversations.
- **`ImageUploadService.ts`:** Image compression and moderation via Supabase Edge Function & Storage.
- **`RetailerService.ts`:** Web scraping and product metadata extraction via Supabase Edge Functions.

### 4. Folder Structure
- `/src/components/`: Reusable, presentational UI components.
- `/src/screens/`: High-level view components connected to routes (e.g., `DashboardScreen`, `ListDetailScreen`).
- `/src/services/`: Pure functions and helpers for backend integrations via Supabase.
- `/src/navigation/`: Route definitions and navigation configuration.
- `/src/theme/`: Constants and React Context for app-wide UI consistency.
- `/src/hooks/`: Custom React hooks, notably `useAuth`.
- `/src/types/`: Centralized TypeScript interfaces.

## Development Guidelines
- Always use the `ListService` or respective service classes rather than making direct database calls inside screens.
- Keep UI components functional and use styling derived from `useAppTheme()` to consistently support Light/Dark mode toggles.
- Supabase initialization and client references are loaded from `src/api/supabase.ts`.
- Firebase has been completely removed from this project. Do not re-introduce `@react-native-firebase` or Google Services configurations.
