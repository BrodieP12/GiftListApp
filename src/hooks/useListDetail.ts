import { useState, useEffect } from 'react';
import { GiftItemUI, ItemClaim } from '../types/models';
import { ListService } from '../services/ListService';
import { ClaimService } from '../services/ClaimService';
import { CrashLogger } from '../services/LoggingService';

/**
 * Powers the list-detail screen: the merged view of a list's items plus
 * (for non-owners) each item's claim status, and the claim/unclaim action.
 *
 * State managed:
 * - `items` - `GiftItemUI[]`, i.e. each `GiftItem` row annotated with a
 *   `claimStatus` (`ItemClaim | null`).
 * - `loading` / `error`.
 *
 * Realtime subscriptions:
 * - Always subscribes to `ListService.listenToItems(listId, ...)` for the
 *   list's items (name, price, url, etc.).
 * - Subscribes to `ClaimService.listenToClaimsForList(listId, ...)`
 *   **only when `isOwner` is false**. This is the core "preserve the
 *   surprise" business rule: the list owner's own items are never
 *   annotated with claim data at all (their `claimStatus` stays `null`
 *   for every item), so there is no possibility of the owner's client
 *   ever receiving or rendering who claimed what, or even that
 *   something was claimed. Non-owners (friends/shared viewers) get the
 *   live claim map so they can see what's already spoken for and avoid
 *   duplicate gifts.
 *
 * @param ownerId - id of the list's owner, needed to attribute new claims.
 * @param listId - the list being viewed.
 * @param isOwner - whether the viewing user owns this list; gates the
 * claims subscription per the rule above.
 * @param currentUserId - the viewing user's id, used to attribute/detect
 * their own claims; claiming is a no-op if this is undefined
 * (unauthenticated).
 *
 * @returns `{ items, loading, error, handleToggleClaim }`.
 *
 * Lifecycle: (re)subscribes whenever `listId` or `isOwner` changes,
 * tearing down both the items and (if present) claims channels first.
 */
export const useListDetail = (
  ownerId: string,
  listId: string,
  isOwner: boolean,
  currentUserId?: string
) => {
  const [items, setItems] = useState<GiftItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Items and claims arrive from two independent Realtime subscriptions
    // that fire at different, unpredictable times. Rather than merging
    // off of React state (which would be stale inside these closures and
    // would require carefully sequencing two setState calls), each
    // listener writes its latest snapshot into a local mutable variable
    // and then calls `merge()`, which recomputes the full `items` array
    // from whichever snapshots are freshest. This avoids a race where,
    // e.g., a claims update arrives and is merged against a captured-stale
    // `items` value from the initial render.
    let latestItems: any[] = [];
    let latestClaims: Record<string, ItemClaim> = {};

    // Recomputes the merged item+claim view from the latest snapshots of
    // each stream and pushes it into state. Safe to call from either
    // listener in any order.
    const merge = () => {
      setItems(latestItems.map(item => ({
        ...item,
        claimStatus: latestClaims[item.id] ?? null,
      })));
      setLoading(false);
    };

    const unsubItems = ListService.listenToItems(listId, (newItems) => {
      latestItems = newItems;
      merge();
    }, (err) => { setError(err); setLoading(false); });

    // Claims are only subscribed to for non-owners (see doc comment
    // above). For an owner, `unsubClaims` stays a no-op so the cleanup
    // below is always safe to call unconditionally.
    let unsubClaims = () => {};
    if (!isOwner) {
      unsubClaims = ClaimService.listenToClaimsForList(listId, (newClaims) => {
        latestClaims = newClaims;
        merge();
      }, (err) => { setError(err); });
    }

    // Cleanup: unsubscribe both Realtime channels on unmount or before
    // re-subscribing (listId/isOwner change), so a screen revisit never
    // stacks duplicate channel subscriptions.
    return () => { unsubItems(); unsubClaims(); };
  }, [listId, isOwner]);

  /**
   * Toggles the current user's claim on an item: unclaims it if they are
   * already the claimer, otherwise claims it on their behalf. Relies on
   * the Realtime claims subscription (non-owner only) to reflect the
   * result back into `items` rather than updating state optimistically
   * here.
   *
   * @param itemId - item being claimed/unclaimed.
   * @param currentClaimer - the item's current claimer id (or null),
   * as read from `items[i].claimStatus?.claimedBy`, used to decide which
   * branch to take.
   */
  const handleToggleClaim = async (itemId: string, currentClaimer: string | null) => {
    if (!currentUserId) return;
    try {
      if (currentClaimer === currentUserId) {
        await ClaimService.unclaimItem(itemId);
      } else {
        await ClaimService.claimItem(itemId, currentUserId, ownerId, listId);
      }
    } catch (err) {
      CrashLogger.error(err, 'useListDetail.handleToggleClaim');
      setError(err instanceof Error ? err : new Error('Could not update claim.'));
    }
  };

  return { items, loading, error, handleToggleClaim };
};
