import { useState, useEffect } from 'react';
import { ListService } from '../services/ListService';
import { GiftItem } from '../types/models';

/**
 * Manages a single list's items (without claim status - see
 * `useListDetail` for the owner/non-owner claim-merging variant used on
 * the list-detail screen). Intended for screens that only need to
 * read/add/delete items, e.g. AddItemScreen / ListEditScreen.
 *
 * State managed:
 * - `items` - the list's `GiftItem[]`, kept live via
 *   `ListService.listenToItems`'s Realtime subscription (any insert/
 *   update/delete on the `items` table for this `listId` triggers a
 *   full re-fetch and replace, not an incremental patch).
 * - `loading` / `error`.
 *
 * Business rule: the subscription (and therefore any data) is gated on
 * `userId` being defined, not just `listId` - so a not-yet-authenticated
 * render never issues a query that RLS would reject anyway.
 */
export const useListItems = (listId: string, userId: string | undefined) => {
    const [items, setItems] = useState<GiftItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userId) {
            setItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // Subscribes to this list's items on mount / whenever `userId` or
        // `listId` changes. The cleanup unsubscribes the previous Realtime
        // channel first, so switching lists (or a remount) never leaves a
        // stale subscription running alongside the new one.
        const unsubscribe = ListService.listenToItems(
            listId,
            (newItems) => {
                setItems(newItems);
                setLoading(false);
            },
            (err) => {
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId, listId]);

    // No-op kept only so existing call sites that still call `fetchItems()`
    // (a holdover from the pre-Realtime/Firebase manual-refetch pattern)
    // don't break; the Realtime subscription above already keeps `items`
    // up to date, so there is nothing left for this to do.
    const fetchItems = async () => {};

    const createItem = async (listId: string, item: GiftItem) => {
        if (!userId) throw new Error('User not authenticated');
        return await ListService.addItem(listId, userId, item);
    };

    const deleteItem = async (listId: string, itemId: string): Promise<void> => {
        return await ListService.deleteItem(listId, itemId);
    };

    // Return shape: `items`/`loading`/`error` mirror the live subscription
    // state above; `fetchItems` is a legacy no-op (see comment above),
    // `createItem`/`deleteItem` are thin wrappers around `ListService`
    // that rely on the subscription (not their own return value) to
    // reflect the change back into `items`.
    return {
        items,
        loading,
        error,
        fetchItems,
        createItem,
        deleteItem
    };
};
