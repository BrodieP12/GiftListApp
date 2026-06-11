import { useState, useEffect } from 'react';
import { ListService, CreateListResult } from '../services/ListService';
import { GiftList } from '../types/models';

/**
 * Custom hook for managing the state and actions of a user's gift lists.
 * Encapsulates data fetching, error handling, and list modifications for both
 * lists the user OWNS and lists that have been SHARED with them (joined via code).
 */
export const useLists = (userId: string | undefined) => {
    const [lists, setLists] = useState<GiftList[]>([]);
    const [sharedLists, setSharedLists] = useState<GiftList[]>([]);
    const [loading, setLoading] = useState(true);
    const [sharedLoading, setSharedLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Owned lists (realtime).
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

    // Shared lists — lists this user joined via a share code (realtime).
    useEffect(() => {
        if (!userId) {
            setSharedLists([]);
            setSharedLoading(false);
            return;
        }

        setSharedLoading(true);

        const unsubscribe = ListService.listenToSharedLists(
            userId,
            (newLists) => {
                setSharedLists(newLists);
                setSharedLoading(false);
            },
            (err) => {
                setError(err);
                setSharedLoading(false);
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
     * Joins a list shared by another user, using its share code.
     * The shared-lists subscription updates automatically on success.
     */
    const joinList = async (shareCode: string): Promise<string> => {
        if (!userId) throw new Error('User not authenticated');
        return await ListService.joinListByCode(shareCode);
    };

    /**
     * Leaves a shared list (removes the current user from its members).
     */
    const leaveList = async (listId: string): Promise<void> => {
        if (!userId) throw new Error('User not authenticated');
        return await ListService.leaveList(listId, userId);
    };

    /**
     * Deletes a list the user owns.
     */
    const deleteList = async (listId: string): Promise<void> => {
        return await ListService.deleteList(listId);
    };

    return {
        lists,
        sharedLists,
        loading,
        sharedLoading,
        error,
        fetchLists,
        createList,
        joinList,
        leaveList,
        deleteList,
    };
};
