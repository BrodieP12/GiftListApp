import firestore from '@react-native-firebase/firestore';
import { db } from '../api/firebase';
import { ItemClaim } from '../types/models';

export const ClaimService = {
  /**
   * Fetch all claims for a specific list's items.
   * Note: In a real large app, you'd filter by listId or batch query item IDs.
   * For this MVP, we fetch relevant claims.
   */
  async getClaimsForList(ownerId: string, listId: string): Promise<Record<string, ItemClaim>> {
    // Security Rule Check: If we are the owner, this query might fail or return empty 
    // depending on rules. But logically, we shouldn't even call this if isOwner is true.
    
    // We query claims where we are NOT the owner (conceptually), 
    // but Firestore queries are specific. We'll query all claims that match this list's owner 
    // to map them to items.
    const snapshot = await db
      .collection('claims')
      .where('listOwnerId', '==', ownerId)
      .where('listId', '==', listId)
      .get();
    
    const claims: Record<string, ItemClaim> = {};
    snapshot.forEach(doc => {
      const data = doc.data() as ItemClaim;
      claims[doc.id] = data; // doc.id is the itemId
    });
    return claims;
  },

  listenToClaimsForList(
    ownerId: string, 
    listId: string, 
    onUpdate: (claims: Record<string, ItemClaim>) => void, 
    onError: (err: Error) => void
  ) {
    return db
      .collection('claims')
      .where('listOwnerId', '==', ownerId)
      .where('listId', '==', listId)
      .onSnapshot((snapshot) => {
        const claims: Record<string, ItemClaim> = {};
        if (snapshot) {
          snapshot.forEach(doc => {
            claims[doc.id] = doc.data() as ItemClaim;
          });
        }
        onUpdate(claims);
      }, onError);
  },

  async claimItem(itemId: string, userId: string, listOwnerId: string, listId: string) {
    // We use the itemId as the document ID for the claim to ensure 1:1 relationship
    await db.collection('claims').doc(itemId).set({
      itemId,
      claimedBy: userId,
      listOwnerId,
      listId,
      claimedAt: firestore.FieldValue.serverTimestamp()
    });
  },

  async unclaimItem(itemId: string) {
    await db.collection('claims').doc(itemId).delete();
  }
};