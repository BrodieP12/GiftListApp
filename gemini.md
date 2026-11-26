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

## Release Build & Deployment Protocol (Mandatory)

Whenever a significant feature, major change, or resolved set of bugs is finalized:
1. **Version Bump:**
   - Increment `version` (e.g., `1.0.13`) and `android.versionCode` (e.g., `14`) in `app.json`.
2. **Build Production Binaries:**
   - Compile both the release Android App Bundle (.aab) and APK:
     ```bash
     cd android
     ./gradlew assembleRelease bundleRelease
     ```
   - Verify outputs in `android/app/build/outputs/apk/release/app-release.apk` and `android/app/build/outputs/bundle/release/app-release.aab`.
3. **Archive Build Artifacts on Portal (`node-123`):**
   - Upload both binaries to the gated versioned archive directory on `node-123` (served only after Discord OTP authentication via `portal_auth.py` and Nginx `X-Accel-Redirect`):
     - Remote path: `/root/giftlist-portal/giftlistapp/builds/v{version}/GiftListApp.apk`
     - Remote path: `/root/giftlist-portal/giftlistapp/builds/v{version}/GiftListApp.aab`
   - Update only the latest family & friends APK at the portal root (do NOT expose `.aab` files publicly):
     - Remote path: `/root/giftlist-portal/giftlistapp/GiftListApp.apk`
4. **Update Build Registry (`builds.json`):**
   - Append the new release record to `/root/giftlist-portal/giftlistapp/builds/builds.json` and `scratch/builds.json`:
     ```json
     {
       "version": "1.0.X",
       "buildNumber": 14,
       "date": "YYYY-MM-DD",
       "title": "Milestone Title",
       "changelog": "Description of what is new in the build and bugs resolved.",
       "apkUrl": "builds/v1.0.X/GiftListApp.apk",
       "aabUrl": "builds/v1.0.X/GiftListApp.aab",
       "apkSize": "104 MB",
       "aabSize": "69 MB"
     }
     ```
5. **Update Portal Page:**
   - Update `scratch/index.html` download references (`?v=1.0.X`) and footer version string, then upload to `node-123` at `/root/giftlist-portal/giftlistapp/index.html`.

