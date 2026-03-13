import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  deleteDoc,
  runTransaction,
  getDoc
} from 'firebase/firestore';
import { db } from '../api/firebase';
import { GiftList, GiftItem } from '../types/models';
import { listsRef } from '../api/collections';

// Helper for generating random share codes
const generateAlphanumericCode = (length = 7) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};


export const ListService = {
  // --- LISTS ---

  /**
   * Creates a new list with a guaranteed unique 7-character code as the Document ID.
   */
  async createList(userId: string, title: string){
    let success = false;
    let attempts = 0;
    const maxAttempts = 5; // Prevent infinite loops just in case

    while (!success && attempts < maxAttempts) {
      const shareCode = generateAlphanumericCode(7);
      const listRef = doc(db, 'lists', shareCode);

      try {
        // Run a transaction to ensure we don't overwrite an existing list
        await runTransaction(db, async (transaction) => {
          const docSnap = await transaction.get(listRef);
          
          if (docSnap.exists()) {
            // Throwing a specific error aborts the transaction
            throw new Error("COLLISION_DETECTED"); 
          }

          // If we get here, the code is definitively unique. Create the list.
          transaction.set(listRef, {
            title: title,
            ownerId: userId,
            shareCode: shareCode, // Include inside as a property too
            allowedUsers: [],
            createdAt: serverTimestamp(),
            isPrivate: false
          });
        });

        // If the transaction finishes without throwing, we succeeded!
        success = true;
        return shareCode; // Return the new code to the UI if needed

      } catch (error: any) {
        if (error.message === "COLLISION_DETECTED") {
          // If it was just a collision, increment attempts and let the loop run again
          attempts++;
          console.warn(`Code ${shareCode} existed, retrying...`);
        } else {
          // If it was a real error (e.g., no internet, permission denied), throw it up to the UI
          throw error;
        }
      }
    }

    if (!success) {
      throw new Error("Failed to generate a unique list code after multiple attempts.");
    }
  },

  /**
   * Generates a random 7-character share code and recursively
   * ensures it's globally unique in the Firestore database.
   */
  async createShareCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 7; // Using 7 characters allows for 78,364,164,096 possible different codes
    
    let isUnique = false;
    let result = '';

    while (!isUnique) {
      result = '';
      for (let i = 0; i < codeLength; i++) {
        // Select a random index based on the length of the characters string
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
      }

      // Query Firestore directly to see if this code is already in use
      const q = query(collection(db, 'lists'), where('shareCode', '==', result));
      const specificSnapshot = await getDocs(q);

      // If the query snapshot is empty, the code is unique and we can break the loop
      if (specificSnapshot.empty) {
        isUnique = true;
      } else {
        console.log(`Collision detected! '${result}' is in use. Regenerating...`);
      }
    }

    return result;
  },

  async getOwnedLists(userId: string): Promise<GiftList[]> {
    // 1. Create the query
    const q = query(collection(db, 'lists'), where('ownerId', '==', userId));
    
    // 2. Fetch the snapshot
    const snapshot = await getDocs(q);
    
    // 3. CRITICAL FIX: Map the doc.id manually
    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      return {
        id: doc.id,
        ownerId: data.ownerId,
        title: data.title,
        isPrivate: data.isPrivate,
        allowedUsers: data.allowedUsers || [],
        createdAt: data.createdAt
      } as GiftList;
    });
  },

  async getSharedLists(userId: string): Promise<GiftList[]> {
  const q = query(collection(db, 'lists'), where('allowedUsers', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
          id: doc.id,
          ownerId: data.ownerId,
          title: data.title,
          isPrivate: data.isPrivate,
          allowedUsers: data.allowedUsers || [],
          createdAt: data.createdAt
      } as GiftList;
  });
}, 

  async deleteList(listId: string) {
    await deleteDoc(doc(db, 'lists', listId));
  },

  async getListById(listId: string): Promise<GiftList | null> {
    const docRef = doc(db, 'lists', listId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ownerId: data.ownerId,
        title: data.title,
        isPrivate: data.isPrivate,
        allowedUsers: data.allowedUsers || [],
        createdAt: data.createdAt
      } as GiftList;
    }
    return null;
  },

  async addItem(listId: string, item: Partial<GiftItem>) {
    // We add the item to the sub-collection 'items' inside the list
    return addDoc(collection(db, `lists/${listId}/items`), {
      ...item,
      createdAt: serverTimestamp(),
    });
  },

  async getItems(listId: string): Promise<GiftItem[]> {
    const snapshot = await getDocs(collection(db, `lists/${listId}/items`));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftItem));
  }
};