import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { ListService } from '../services/ListService';
import { ClaimService } from '../services/ClaimService';
import { useAuth } from './useAuth';
import { GiftItemUI } from '../types/models';

export const useGiftList = (listId: string, ownerId: string) => {
  const { user } = useAuth();
  const [items, setItems] = useState<GiftItemUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  const isOwner = user?.uid === ownerId;

  /**
   * Core Logic: Fetches items and decides whether to reveal claims.
   */
  const fetchItems = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      // Permission check
      const listData = await ListService.getListById(listId);
      if (!listData) {
        setIsAllowed(false);
        setLoading(false);
        return;
      }
      
      const userHasAccess = (user.uid === listData.ownerId) || listData.allowedUsers.includes(user.uid);
      if (!userHasAccess) {
        setIsAllowed(false);
        setLoading(false);
        return;
      }
      
      setIsAllowed(true);

      // 1. Always fetch the raw items first
      const rawItems = await ListService.getItems(listId);

      // 2. SURPRISE LOGIC:
      // If Owner -> Do NOT fetch claims. Return items "clean".
      if (isOwner) {
        setItems(rawItems.map(item => ({ ...item, claimStatus: undefined })));
      } 
      // If Guest -> Fetch claims and merge them
      else {
        const claimsMap = await ClaimService.getClaimsForList(ownerId, listId);
        
        const mergedItems = rawItems.map(item => ({
          ...item,
          claimStatus: claimsMap[item.id] || null // null = available
        }));
        
        setItems(mergedItems);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to load list items.');
    } finally {
      setLoading(false);
    }
  }, [listId, ownerId, user, isOwner]);

  /**
   * Action: Handles Claim/Unclaim logic safely.
   */
  const toggleClaim = async (item: GiftItemUI) => {
    if (!user) return;

    // Safety: Owners shouldn't be calling this, but double check.
    if (isOwner) return;

    try {
      // CASE 1: Item is already claimed
      if (item.claimStatus) {
        // Check if *I* am the one who claimed it
        if (item.claimStatus.claimedBy === user.uid) {
          await ClaimService.unclaimItem(item.id);
        } else {
          Alert.alert("Locked", "This item was claimed by someone else.");
          return;
        }
      } 
      // CASE 2: Item is free
      else {
        await ClaimService.claimItem(item.id, user.uid, ownerId, listId);
      }

      // Refresh to ensure we have the latest server state (prevents race conditions)
      await fetchItems();

    } catch (e) {
      Alert.alert("Error", "Could not update claim status.");
    }
  };

  // Initial Load
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    isOwner,
    isAllowed,
    refresh: fetchItems,
    toggleClaim
  };
};