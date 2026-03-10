import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
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
    const q = query(
      collection(db, 'claims'), 
      where('listOwnerId', '==', ownerId),
      where('listId', '==', listId));

    const snapshot = await getDocs(q);
    
    const claims: Record<string, ItemClaim> = {};
    snapshot.forEach(doc => {
      const data = doc.data() as ItemClaim;
      claims[doc.id] = data; // doc.id is the itemId
    });
    return claims;
  },

  async claimItem(itemId: string, userId: string, listOwnerId: string, listId: string) {
    // We use the itemId as the document ID for the claim to ensure 1:1 relationship
    await setDoc(doc(db, 'claims', itemId), {
      itemId,
      claimedBy: userId,
      listOwnerId,
      listId,
      claimedAt: serverTimestamp()
    });
  },

  async unclaimItem(itemId: string) {
    await deleteDoc(doc(db, 'claims', itemId));
  }
};