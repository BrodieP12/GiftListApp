import { useState, useEffect } from 'react';
import { GiftList } from '../types/models';
import { ListService, CreateListResult } from '../services/ListService';

/**
 * Powers the dashboard's list of lists: the current user's own lists
 * ("owned") plus lists they've joined as a member via someone else's
 * share code ("shared"), kept live, plus list create/delete/join actions.
 *
 * State managed:
 * - `ownedLists` - from `ListService.listenToOwnedLists`, i.e. `lists`
 *   rows where `owner_id = userId`, newest first.
 * - `sharedLists` - from `ListService.listenToSharedLists`, i.e. lists
 *   reachable through a `list_members` row with `role = 'member'` for
 *   this user (populated by `joinListByCode`).
 * - `loading` / `error`.
 *
 * These are two independent Realtime subscriptions (separate tables:
 * `lists` filtered by owner, and `list_members` filtered by user), each
 * with its own `Date.now()`-suffixed channel name to avoid colliding
 * with a same-named channel still being torn down from a previous mount.
 *
 * @param userId - current user id; while undefined, both lists are
 * cleared and the hook stays idle (no subscriptions).
 * @returns `{ ownedLists, sharedLists, loading, error, fetchLists,
 * createList, deleteList, joinList }`.
 *
 * Lifecycle: (re)subscribes both channels whenever `userId` changes,
 * unsubscribing prior channels first.
 */
export const useLists = (userId: string | undefined) => {
  const [ownedLists, setOwnedLists] = useState<GiftList[]>([]);
  const [sharedLists, setSharedLists] = useState<GiftList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) { setOwnedLists([]); setSharedLists([]); setLoading(false); return; }

    setLoading(true);
    let ownedReady = false;
    let sharedReady = false;

    // `loading` is only cleared once BOTH the owned-lists and
    // shared-lists initial fetches have resolved (success or error).
    // Without this join, `loading` would flip to false as soon as
    // whichever subscription's first fetch happens to land first,
    // causing the dashboard to briefly render an incomplete list (e.g.
    // "no shared lists") before the second one arrives.
    const checkDone = () => {
      if (ownedReady && sharedReady) setLoading(false);
    };

    const unsubOwned = ListService.listenToOwnedLists(
      userId,
      (lists) => { setOwnedLists(lists); ownedReady = true; checkDone(); },
      (err) => { setError(err); ownedReady = true; checkDone(); }
    );

    const unsubShared = ListService.listenToSharedLists(
      userId,
      (lists) => { setSharedLists(lists); sharedReady = true; checkDone(); },
      (err) => { setError(err); sharedReady = true; checkDone(); }
    );

    // Cleanup: unsubscribe both channels on unmount or before
    // re-subscribing for a new `userId`.
    return () => { unsubOwned(); unsubShared(); };
  }, [userId]);

  const createList = async (name: string, isSharable: boolean): Promise<CreateListResult> => {
    if (!userId) throw new Error('User not authenticated');
    return ListService.createList(userId, name, isSharable);
  };

  const deleteList = async (listId: string): Promise<void> => {
    return ListService.deleteList(listId);
  };

  // Joins a shared list by its share code (validated server-side via the
  // `join_list_by_code` RPC, which is expected to add the caller as a
  // `list_members` row). No explicit refetch needed afterward - the
  // `sharedLists` Realtime subscription above picks up the resulting
  // `list_members` insert automatically.
  const joinList = async (shareCode: string): Promise<void> => {
    await ListService.joinListByCode(shareCode);
  };

  // Kept for API compatibility with DashboardScreen. Predates the
  // Realtime subscriptions above (which now keep both lists live), so
  // there's nothing left for a manual refetch to do.
  const fetchLists = async () => {};

  return { ownedLists, sharedLists, loading, error, fetchLists, createList, deleteList, joinList };
};
