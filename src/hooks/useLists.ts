import { useState, useEffect } from 'react';
import { ListService, CreateListResult } from '../services/ListService';
import { GiftList } from '../types/models';

/**
 * Custom hook for managing the state and actions of a user's gift lists.
 * encapsulates data fetching, error handling, and list modifications.
 */
export const useLists = (userId: string | undefined) => {
    const [lists, setLists] = useState<GiftList[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userId) {
            setLists([]);
            setLoading(false);
            return;
        }
        
        setLoading(true);
        setError(null);
        
        const unsubscribe = ListService.listenToOwnedLists(
            userId,
            (newLists) => {
                setLists(newLists);
                setLoading(false);
            },
            (err) => {
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    /**
     * Dummy function for backwards compatibility with any existing refresh actions
     */
    const fetchLists = async () => {};

    /**
     * Creates a new list for the user.
     */
    const createList = async (name: string, isSharable: boolean): Promise<CreateListResult> => {
        if (!userId) throw new Error('User not authenticated');
        return await ListService.createList(userId, name, isSharable);
    };

    /**
     * Deletes a list by its ID.
     */
    const deleteList = async (listId: string): Promise<void> => {
        return await ListService.deleteList(listId);
    };

    return { 
        lists, 
        loading, 
        error, 
        fetchLists, 
        createList, 
        deleteList 
    };
};
