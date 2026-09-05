import { useState, useEffect } from 'react';
import { ListService } from '../services/ListService';
import { GiftItem } from '../types/models';

/**
 * Custom hook for managing the state and actions of a list's items.
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

        const unsubscribe = ListService.listenToOwnedListItems(
            userId,
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

    const fetchItems = async () => {};

    const createItem = async (listId: string, item: GiftItem) => {
        if (!userId) throw new Error('User not authenticated');
        return await ListService.addItem(listId, item);
    };

    const deleteItem = async (listId: string, itemId: string): Promise<void> => {
        return await ListService.deleteItem(listId, itemId);
    };

    return {
        items,
        loading,
        error,
        fetchItems,
        createItem,
        deleteItem
    };
};
