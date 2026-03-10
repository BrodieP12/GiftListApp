import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../api/firebase';
import { GiftList, GiftItem } from '../types/models';
import { listsRef } from '../api/collections';


export const ListService = {
  // --- LISTS ---

  async createList(ownerId: string, title: string) {
    return addDoc(collection(db, 'lists'), {
      ownerId,
      title,
      allowedUsers: [],
      createdAt: serverTimestamp(),
      isPrivate: false,
    });
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