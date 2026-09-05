# Web Upgrade Plan for GiftListApp

This project is currently built with Expo (SDK ~54) and React Native. The bare minimum for web support (`react-native-web` and `react-dom`) is already installed. However, to fully upgrade and optimize this application for a first-class React web experience, the following steps are required.

## 1. Missing Web Dependencies

Expo SDK 54 uses Metro as the default web bundler. To ensure error reporting and fast refresh work correctly on the web, we need to install the Metro runtime.

*   **Install:** `npx expo install @expo/metro-runtime`

## 2. Configuration Updates (`app.json`)

Ensure that Expo is explicitly configured to use the Metro bundler for the web (this is usually the default in SDK 50+, but best to ensure readiness).

*   **Modify `app.json`:**
    ```json
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    }
    ```

## 3. Navigation and Deep Linking

Currently, the app uses React Navigation. For a web application, URL paths are critical for sharing links (e.g., sharing a specific list). 

*   **Action:** Add a `linking` configuration to the `<NavigationContainer>` in `App.tsx` (or `AppNavigator.tsx`) to map screens to URL paths (e.g., `ListDetailScreen` -> `/list/:id`).

## 4. UI Library Compatibility & Responsive Design

The app uses `@rneui/themed` (React Native Elements). This library is generally web-compatible, but the layout might currently be optimized for mobile screens (portrait).

*   **Action:** Review screens like `DashboardScreen` and `ListDetailScreen`. Add media queries or responsive breakpoints (e.g., using `Platform.OS === 'web'` or screen dimensions) to utilize the extra horizontal space on desktop browsers.
*   **Action:** Ensure interactions like `react-native-gesture-handler` (used for swipes/pan) function correctly with mouse events on the web.

## 5. Firebase Web Configuration

The app uses Firebase SDK v12. Firebase seamlessly handles Web and React Native, but we need to ensure the persistent storage adapter for Authentication is web-compatible.

*   **Action:** Verify inside `src/api/firebase.ts` that if `initializeAuth` is used with a custom AsyncStorage persistence, it falls back to standard web persistence (IndexedDB/LocalStorage) when running on the web.

## 6. Build and Test

*   **Execution:** Run `npm run web` (or `npx expo start --web`) to start the development server.
*   **Manual Testing:** 
    *   Verify login/signup flows via Firebase.
    *   Verify list creation and the UI rendering on larger screens.
    *   Ensure the 7-character list sharing code flow works via web URLs.
