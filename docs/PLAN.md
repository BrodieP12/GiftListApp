# App Setup and Verification Plan

## 1. Emulator Verification
- Ensure the newly created Android emulator (`Stable_Phone_API_31`) is fully booted and running.

## 2. Build and Install App
- Execute `npx expo run:android` in the project root (`c:\Users\Brodie\Downloads\GiftListApp-main`).
- This step is critical because `posthog-react-native` requires native modules, which means a custom development build (Expo dev client) must be compiled and installed on the emulator.
- Monitor the output to ensure the Android build succeeds and the app is installed onto the emulator.

## 3. Metro Bundler / Server Start
- `npx expo run:android` typically starts the Metro bundler. If it is running, keep it active.
- If it did not start or needs to be restarted, run `npx expo start --dev-client` (or similar command to start the bundler for the dev build).

## 4. TypeScript Verification
- Run `npx tsc --noEmit` (or whatever the project's typecheck script is) in the project root.
- Ensure that there are zero TypeScript compilation errors, particularly relating to the recent PostHog configuration changes in `AppNavigator.tsx` and `useAuth.ts`.

## 5. Application Verification
- Confirm that the app launches successfully on the Android emulator and connects to the Metro bundler without runtime errors or crashes.
- (Optional but recommended) Briefly check the emulator logcat or Metro logs for any obvious PostHog initialization issues.
