# Package Audit Plan — GiftListApp

> Audit date: 2026-03-25  
> Audited against: `package.json` and all source files in `src/`

---

## Summary

| Category | Count | Action Required |
|---|---|---|
| ✅ Secure & Used | 22 | None |
| ⚠️ Security Concerns | 1 | Upgrade |
| 🔴 Unmaintained / Stale | 1 | Replace |
| 🗑️ Unused | 5 | Uninstall |
| 📦 Deprecated (dev) | 1 | Replace |

---

## 1. Unused Packages — Uninstall

These packages are installed but have **zero imports** anywhere in the codebase.

| Package | Installed Version | Reason for Removal |
|---|---|---|
| `@fortawesome/fontawesome-svg-core` | ^7.2.0 | No imports found. App migrated to `react-native-ui-lib` icons. |
| `react-native-floating-action` | ^1.22.0 | No imports found. FAB functionality not used. |
| `react-native-image-picker` | ^8.2.1 | No imports found. App uses `expo-image-picker` instead. |
| `uilib-native` | ^5.0.1 | No imports found. Likely a leftover from evaluating UI libraries. |
| `initials` | ^3.1.2 | No imports found. `react-native-user-avatar` handles initials internally. |

### Action
```bash
npm uninstall @fortawesome/fontawesome-svg-core react-native-floating-action react-native-image-picker uilib-native initials
```

---

## 2. Security Concern — Upgrade Required

### `axios` (^1.13.5) — Multiple CVEs

| CVE | Severity | Description | Fixed In |
|---|---|---|---|
| CVE-2024-39338 | High | SSRF via path-relative URL handling | ≥ 1.7.4 |
| CVE-2025-27152 | High | SSRF & credential leakage with absolute URLs | ≥ 1.8.2 |
| CVE-2025-58754 | High | DoS via unbounded `data:` URL memory allocation | ≥ 1.12.0 |

> [!IMPORTANT]
> The installed version `^1.13.5` should resolve to a version that includes all three patches (≥ 1.13.5), but you must verify the actual resolved version in `package-lock.json`. If the lockfile pins an older version, run the upgrade command below.

### Action
```bash
npm update axios
# Verify the resolved version:
npm ls axios
```
Ensure the resolved version is **≥ 1.13.5**. If using the `fetch` API is feasible for the single usage in `CreateProfile.tsx` (a simple GET to `https://ipapi.co/json/`), consider removing `axios` entirely in favor of the built-in `fetch`, removing the dependency altogether.

#### Optional: Replace with `fetch`
In `src/screens/CreateProfile.tsx`, the only usage is:
```typescript
const response = await axios.get('https://ipapi.co/json/');
```
This can be replaced with:
```typescript
const response = await fetch('https://ipapi.co/json/');
const data = await response.json();
```
Then uninstall axios:
```bash
npm uninstall axios
```

---

## 3. Unmaintained Package — Replace

### `react-native-user-avatar` (^1.0.8) — Last updated 4+ years ago

- **Status:** No known CVEs, but the package has not been updated in over 4 years.
- **Risk:** No compatibility guarantees with React Native 0.81+ or the new architecture.
- **Used in:** `src/navigation/AppNavigator.tsx`

### Recommended Replacement: `react-native-ui-lib` Avatar

Since the app already uses `react-native-ui-lib` extensively, use its built-in `Avatar` component instead of adding another dependency.

### Action
1. Replace the import in `AppNavigator.tsx`:
   ```diff
   -import UserAvatar from 'react-native-user-avatar';
   +import { Avatar } from 'react-native-ui-lib';
   ```
2. Update the component usage to use `Avatar` with `label` prop for initials.
3. Remove the type declaration in `src/types/react-native.d.ts` (the `declare module 'react-native-user-avatar'` block).
4. Uninstall the old package:
   ```bash
   npm uninstall react-native-user-avatar
   ```

---

## 4. Deprecated Dev Dependency — Replace

### `@testing-library/jest-native` (^5.4.3) — Deprecated

- **Status:** Officially deprecated. Matchers are now built into `@testing-library/react-native` ≥ 12.4.
- **Used:** Not directly imported in any source files (loaded via Jest config).

### Action
1. Install the replacement:
   ```bash
   npm install --save-dev @testing-library/react-native
   ```
2. Update Jest setup to use the new built-in matchers (see [migration guide](https://callstack.github.io/react-native-testing-library/docs/migration/jest-native)).
3. Uninstall the deprecated package:
   ```bash
   npm uninstall @testing-library/jest-native
   ```

---

## 5. Peer / Indirect Dependencies — Keep

These packages have **no direct imports** in source code but are **required as peer dependencies** by other installed packages. **Do not remove them.**

| Package | Required By | Notes |
|---|---|---|
| `react-native-reanimated` (^4.3.0) | `react-native-ui-lib`, `react-native-gesture-handler` | Animation engine used internally |
| `react-native-web` (^0.21.0) | Expo web platform | Required for `expo start --web` |
| `@react-native-vector-icons/fontawesome` (^12.5.0) | `react-native-ui-lib` | Icon provider |
| `@react-native-vector-icons/material-icons` (^12.5.0) | `react-native-ui-lib` | Icon provider |
| `react-dom` (19.1.0) | React web rendering | Required for web platform |
| `@expo/metro-runtime` (~6.1.2) | Expo | Metro bundler runtime |

---

## 6. Secure & Active — No Action Required

All remaining packages are actively maintained, have no known vulnerabilities, and are in active use:

| Package | Status |
|---|---|
| `react` | ✅ Core framework |
| `react-native` | ✅ Core framework |
| `expo` | ✅ Core framework |
| `expo-status-bar` | ✅ Used by Expo |
| `expo-image-picker` | ✅ Used in `AddItemScreen.tsx` |
| `expo-application` | ✅ Used in `FeedbackService.ts` |
| `firebase` | ✅ Used in `firebase.ts` and services |
| `@react-native-async-storage/async-storage` | ✅ Used in `firebase.ts` |
| `@react-native-community/datetimepicker` | ✅ Used in `CreateProfile.tsx` |
| `@react-navigation/native` | ✅ Used in navigation |
| `@react-navigation/stack` | ✅ Used in `AppNavigator.tsx` |
| `react-native-gesture-handler` | ✅ Required by React Navigation |
| `react-native-safe-area-context` | ✅ Required by React Navigation |
| `react-native-screens` | ✅ Required by React Navigation |
| `react-native-ui-lib` | ✅ Primary UI library (13 files) |
| `react-native-google-mobile-ads` | ✅ Used in `AdsService.ts` |
| `typescript` (dev) | ✅ Language |
| `jest` / `jest-expo` (dev) | ✅ Test runner |
| `@types/react` / `@types/jest` (dev) | ✅ Type definitions |
| `react-test-renderer` (dev) | ✅ Required by jest-expo |

---

## Execution Checklist

- [x] **Step 1:** Uninstall 5 unused packages
- [x] **Step 2:** Verify/upgrade `axios` to ≥ 1.13.5 (or replace with `fetch`)
- [x] **Step 3:** Replace `react-native-user-avatar` with `react-native-ui-lib` Avatar
- [x] **Step 4:** Replace `@testing-library/jest-native` with `@testing-library/react-native`
- [x] **Step 5:** Run `npx expo start` to verify app still compiles
- [x] **Step 6:** Run `npm test` to verify tests still pass
