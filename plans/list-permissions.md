# Plan: Enforcing List Access Permissions in ListDetailScreen

## Objective
Prevent unauthorized access to lists via direct URLs by checking if the user is the owner or explicitly allowed via code sharing. If unauthorized, display a modal to block access and route the user back.

## 1. Data Layer (`src/services/ListService.ts`)
- **Add `getListById(listId: string)` method**: Currently, `ListService.ts` fetches owned lists, shared lists, and items for a list, but lacks a method to fetch a single list's metadata. 
- The new method will fetch the document at `lists/{listId}` and return a `GiftList` object containing properties like `ownerId` and `allowedUsers`.

## 2. Business Logic Layer (`src/hooks/useGiftList.ts`)
- **Fetch List Metadata**: Update `useGiftList` to call `ListService.getListById(listId)` before fetching the items.
- **Implement Permission Check**:
  - Add state for `isAllowed` (defaulting to `true` while loading out of an abundance of caution, or `null`).
  - Upon fetching the list document, verify the accessing user's `uid` matches `list.ownerId` OR exists in the `list.allowedUsers` array.
  - If true, allow the items to be fetched as normal.
  - If false, early-return, do not fetch items, and set `isAllowed` to `false`.
- **Expose state**: Export `isAllowed` alongside existing values so the UI can react.

## 3. UI Layer (`src/screens/ListDetailScreen.tsx`)
- **Consume `isAllowed`**: Destructure the `isAllowed` flag from the `useGiftList` hook alongside `loading` and `items`.
- **Implement Unauthorized Modal**:
  - Add a `Modal` component from `react-native`.
  - Render the modal conditionally when `!loading && isAllowed === false`.
  - The modal content should display a warning: "You do not have permission to view this list."
  - Provide a "Go Back" button inside the modal that triggers `navigation.goBack()`.
- **Prevent Detail Render**: Ensure the main screen content (`FlatList` of items, ADD button) returns an empty state or is completely obscured by the modal if `isAllowed` is `false`, confirming that details are not leaked.
