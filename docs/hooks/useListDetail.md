# `src/hooks/useListDetail.ts`

## 1. Overview & Role
The `useListDetail` hook provides a unified view of the items inside a specific gift list, merged seamlessly with the "claim status" of those items. It manages two separate database subscriptions (one for the items, one for the claims) and merges the data so the UI simply sees a list of items with an attached `claimStatus`.

## 2. Imports & Dependencies
- `useState`, `useEffect`: React state management.
- `GiftItemUI`, `ItemClaim`: Types from `../types/models`. `GiftItemUI` is an extended type that includes the claim status directly on the item.
- `ListService`: Service to fetch items in the list.
- `ClaimService`: Service to fetch claims placed on items.
- `CrashLogger`: Utility for recording errors.

## 3. Data Structures / Interfaces
No custom interfaces created here, relies on `GiftItemUI`.

## 4. Deep-Dive: Methods & Functions

### `useListDetail`
- **Signature**: `export const useListDetail = (ownerId: string, listId: string, isOwner: boolean, currentUserId?: string)`
- **Purpose**: Loads all items for a list and their corresponding claims. Merges them into a single list of `GiftItemUI` objects.
- **Step-by-Step Logic**:
  1. Initializes `items`, `loading`, and `error` states.
  2. Runs `useEffect` when `listId` or `isOwner` changes.
  3. Defines two local mutable variables: `latestItems` (array) and `latestClaims` (dictionary/record mapped by item ID).
  4. Defines a local `merge` function. When called, it maps over `latestItems`, injecting `claimStatus: latestClaims[item.id] ?? null` into each one, updates the `items` state, and sets `loading` to false.
  5. Sets up a listener via `ListService.listenToItems`. When new items arrive, updates `latestItems` and calls `merge()`.
  6. **Crucial check**: If the `isOwner` is false, it means the current user is a guest viewing the list. It sets up a second listener via `ClaimService.listenToClaimsForList`. (Owners are not allowed to see claims, so the listener is skipped). When claims arrive, updates `latestClaims` and calls `merge()`.
  7. Returns cleanup functions to unsubscribe from both listeners.
  8. Exposes the `handleToggleClaim` function (detailed below).
- **Error Handling**: Listener errors set the `error` state.
- **Modification Guide**: If you want owners to see claims (e.g., after a birthday has passed), you would change `if (!isOwner)` to a broader condition like `if (!isOwner || isPastEventDate)`.

### `handleToggleClaim` (inside `useListDetail`)
- **Signature**: `const handleToggleClaim = async (itemId: string, currentClaimer: string | null)`
- **Purpose**: Allows a user to either claim an unassigned item, or unclaim an item they previously claimed.
- **Step-by-Step Logic**:
  1. Exits early if `currentUserId` is missing.
  2. Checks if `currentClaimer === currentUserId`. If true, the user is unclaiming their own claim, so it calls `ClaimService.unclaimItem(itemId)`.
  3. If false, the user is claiming a new item, so it calls `ClaimService.claimItem(itemId, currentUserId, ownerId, listId)`.
- **Error Handling**: Wrapped in `try...catch`. On error, logs via `CrashLogger` and sets the `error` state to display a message to the user.
- **Modification Guide**: To prevent toggling a claim if it belongs to someone *else*, you should add a check: `if (currentClaimer && currentClaimer !== currentUserId) { alert("Already claimed by someone else"); return; }`.

## 5. Code Examples
```tsx
import { useListDetail } from '../hooks/useListDetail';

const ListScreen = ({ listId, ownerId, currentUserId }) => {
  const isOwner = ownerId === currentUserId;
  const { items, loading, handleToggleClaim } = useListDetail(ownerId, listId, isOwner, currentUserId);

  if (loading) return <Text>Loading items...</Text>;

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => (
        <View>
          <Text>{item.name}</Text>
          {!isOwner && (
            <Button 
              title={item.claimStatus ? "Unclaim" : "Claim"} 
              onPress={() => handleToggleClaim(item.id, item.claimStatus?.claimedBy || null)}
            />
          )}
        </View>
      )}
    />
  );
};
```

## 6. Data Flow Diagram
```mermaid
flowchart TD
    A[Component] -->|uses| B(useListDetail Hook)
    B -->|listens| C[ListService (Items)]
    B -->|listens| D[ClaimService (Claims)]
    C --> E[latestItems]
    D --> F[latestClaims]
    E --> G[merge function]
    F --> G
    G --> H[items state]
    H --> A
    A -->|calls| I[handleToggleClaim]
    I --> D
```
