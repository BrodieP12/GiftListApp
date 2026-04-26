import { useState, useEffect } from 'react';
import { GiftItemUI, ItemClaim } from '../types/models';
import { ListService } from '../services/ListService';
import { ClaimService } from '../services/ClaimService';
import {CrashLogger} from "../services/LoggingService";

/**
 * Custom hook to encapsulate the logic for fetching custom lists and handling the
 * surprise claim mechanic natively.
 */
export const useListDetail = (ownerId: string, listId: string, isOwner: boolean, currentUserId?: string) => {
    const [items, setItems] = useState<GiftItemUI[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        let latestItems: any[] = [];
        let latestClaims: Record<string, ItemClaim> = {};

        const updateMerged = () => {
             const merged: GiftItemUI[] = latestItems.map(item => ({
                ...item,
                claimStatus: latestClaims[item.id] ?? null,
            }));
            setItems(merged);
            setLoading(false);
        };

        const unsubItems = ListService.listenToItems(listId, (newItems) => {
            latestItems = newItems;
            updateMerged();
        }, (err) => setError(err));

        let unsubClaims = () => {};
        if (!isOwner) {
            unsubClaims = ClaimService.listenToClaimsForList(ownerId, listId, (newClaims) => {
                latestClaims = newClaims;
                updateMerged();
            }, (err) => setError(err));
        } else {
            updateMerged();
        }

        return () => {
            unsubItems();
            unsubClaims();
        };
    }, [listId, ownerId, isOwner]);

    const fetchListData = async () => {}; // Dummy for compatibility

    const handleToggleClaim = async (itemId: string, currentClaimer: string | null) => {
        if (!currentUserId) return;

        try {
            if (currentClaimer === currentUserId) {
                // User already claimed this - unclaim it
                await ClaimService.unclaimItem(itemId);
            } else {
                // Claim the item for the current user
                await ClaimService.claimItem(itemId, currentUserId, ownerId, listId);
            }
            // We no longer need to await fetchListData(); onSnapshot does it automatically!
        } catch (error) {
            CrashLogger.error(error);
            setError(error instanceof Error ? error : new Error('Could not update the claim. Please try again.'));
        }
    };

    return {
        items,
        loading,
        error,
        fetchListData,
        handleToggleClaim
    };
};
