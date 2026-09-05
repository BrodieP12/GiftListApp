# RNUILib Transition Plan

Migrate GiftListApp from its current theming system (`ThemeContext` + `useAppStyles` hook + `@rneui/themed`) to [react-native-ui-lib](https://wix.github.io/react-native-ui-lib/) (RNUILib) for all components and theming.

---

## 1. Current State Audit

### Dependencies to Remove
| Package | Used In |
|---------|---------|
| `@rneui/themed` | `CreateProfile.tsx` — `Input`, `Button`, `CheckBox` |
| `@rneui/base` | Not directly imported but listed as dependency |

### Current Theme System
| File | Purpose |
|------|---------|
| `src/theme/ThemeContext.tsx` | Custom React Context providing `colors`, `isDarkMode`, `toggleTheme` |
| `src/theme/useAppStyles.ts` | 376-line hook returning a `StyleSheet` keyed by theme colors |
| `src/theme/light-theme.css` | CSS variables for web light mode |
| `src/theme/dark-theme.css` | CSS variables for web dark mode |
| `src/theme/global-styles.css` | Global CSS classes (used via `className` in some components) |

### Files Requiring Changes

| File | What changes |
|------|-------------|
| `package.json` | Add `react-native-ui-lib`, `uilib-native`, `react-native-reanimated`; remove `@rneui/themed`, `@rneui/base` |
| `App.tsx` | Wrap app in RNUILib config; remove `ThemeProvider` |
| `src/theme/ThemeContext.tsx` | Replace with RNUILib `Colors.loadSchemes` + `Colors.loadColors` |
| `src/theme/useAppStyles.ts` | Refactor or delete — replaced by RNUILib modifiers + `ThemeManager` |
| `src/navigation/AppNavigator.tsx` | Update theme integration with RNUILib `Colors` |
| `src/screens/LoginScreen.tsx` | Replace RN primitives with RNUILib `TextField`, `Button`, `View`, `Text` |
| `src/screens/DashboardScreen.tsx` | Replace primitives with RNUILib `Card`, `Button`, `Text`, `View` |
| `src/screens/ListDetailScreen.tsx` | Replace primitives with RNUILib `View`, `Text` |
| `src/screens/AddItemScreen.tsx` | Replace `TextInput`/`Switch` with RNUILib `TextField`, `Switch`, `Button` |
| `src/screens/CreateProfile.tsx` | Replace `@rneui/themed` `Input`/`Button`/`CheckBox` with RNUILib `TextField`, `Button`, `Checkbox` |
| `src/screens/UserProfileScreen.tsx` | Stub file — update imports for RNUILib |
| `src/components/common/Button.tsx` | **DELETE** — replaced by `Button` from `react-native-ui-lib` |
| `src/components/common/FeedbackModal.tsx` | Replace `Modal`/`TextInput` with RNUILib `Dialog`, `TextField` |
| `src/components/lists/GiftItemRow.tsx` | Replace `View`/`Text`/`TouchableOpacity` with RNUILib equivalents |
| `src/components/modals/AccessDeniedModal.tsx` | Replace `Modal` with RNUILib `Dialog` |
| `src/components/modals/CreateList.tsx` | Replace `Modal` with RNUILib `Dialog` |

---

## 2. Installation & Configuration

### Step 2.1 — Install RNUILib

```bash
npm install react-native-ui-lib uilib-native react-native-reanimated
```

> **Note:** `react-native-gesture-handler` is already installed. `react-native-reanimated` is a new required peer dependency for RNUILib. After adding it, the `babel.config.js` must include the Reanimated plugin (`react-native-reanimated/plugin`).

### Step 2.2 — Remove Old Dependencies

```bash
npm uninstall @rneui/themed @rneui/base
```

### Step 2.3 — Configure Babel (Reanimated)

Add to `babel.config.js` (or create if it doesn't exist):

```js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'], // MUST be last
  };
};
```

### Step 2.4 — Configure Dark Mode Support

Add to the app's entry point (before any `react-native-ui-lib` import):

```js
require('react-native-ui-lib/config').setConfig({ appScheme: 'default' });
```

---

## 3. Theme Migration

### Step 3.1 — Replace `ThemeContext.tsx`

Create a new `src/theme/uilibTheme.ts` initialization file:

```ts
import { Colors, ThemeManager, Typography, Spacings } from 'react-native-ui-lib';

// 1. Load custom brand colors
Colors.loadColors({
  primaryColor: '#007AFF',
  dangerColor: '#FF3B30',
  warningColor: '#FF9500',
});

// 2. Load light/dark scheme overrides
Colors.loadSchemes({
  light: {
    $backgroundDefault: '#f8f9fa',
    $backgroundElevated: '#ffffff',
    $textDefault: '#000000',
    $textNeutral: '#666666',
    $outlineDefault: '#e0e0e0',
    $backgroundPrimaryHeavy: '#007AFF',
    $backgroundDangerHeavy: '#FF3B30',
  },
  dark: {
    $backgroundDefault: '#121212',
    $backgroundElevated: '#1e1e1e',
    $textDefault: '#ffffff',
    $textNeutral: '#aaaaaa',
    $outlineDefault: '#333333',
    $backgroundPrimaryHeavy: '#0A84FF',
    $backgroundDangerHeavy: '#FF453A',
  },
});

// 3. Typography presets
Typography.loadTypographies({
  heading: { fontSize: 32, fontWeight: 'bold' },
  subheading: { fontSize: 22, fontWeight: '800' },
  body: { fontSize: 16 },
  caption: { fontSize: 14, fontWeight: '600' },
  small: { fontSize: 12 },
});

// 4. Global spacing
Spacings.loadSpacings({
  page: 20,
  section: 16,
  card: 12,
});

// 5. Global component defaults using ThemeManager
ThemeManager.setComponentTheme('Button', {
  borderRadius: 8,
});

ThemeManager.setComponentTheme('TextField', {
  floatingPlaceholder: true,
});

ThemeManager.setComponentTheme('Card', {
  borderRadius: 12,
  enableShadow: true,
});
```

### Step 3.2 — Create Slim `ThemeContext.tsx` (Toggle Only)

A slim context is still needed to provide a `toggleTheme()` function and to sync RNUILib's scheme at runtime:

```ts
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from 'react-native-ui-lib';

interface ThemeContextValue {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDarkMode: false,
  toggleTheme: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark');

  useEffect(() => {
    Colors.setScheme(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme: () => setIsDarkMode(p => !p) }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### Step 3.3 — Delete Legacy Theme Files

- **DELETE** `src/theme/useAppStyles.ts` (replaced by RNUILib modifiers & design tokens)
- **DELETE** `src/theme/light-theme.css`
- **DELETE** `src/theme/dark-theme.css`
- **DELETE** `src/theme/global-styles.css`

---

## 4. Component Migration Map

### RNUILib Component Equivalents

| Current (Custom / RNEUI) | RNUILib Replacement | Import |
|--------------------------|-------------------|--------|
| Custom `Button` component | `Button` | `react-native-ui-lib` |
| RN `TextInput` | `TextField` | `react-native-ui-lib` |
| RN `View` | `View` (with modifier props) | `react-native-ui-lib` |
| RN `Text` | `Text` (with modifier props) | `react-native-ui-lib` |
| RN `TouchableOpacity` | `TouchableOpacity` or `Button` | `react-native-ui-lib` |
| RN `Modal` | `Dialog` | `react-native-ui-lib` |
| RN `Switch` | `Switch` | `react-native-ui-lib` |
| RN `FlatList` | Keep RN `FlatList` (no RNUILib equivalent) | `react-native` |
| RNEUI `Input` | `TextField` | `react-native-ui-lib` |
| RNEUI `Button` | `Button` | `react-native-ui-lib` |
| RNEUI `CheckBox` | `Checkbox` | `react-native-ui-lib` |
| Custom FAB (`TouchableOpacity`) | `FloatingButton` | `react-native-ui-lib` |
| Custom Card (`View` + shadow) | `Card` | `react-native-ui-lib` |

---

## 5. Screen-by-Screen Migration

### 5.1 — `LoginScreen.tsx`
- Replace `TextInput` → `TextField` with `floatingPlaceholder`
- Replace inline `TouchableOpacity` submit button → RNUILib `Button`
- Replace `KeyboardAvoidingView` → RNUILib `KeyboardAwareScrollView` (optional improvement)
- Use RNUILib `View` + `Text` with modifier props (`flex`, `center`, `bg-$backgroundDefault`)
- Remove `useAppStyles()` and `useAppTheme()` color lookups

### 5.2 — `DashboardScreen.tsx`
- Replace list item card `View` → RNUILib `Card`
- Replace custom FAB `TouchableOpacity` → RNUILib `FloatingButton` or keep custom with RNUILib `Button`
- Replace custom `Button` import → RNUILib `Button`
- Use `Text` modifiers: `text70`, `$textDefault`, etc.
- Remove `useAppStyles()` import

### 5.3 — `ListDetailScreen.tsx`
- Replace item row rendering to use RNUILib `View` and `Text` with modifiers
- Replace FAB label → RNUILib `FloatingButton`
- Keep `FlatList` from React Native
- Remove `useAppStyles()` import

### 5.4 — `AddItemScreen.tsx`
- Replace all `TextInput` → `TextField`
- Replace `Switch` → RNUILib `Switch`
- Replace submit `TouchableOpacity` → RNUILib `Button`
- Replace image picker placeholder → RNUILib `Card` with pressable
- Remove `useAppStyles()` import

### 5.5 — `CreateProfile.tsx`
- Replace `@rneui/themed` `Input` → RNUILib `TextField`
- Replace `@rneui/themed` `Button` → RNUILib `Button`
- Replace `@rneui/themed` `CheckBox` → RNUILib `Checkbox`
- Remove local `StyleSheet.create` styles; use modifiers
- Remove `@rneui/themed` import entirely

### 5.6 — `UserProfileScreen.tsx`
- Stub file — update imports to reference RNUILib if/when content is added

---

## 6. Reusable Component Migration

### 6.1 — `components/common/Button.tsx` → **DELETE**
Replaced entirely by `Button` from `react-native-ui-lib`. All call-sites updated to import from `react-native-ui-lib`.

### 6.2 — `components/common/FeedbackModal.tsx`
- Replace `Modal` → RNUILib `Dialog`
- Replace `TextInput` → RNUILib `TextField`
- Use RNUILib `Button` for actions
- Use modifier props instead of `className`

### 6.3 — `components/lists/GiftItemRow.tsx`
- Replace `View`/`Text` → RNUILib `View`/`Text` with modifiers
- Replace `TouchableOpacity` → RNUILib `TouchableOpacity` or `Button`
- Use design tokens (`$textDefault`, `$textNeutral`, `$backgroundPrimaryHeavy`) for colors

### 6.4 — `components/modals/AccessDeniedModal.tsx`
- Replace `Modal` → RNUILib `Dialog`
- Use RNUILib `Button` directly

### 6.5 — `components/modals/CreateList.tsx`
- Replace `Modal` → RNUILib `Dialog`
- Remove `className` usage (currently broken)
- Use RNUILib `Button` directly

---

## 7. Navigation Theme Integration

In `AppNavigator.tsx`, the `RootNavigator` maps custom `colors` to React Navigation's theme object. After migration:

```ts
import { Colors } from 'react-native-ui-lib';

// Inside RootNavigator:
const navigationTheme = {
  ...(isDarkMode ? DarkTheme : DefaultTheme),
  colors: {
    ...(isDarkMode ? DarkTheme : DefaultTheme).colors,
    background: Colors.$backgroundDefault,
    card: Colors.$backgroundElevated,
    text: Colors.$textDefault,
    border: Colors.$outlineDefault,
    primary: Colors.primaryColor,
  },
};
```

---

## 8. Migration Order (Recommended Sequence)

> [!IMPORTANT]
> Follow this order to minimize breakage. Each phase should compile before proceeding.

| Phase | Task | Risk |
|-------|------|------|
| **1** | Install deps, configure babel, add `uilib-native` | Low |
| **2** | Create `uilibTheme.ts`, update `ThemeContext` to slim version | Medium |
| **3** | Migrate `components/common/Button.tsx` → RNUILib `Button`, update all imports | Medium |
| **4** | Migrate modal components (`AccessDeniedModal`, `CreateList`, `FeedbackModal`) | Low |
| **5** | Migrate `GiftItemRow` | Low |
| **6** | Migrate screens one at a time: Login → Dashboard → ListDetail → AddItem → CreateProfile | High |
| **7** | Delete `useAppStyles.ts` and CSS theme files | Low |
| **8** | Remove `@rneui/themed` and `@rneui/base` from `package.json` | Low |
| **9** | Update `AppNavigator.tsx` navigation theme to use `Colors` | Low |
| **10** | Full regression test | — |

---

## 9. Verification Plan

### Automated Tests
- Run existing test suite to verify no regressions:
  ```bash
  npx jest --passWithNoTests
  ```
  *(Only `src/services/ListService.test.ts` exists currently)*

### Manual Verification (Per Phase)
1. After **Phase 1**: Run `npx expo start`, confirm app boots without errors
2. After **Phase 2**: Toggle dark/light mode, confirm colors change app-wide
3. After **Phase 3–5**: Navigate all screens, confirm buttons/modals/cards render correctly
4. After **Phase 6**: Full walkthrough:
   - Login screen: type email/password, toggle register/login
   - Dashboard: view lists, tap "View →", tap FAB to create list
   - ListDetail: view items, tap "+ Add Item"
   - AddItem: fill form, toggle substitutions switch, submit
   - CreateProfile: complete all 3 steps, verify checkboxes/inputs
5. After **Phase 7–8**: Confirm no import errors, `npm ls @rneui/themed` returns empty
6. After **Phase 9**: Verify navigation header colors match theme in both modes

---

## 10. Risks & Considerations

> [!WARNING]
> RNUILib's `Dialog` API differs significantly from RN's `Modal`. Props like `visible`/`transparent`/`animationType` will need to be mapped to `Dialog`'s `visible`/`overlayBackgroundColor`/`panDirection` props.

> [!CAUTION]
> `react-native-reanimated` requires a Babel plugin and may break existing Metro cache. Run `npx expo start --clear` after installation.

- **Web compatibility**: RNUILib has limited web support. `Dialog`, `FloatingButton`, and some gesture-based components may not work on web. Conditional rendering or fallbacks may be needed for the web platform.
- **Expo compatibility**: RNUILib is compatible with Expo managed workflow but `uilib-native` may require `expo prebuild` for some native features.
- **Bundle size**: RNUILib is a larger library than RNEUI. Tree-shaking and specific imports (`import {Button} from 'react-native-ui-lib'`) help mitigate this.
