# GiftListApp Codebase Audit Report

## Phase 2 Findings

### Frontend Findings

#### Bugs & Functional Issues
* **Insecure HTTP Request**: In `src/screens/CreateProfile.tsx`, if the HTTPS ipapi request fails, it falls back to an insecure `http://ip-api.com/json` request. This will fail on Android and iOS.
  * **How to Fix**: Remove the HTTP fallback entirely. Rely solely on the HTTPS endpoint. If it fails, default the country code safely or prompt the user, rather than sending insecure traffic.
* **Component Mixing**: Mixing `KeyboardAwareScrollView` inside standard views incorrectly in some places, which can lead to unexpected keyboard clipping or scrolling issues.
  * **How to Fix**: Ensure `KeyboardAwareScrollView` is the outermost scrollable container and is given `flex: 1`. Remove any redundant `ScrollView` components wrapping it.

#### React & React Native Anti-Patterns
* **Style Re-creation**: The pattern `const styles = createStyles(colors);` is used inside component bodies in multiple screens. This forces React Native to parse and recreate the stylesheet object on every render.
  * **How to Fix**: Move `StyleSheet.create` outside the component body. For theme-dependent colors, use inline styles for the color specifically, or wrap the style creation in a `useMemo` hook that depends on the theme variables.
* **FlatList Anti-Patterns**:
  * In `DashboardScreen.tsx`, the `keyExtractor` uses the array index.
    * **How to Fix**: Change to `keyExtractor={(item) => item.id}` or a similarly unique identifier.
  * In multiple lists, inline arrow functions are passed directly to `renderItem` and component props within it, defeating `React.memo`.
    * **How to Fix**: Extract the `renderItem` function to a `useCallback` or move the row logic into a dedicated, separate component wrapped in `React.memo`.
  * In `DashboardScreen.tsx`, `FlatList` is imported from `react-native-gesture-handler` instead of `react-native`.
    * **How to Fix**: Change the import to `import { FlatList } from 'react-native';`.
* **God Component (Massive State)**: `CreateProfile.tsx` manages a massive amount of state alongside complex compliance and validation logic.
  * **How to Fix**: Refactor the state management using `useReducer` to consolidate related state, or migrate the form to `React Hook Form` to handle validation and state automatically without triggering unnecessary re-renders.
* **Missing Memoization**: Components like `GiftItemRow.tsx` and `GiftListRow.tsx` receive complex props but are not wrapped in `React.memo()`.
  * **How to Fix**: Wrap the export of these row components in `React.memo(...)`. Make sure any functions passed to them as props (like `onPress`) are wrapped in `useCallback` in the parent.

#### UI & UX
* `AddItemScreen.tsx` hardcodes the aspect ratio for ImagePicker `aspect: [4, 3]`.
  * **How to Fix**: Change the aspect ratio to `[1, 1]` to match the square thumbnails used elsewhere in the UI.

---

### Security Findings

#### Bugs & Vulnerabilities
* **Insecure RNG**: `generateShareCode` in `ListService.ts` uses `Math.random()`. This is not cryptographically secure, making it easy to guess or brute-force share codes and exposing private lists.
  * **How to Fix**: Replace `Math.random()` with `crypto.getRandomValues()` if available, or use a secure random library like `react-native-get-random-values` alongside `nanoid`.
* **Client-Side Role Assignment**: In `ListService.ts`'s `createList`, the client explicitly upserts the list owner role.
  * **How to Fix**: Remove the client-side upsert entirely. Create a Supabase PostgreSQL trigger that automatically inserts the 'owner' record into `list_members` whenever a new row is inserted into `lists`.
* **Mixed Backend Dependencies**: The app rules state Firebase is the backend, but `AuthService.ts` and `ListService.ts` use Supabase.
  * **How to Fix**: Complete the migration. Remove all Firebase dependencies from `package.json` (except Crashlytics/Analytics if explicitly needed), delete the orphaned `functions/` directory, and update `GEMINI.md` to reflect that Supabase is the actual backend.

---

### Backend & Architecture Findings

#### 1. Incomplete Supabase Migration & Dead Firebase Code
* **Issue**: The application claims to have migrated Auth and Firestore to Supabase, but `functions/src/` still contains multiple Firebase Cloud Functions (e.g., `createList.ts`, `onListCreated.ts`).
* **How to Fix**: Delete the `functions/` directory entirely. Port any still-required business logic (like product extraction) to Supabase Edge Functions or Postgres Triggers.

#### 2. Client-Side Share Code Generation (Data Integrity)
* **Issue**: In `src/services/ListService.ts`, the frontend generates a 7-character random share code directly, with no collision checking.
* **How to Fix**: Move the share code generation to a Supabase RPC (Stored Procedure). The RPC should handle the generation, check for collisions, insert the list, and return the new list ID and share code in a single atomic transaction.

#### 3. N+1 Queries and Inefficient Data Fetching
* **Issue**: In `MessageService`, the client loops through conversation IDs and fires a separate query for each to fetch the last message. In `ClaimService`, it does a redundant 2-step query.
* **How to Fix**: 
  * For `MessageService`: Create a Postgres View or RPC in Supabase that joins the conversations with their latest message, allowing the client to fetch everything in one single query.
  * For `ClaimService`: Remove the preliminary query to `items`. Just query `claims` directly using `.eq('list_id', listId)`.

#### 4. Massive Over-Fetching via Unfiltered Realtime Subscriptions
* **Issue**: Realtime listeners in `ClaimService`, `FriendService`, and `MessageService` omit proper filters, listening to global database changes.
* **How to Fix**: Add `.filter('col=eq.val')` to the `on('postgres_changes')` configuration in every channel subscription. (e.g., filter `MessageService` by `conversation_id`, and `FriendService` by `user_id`).

#### 5. Inefficient `ilike` Query Leading to Table Scans
* **Issue**: In `UserService.searchUsersByEmail`, the query uses `.ilike('email', '%${query}%')` forcing a full table scan.
* **How to Fix**: Remove the leading `%` to utilize index-based prefix matching (`.ilike('email', '${query}%')`), or implement Postgres Full Text Search if mid-string matching is strictly required.

#### 6. Inefficient Listeners (Socket Duplication)
* **Issue**: In `ListService.ts`, the frontend creates a completely new Supabase realtime channel every time a listener is mounted (appending `Date.now()` to the channel name).
* **How to Fix**: Hardcode a deterministic channel name based on the entity ID (e.g., `lists:owner:${userId}`). Supabase will safely reuse or manage the channel without spawning endless duplicate connections.

---

### Testing & Verification Findings

#### Bugs & Broken Configurations
* **Test Suite Failures**: The Jest test suite completely fails to run out of the box (17 failed suites, 1 passed).
  * **How to Fix**: Run `npm uninstall @react-native-firebase/firestore` (and other unused Firebase modules).
* **Missing Mocks**: Tests crash because `@react-native-async-storage/async-storage` and `@react-native-firebase/firestore` are not properly mocked.
  * **How to Fix**: Add a `jest.setup.js` file and include `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));`.
* **Missing Dependencies in Tests**: Cloud function tests crash due to a missing `@google/genai` module.
  * **How to Fix**: Since the cloud functions are dead code (as per the Backend findings), delete the `functions/` folder and its associated tests entirely rather than fixing them.
