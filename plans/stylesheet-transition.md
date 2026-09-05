# Stylesheet Transition Plan

## 1. Objective Focus
The goal is to consolidate all scattered stylesheets from individual React Native components and screens into centralized CSS files within the `theme` directory. This will improve maintainability, allow for easy color management using CSS variables, and provide clear separation for light and dark themes.

## 2. Directory Structure Updates
- **Source of Styles**: Scan through all files in `src/components/`, `src/screens/`, and related UI directories.
- **Target CSS Files**:
  - `src/theme/light-theme.css`
  - `src/theme/dark-theme.css`
  - `src/theme/global-styles.css` (Optional: for structural styles shared between themes)

## 3. Step-by-Step Execution Plan

### Step 1: CSS File Setup & Variable Definition
Create the core CSS files in the `src/theme` directory. At the top of these files, define CSS custom properties (variables) for all theme tokens (colors, text sizes, spacing).

**`src/theme/light-theme.css`**
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f2f2f2;
  --text-primary: #333333;
  --text-secondary: #666666;
  --accent-color: #007bff;
  --border-color: #e0e0e0;
}
```

**`src/theme/dark-theme.css`**
```css
:root {
  --bg-primary: #121212;
  --bg-secondary: #1e1e1e;
  --text-primary: #ffffff;
  --text-secondary: #b3b3b3;
  --accent-color: #bb86fc;
  --border-color: #333333;
}
```

### Step 2: Extract Existing Styles
1. Systematically open every `.tsx` and `.ts` file containing UI code.
2. Locate the `StyleSheet.create({...})` instances or inline `style={{...}}` props.
3. Map these styles contextually. For example, a `container` style in `DashboardScreen.tsx` should be translated into a CSS class like `.dashboard-container`.

### Step 3: Write Extracted Styles to CSS
Populate the new CSS files with the extracted styles, replacing hardcoded color values with the newly defined CSS variables.

```css
/* Example extrapolated from a component */
.dashboard-container {
  flex: 1;
  background-color: var(--bg-primary);
  padding: 16px;
}

.title-text {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
}
```

### Step 4: Import and Apply CSS in Components
1. **ThemeContext Integration**: Modify `src/theme/ThemeContext.tsx` to use the updated stylesheets. It must manage the application of light or dark CSS logic at the root level based on the current theme state.
2. **Importing**: Ensure the CSS files are imported at the top-level of the app (e.g., `App.tsx` or `index.js`), or within the specific files being styled (depending on the project's bundler and web support configuration for Expo/React Native).
3. **Applying**: Refactor components to use the standard web `className` attribute (if explicitly targeting React Native Web with CSS enabled) or mapping tools if keeping native compatibility, switching away from the `style={styles.container}` syntax.

### Step 5: Testing and Validating
- Validate the UI renders correctly on the web version.
- Toggle between light and dark themes to ensure CSS variable fallbacks and overrides transition smoothly.
- Inspect the console to fix any CSS syntax errors or unapplied class names.

### Step 6: Cleanup
- Delete all `StyleSheet.create({...})` blocks from the component files.
- Remove unused imports like `StyleSheet` from `react-native`.
